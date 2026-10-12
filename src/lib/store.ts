import { useMemo, useSyncExternalStore } from 'react'
import { normalize } from './categories'
import { addDays, today } from './dates'
import { flipRate, rateOn, txValue } from './fx'
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

/**
 * Moneda en la que se anota por defecto: la del país si es una de las dos, porque en ella
 * están los gastos de todos los días; si no, la principal.
 */
export function everydayCurrency(main: string, second: string) {
  const local = localCurrency()
  return second && local === second ? second : main
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
  const txs = useMemo(() => ledger(s), [s.txs, s.settings])
  return { ...s, txs }
}

export const ledger = (s: Pick<State, 'txs' | 'settings'>): Entry[] =>
  s.txs.map((t) => {
    const value = txValue(t, s.settings)
    return { ...t, value: value ?? 0, unconverted: value === null }
  })

const learn = (tx: Pick<Tx, 'note' | 'kind' | 'category'>) =>
  tx.note && tx.kind === 'expense' ? { ...state.learned, [normalize(tx.note)]: tx.category } : state.learned

const round2 = (n: number) => Math.round(n * 100) / 100

export const actions = {
  /** Si el movimiento no está en la moneda principal, se guarda con él el tipo de cambio de su fecha. */
  addTx(tx: Omit<Tx, 'id' | 'rate'>) {
    const rate = rateOn(tx.currency, tx.date, today(), state.txs, state.settings)
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
  /**
   * La segunda moneda pasa a ser la principal; presupuesto e ingreso se convierten. Lo anotado
   * en la principal anterior queda con el cambio de hoy, para que su valor no se mueva después.
   */
  swapCurrencies() {
    const s = state.settings
    if (!s.second || !(s.rate > 0)) return
    const rate = flipRate(s.rate)
    const convert = (n: number) => round2(n * s.rate)
    commit({
      ...state,
      txs: state.txs.map((t) => (t.currency === s.currency && !t.rate ? { ...t, rate } : t)),
      settings: { ...s, currency: s.second, second: s.currency, rate, budget: convert(s.budget), income: convert(s.income) },
    })
  },
  /** Fijos anotados en la segunda moneda: mientras existan no se puede quitar ni cambiar. */
  fixedInSecond() {
    const { second } = state.settings
    return second ? state.recurring.filter((r) => r.currency === second).length : 0
  },
  setSecondCurrency(code: string) {
    const s = state.settings
    if (code === s.second || actions.fixedInSecond() > 0) return
    actions.setSettings({ second: code === s.currency ? '' : code, rate: 0, entryCurrency: s.currency })
  },
  /** El cambio no se puede dejar vacío: sin él lo anotado en la segunda moneda no tendría valor. */
  setRate(rate: number) {
    const s = state.settings
    if (!s.second || !(rate > 0)) return
    actions.setSettings({ rate, ...(s.rate > 0 ? {} : { entryCurrency: everydayCurrency(s.currency, s.second) }) })
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
