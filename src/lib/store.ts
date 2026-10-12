import { useMemo, useSyncExternalStore } from 'react'
import { normalize } from './categories'
import { addDays, today } from './dates'
import { flipRate, snapshotRate, txValue } from './fx'
import { guessCurrency } from './locale'
import { defaults as modelDefaults, materialize, sanitize } from './model'
import type { Entry, Recurring, Settings, State, Tx } from './types'

export { CURRENCIES } from './locale'
export { dueCount, nextDue } from './model'

const KEY = 'claro:v1'

/** Moneda principal de una instalación nueva; la del país se propone como segunda. */
const DEFAULT_CURRENCY = 'USD'

function localCurrency() {
  const local = guessCurrency(navigator.languages ?? [navigator.language], Intl.DateTimeFormat().resolvedOptions().timeZone ?? '')
  return local === DEFAULT_CURRENCY ? '' : local
}

const defaults = () => modelDefaults(DEFAULT_CURRENCY, localCurrency())

export const importState = (raw: unknown) => sanitize(raw, DEFAULT_CURRENCY)

/** Lee lo guardado; `null` si el almacenamiento no está disponible. */
function read(): State | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (raw === null) return defaults()
  try {
    return importState(JSON.parse(raw))
  } catch {
    // Datos ilegibles: se apartan en vez de sobrescribirlos, por si se pueden recuperar a mano.
    try {
      localStorage.setItem(`${KEY}:corrupto`, raw)
    } catch {
      // Sin espacio para la copia; no hay más que hacer.
    }
    return defaults()
  }
}

function write(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Sin almacenamiento (modo privado, cuota): la sesión sigue funcionando en memoria.
  }
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Vuelve a leer lo guardado (otra pestaña pudo cambiarlo) y genera los fijos que hayan vencido. */
function sync() {
  const stored = read()
  if (!stored) return
  const next = materialize(stored, today())
  if (next !== stored) write(next)
  state = next
  emit()
}

let state: State = defaults()
sync()

function commit(next: State) {
  state = materialize(next, today())
  write(state)
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Otra pestaña guardó cambios: adoptarlos en vez de pisarlos con el estado de esta.
window.addEventListener('storage', (e) => {
  if (e.key === KEY || e.key === null) sync()
})
// Al volver a la app (quizá otro día) releer y generar los fijos pendientes.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') sync()
})

/** Pide al navegador que no borre los datos por falta de espacio o de uso. */
export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

export async function isPersisted() {
  try {
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}

if (state.settings.onboarded) requestPersistence()

export const useStore = () => useSyncExternalStore(subscribe, () => state)
export const getState = () => state

/** El estado con cada movimiento convertido a la moneda principal; es lo que usan los cálculos. */
export function useLedger() {
  const s = useStore()
  const txs = useMemo<Entry[]>(() => s.txs.map((t) => ({ ...t, value: txValue(t, s.settings) })), [s.txs, s.settings])
  return { ...s, txs }
}

export const ledger = (s: State): Entry[] => s.txs.map((t) => ({ ...t, value: txValue(t, s.settings) }))

const learn = (tx: Pick<Tx, 'note' | 'kind' | 'category'>) =>
  tx.note && tx.kind === 'expense' ? { ...state.learned, [normalize(tx.note)]: tx.category } : state.learned

const round2 = (n: number) => Math.round(n * 100) / 100

export const actions = {
  /** El tipo de cambio del momento se guarda con el movimiento si no está en la moneda principal. */
  addTx(tx: Omit<Tx, 'id' | 'rate'>) {
    const rate = snapshotRate(tx.currency, state.settings)
    const full: Tx = { ...tx, id: crypto.randomUUID(), ...(rate ? { rate } : {}) }
    commit({ ...state, txs: [...state.txs, full], learned: learn(tx) })
    return full.id
  },
  updateTx(tx: Tx) {
    commit({ ...state, learned: learn(tx), txs: state.txs.map((t) => (t.id === tx.id ? tx : t)) })
  },
  removeTx(id: string) {
    commit({ ...state, txs: state.txs.filter((t) => t.id !== id) })
  },
  /** Deshace un borrado. */
  restoreTx(tx: Tx) {
    if (!state.txs.some((t) => t.id === tx.id)) commit({ ...state, txs: [...state.txs, tx] })
  },
  addRecurring(r: Omit<Recurring, 'id' | 'done'>) {
    commit({ ...state, recurring: [...state.recurring, { ...r, id: crypto.randomUUID(), done: 0 }] })
  },
  updateRecurring(r: Recurring) {
    commit({ ...state, recurring: state.recurring.map((x) => (x.id === r.id ? r : x)) })
  },
  removeRecurring(id: string) {
    commit({ ...state, recurring: state.recurring.filter((r) => r.id !== id) })
  },
  setSettings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } })
  },
  /**
   * Cambia la moneda principal. Si es la segunda, se intercambian; si es otra, se entiende
   * como una corrección y lo anotado en la principal pasa a estar en la nueva.
   */
  setMainCurrency(code: string) {
    const s = state.settings
    if (code === s.currency) return
    if (code === s.second) return actions.swapCurrencies()
    const relabel = <T extends { currency: string }>(x: T): T => (x.currency === s.currency ? { ...x, currency: code } : x)
    commit({
      ...state,
      txs: state.txs.map(relabel),
      recurring: state.recurring.map(relabel),
      settings: { ...s, currency: code, entryCurrency: s.entryCurrency === s.currency ? code : s.entryCurrency },
    })
  },
  /** La segunda moneda pasa a ser la principal; presupuesto e ingreso se convierten. */
  swapCurrencies() {
    const s = state.settings
    if (!s.second) return
    const convert = (n: number) => (s.rate > 0 ? round2(n * s.rate) : n)
    actions.setSettings({ currency: s.second, second: s.currency, rate: flipRate(s.rate), budget: convert(s.budget), income: convert(s.income) })
  },
  setSecondCurrency(code: string) {
    const s = state.settings
    if (code === s.second) return
    actions.setSettings({ second: code === s.currency ? '' : code, rate: 0, entryCurrency: s.currency })
  },
  finishOnboarding(patch: Partial<Settings>) {
    actions.setSettings({ ...patch, onboarded: true, backupReminder: addDays(today(), 14) })
    requestPersistence()
  },
  markBackup() {
    actions.setSettings({ lastBackup: today(), backupReminder: addDays(today(), 30) })
  },
  snoozeBackup() {
    actions.setSettings({ backupReminder: addDays(today(), 7) })
  },
  replace(next: State) {
    commit(next)
  },
  reset() {
    commit(defaults())
  },
}

/** Formatea dinero: por defecto en la moneda principal, o en la que se indique. */
export function useMoney() {
  const { currency } = useStore().settings
  return useMemo(() => {
    const cache = new Map<string, Intl.NumberFormat>()
    const format = (code: string, rounded: boolean) => {
      const key = `${code}${rounded}`
      if (!cache.has(key))
        cache.set(key, new Intl.NumberFormat(undefined, { style: 'currency', currency: code, ...(rounded ? { maximumFractionDigits: 0 } : {}) }))
      return cache.get(key)!
    }
    return (n: number, rounded = false, code = currency) => format(code, rounded).format(n)
  }, [currency])
}

export type Money = ReturnType<typeof useMoney>
