import { useMemo, useSyncExternalStore } from 'react'
import { normalize } from './categories'
import { addDays, today } from './dates'
import { guessCurrency } from './locale'
import { defaults as modelDefaults, materialize, sanitize } from './model'
import type { Recurring, Settings, State, Tx } from './types'

export { CURRENCIES } from './locale'
export { dueCount, monthlyCost, nextDue } from './model'

const KEY = 'claro:v1'

const fallbackCurrency = () =>
  guessCurrency(navigator.languages ?? [navigator.language], Intl.DateTimeFormat().resolvedOptions().timeZone ?? '')

const defaults = () => modelDefaults(fallbackCurrency())

export const importState = (raw: unknown) => sanitize(raw, fallbackCurrency())

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

const learn = (tx: Pick<Tx, 'note' | 'kind' | 'category'>) =>
  tx.note && tx.kind === 'expense' ? { ...state.learned, [normalize(tx.note)]: tx.category } : state.learned

export const actions = {
  addTx(tx: Omit<Tx, 'id'>) {
    const full = { ...tx, id: crypto.randomUUID() }
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

export function useMoney() {
  const { currency } = useStore().settings
  return useMemo(() => {
    const full = new Intl.NumberFormat(undefined, { style: 'currency', currency })
    const round = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 })
    return (n: number, rounded = false) => (rounded ? round : full).format(n)
  }, [currency])
}

export type Money = ReturnType<typeof useMoney>
