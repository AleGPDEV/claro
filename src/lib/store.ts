import { useMemo, useSyncExternalStore } from 'react'
import { normalize } from './categories'
import { addDays, addMonths, today } from './dates'
import type { Recurring, Settings, State, Tx } from './types'

const KEY = 'claro:v1'

const REGION_CURRENCY: Record<string, string> = {
  ES: 'EUR', MX: 'MXN', CO: 'COP', AR: 'ARS', CL: 'CLP', PE: 'PEN', DO: 'DOP', UY: 'UYU',
  US: 'USD', GB: 'GBP', BR: 'BRL', EC: 'USD', PA: 'USD', SV: 'USD', CR: 'CRC', GT: 'GTQ',
  BO: 'BOB', PY: 'PYG', VE: 'USD', HN: 'HNL', NI: 'NIO', FR: 'EUR', DE: 'EUR', IT: 'EUR', PT: 'EUR',
}

export const CURRENCIES = [...new Set(Object.values(REGION_CURRENCY))].sort()

function guessCurrency() {
  const region = navigator.language.split('-')[1]?.toUpperCase()
  return (region && REGION_CURRENCY[region]) || 'USD'
}

const defaults = (): State => ({
  txs: [],
  recurring: [],
  learned: {},
  settings: { currency: guessCurrency(), budget: 0, income: 0, weeklyHours: 40, theme: 'auto', onboarded: false },
})

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Reconstruye un estado válido a partir de datos no fiables (localStorage o un archivo importado). */
export function sanitize(raw: unknown): State {
  const base = defaults()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, any>
  const kind = (v: unknown) => (v === 'income' ? 'income' : 'expense')
  const txs: Tx[] = (Array.isArray(r.txs) ? r.txs : [])
    .filter((t: any) => t && isDate(t.date) && num(t.amount) > 0)
    .map((t: any) => ({
      id: str(t.id) || crypto.randomUUID(),
      kind: kind(t.kind),
      amount: num(t.amount),
      category: str(t.category) || 'otros',
      note: str(t.note),
      date: t.date,
      ...(str(t.recurringId) ? { recurringId: str(t.recurringId) } : {}),
    }))
  const recurring: Recurring[] = (Array.isArray(r.recurring) ? r.recurring : [])
    .filter((x: any) => x && isDate(x.start) && num(x.amount) > 0)
    .map((x: any) => ({
      id: str(x.id) || crypto.randomUUID(),
      kind: kind(x.kind),
      name: str(x.name),
      amount: num(x.amount),
      category: str(x.category) || 'otros',
      every: x.every === 'week' || x.every === 'year' ? x.every : 'month',
      start: x.start,
      done: Math.floor(num(x.done)),
    }))
  const learned: Record<string, string> = {}
  if (r.learned && typeof r.learned === 'object')
    for (const [k, v] of Object.entries(r.learned)) if (typeof v === 'string') learned[k] = v
  const s = r.settings && typeof r.settings === 'object' ? r.settings : {}
  const settings: Settings = {
    currency: CURRENCIES.includes(s.currency) ? s.currency : base.settings.currency,
    budget: num(s.budget),
    income: num(s.income),
    weeklyHours: num(s.weeklyHours) || 40,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto',
    onboarded: s.onboarded === true,
  }
  return { txs, recurring, learned, settings }
}

export function nextDue(r: Recurring) {
  if (r.every === 'week') return addDays(r.start, 7 * r.done)
  return addMonths(r.start, (r.every === 'year' ? 12 : 1) * r.done)
}

export const monthlyCost = (r: Recurring) =>
  r.every === 'week' ? (r.amount * 52) / 12 : r.every === 'year' ? r.amount / 12 : r.amount

/** Genera los movimientos de los gastos fijos que ya han vencido. */
function materialize(s: State): State {
  const t = today()
  const txs: Tx[] = []
  const recurring = s.recurring.map((r) => {
    let cur = r
    for (let i = 0; i < 600 && nextDue(cur) <= t; i++) {
      txs.push({
        id: crypto.randomUUID(),
        kind: cur.kind,
        amount: cur.amount,
        category: cur.category,
        note: cur.name,
        date: nextDue(cur),
        recurringId: cur.id,
      })
      cur = { ...cur, done: cur.done + 1 }
    }
    return cur
  })
  return txs.length ? { ...s, recurring, txs: [...s.txs, ...txs] } : s
}

function load(): State {
  try {
    return materialize(sanitize(JSON.parse(localStorage.getItem(KEY) ?? 'null')))
  } catch {
    return defaults()
  }
}

let state = load()
const listeners = new Set<() => void>()

function set(next: State) {
  state = materialize(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Sin almacenamiento (modo privado, cuota): la sesión sigue funcionando en memoria.
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Al volver a la app otro día, generar los fijos pendientes.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') set(state)
})

export const useStore = () => useSyncExternalStore(subscribe, () => state)
export const getState = () => state

export const actions = {
  addTx(tx: Omit<Tx, 'id'>) {
    const full = { ...tx, id: crypto.randomUUID() }
    const learned = tx.note && tx.kind === 'expense' ? { ...state.learned, [normalize(tx.note)]: tx.category } : state.learned
    set({ ...state, txs: [...state.txs, full], learned })
    return full.id
  },
  updateTx(tx: Tx) {
    const learned = tx.note && tx.kind === 'expense' ? { ...state.learned, [normalize(tx.note)]: tx.category } : state.learned
    set({ ...state, learned, txs: state.txs.map((t) => (t.id === tx.id ? tx : t)) })
  },
  removeTx(id: string) {
    set({ ...state, txs: state.txs.filter((t) => t.id !== id) })
  },
  addRecurring(r: Omit<Recurring, 'id' | 'done'>) {
    set({ ...state, recurring: [...state.recurring, { ...r, id: crypto.randomUUID(), done: 0 }] })
  },
  removeRecurring(id: string) {
    set({ ...state, recurring: state.recurring.filter((r) => r.id !== id) })
  },
  setSettings(patch: Partial<Settings>) {
    set({ ...state, settings: { ...state.settings, ...patch } })
  },
  replace(next: State) {
    set(next)
  },
  reset() {
    set({ ...defaults(), settings: { ...defaults().settings, onboarded: false } })
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
