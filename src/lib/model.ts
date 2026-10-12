import { isCategory } from './categories'
import { addDays, addMonths, iso, parseDate } from './dates'
import { snapshotRate } from './fx'
import { CURRENCIES } from './locale'
import { MAX_AMOUNT } from './parse'
import type { Every, Recurring, Settings, State, Tx } from './types'

export const defaults = (currency: string, second = ''): State => ({
  txs: [],
  recurring: [],
  learned: {},
  settings: {
    currency, second, rate: 0, entryCurrency: currency,
    budget: 0, income: 0, weeklyHours: 40, theme: 'auto', onboarded: false, lastBackup: '', backupReminder: '',
  },
})

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < MAX_AMOUNT ? v : 0)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Una fecha YYYY-MM-DD que existe en el calendario (descarta 2026-13-45). */
export const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(parseDate(v)) === v

/**
 * Reconstruye un estado válido a partir de datos no fiables (localStorage o un archivo importado).
 * Las monedas de respaldo solo se usan cuando los datos no traen las suyas.
 */
export function sanitize(raw: unknown, fallbackCurrency: string, fallbackSecond = ''): State {
  const base = defaults(fallbackCurrency, fallbackSecond)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, any>

  const s = r.settings && typeof r.settings === 'object' ? r.settings : {}
  const currency: string = CURRENCIES.includes(s.currency) ? s.currency : fallbackCurrency
  const second: string = CURRENCIES.includes(s.second) && s.second !== currency ? s.second : ''
  const settings: Settings = {
    currency,
    second,
    rate: second ? num(s.rate) : 0,
    entryCurrency: second && s.entryCurrency === second ? second : currency,
    budget: num(s.budget),
    income: num(s.income),
    weeklyHours: num(s.weeklyHours) || 40,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto',
    onboarded: s.onboarded === true,
    lastBackup: isDate(s.lastBackup) ? s.lastBackup : '',
    backupReminder: isDate(s.backupReminder) ? s.backupReminder : '',
  }

  const kind = (v: unknown) => (v === 'income' ? 'income' : 'expense')
  const category = (v: unknown, k: string) => (k === 'income' ? 'ingreso' : isCategory(v) && v !== 'ingreso' ? v : 'otros')
  // Los datos anteriores al modo bimonetario no indican moneda: estaban en la principal.
  const money = (v: unknown): string => (CURRENCIES.includes(v as string) ? (v as string) : currency)
  // Un id repetido haría que editar o borrar un movimiento afectara a varios.
  const uniqueIds = () => {
    const seen = new Set<string>()
    return (v: unknown) => {
      let id = str(v)
      if (!id || seen.has(id)) id = crypto.randomUUID()
      seen.add(id)
      return id
    }
  }

  const txId = uniqueIds()
  const txs: Tx[] = []
  for (const t of Array.isArray(r.txs) ? r.txs : []) {
    if (!t || typeof t !== 'object' || !isDate(t.date)) continue
    const k = kind(t.kind)
    const amount = typeof t.amount === 'number' && Number.isFinite(t.amount) && Math.abs(t.amount) < MAX_AMOUNT ? t.amount : 0
    if (amount === 0 || (k === 'income' && amount < 0)) continue
    txs.push({
      id: txId(t.id), kind: k, amount, currency: money(t.currency),
      ...(num(t.rate) > 0 ? { rate: num(t.rate) } : {}),
      category: category(t.category, k), note: str(t.note), date: t.date,
      ...(str(t.recurringId) ? { recurringId: str(t.recurringId) } : {}),
    })
  }

  const recId = uniqueIds()
  const recurring: Recurring[] = []
  for (const x of Array.isArray(r.recurring) ? r.recurring : []) {
    if (!x || typeof x !== 'object' || !isDate(x.start) || num(x.amount) === 0) continue
    const k = kind(x.kind)
    recurring.push({
      id: recId(x.id), kind: k, name: str(x.name), amount: num(x.amount), currency: money(x.currency), category: category(x.category, k),
      every: x.every === 'week' || x.every === 'year' ? x.every : 'month', start: x.start, done: Math.floor(num(x.done)),
    })
  }

  const learned: Record<string, string> =
    r.learned && typeof r.learned === 'object'
      ? Object.fromEntries(Object.entries(r.learned).filter((e): e is [string, string] => isCategory(e[1])))
      : {}

  return { txs, recurring, learned, settings }
}

const occurrence = (start: string, every: Every, n: number) =>
  every === 'week' ? addDays(start, 7 * n) : addMonths(start, (every === 'year' ? 12 : 1) * n)

export const nextDue = (r: Pick<Recurring, 'start' | 'every' | 'done'>) => occurrence(r.start, r.every, r.done)

/** Máximo de cobros atrasados que se registran por fijo; los anteriores se saltan. */
export const MAX_CATCH_UP = 600
// Fechas absurdamente antiguas: se deja de avanzar en vez de bloquear la app.
const MAX_SKIP = 200_000

/** Cuántos cobros se registrarían entre `start` y `today`, ambos incluidos. */
export function dueCount(start: string, every: Every, today: string) {
  let n = 0
  while (n < MAX_CATCH_UP && occurrence(start, every, n) <= today) n++
  return n
}

/** Genera los movimientos de los fijos que ya han vencido. Devuelve el mismo estado si no hay ninguno. */
export function materialize(s: State, today: string): State {
  const txs: Tx[] = []
  const recurring = s.recurring.map((r) => {
    let cur = r
    const rate = snapshotRate(r.currency, s.settings)
    for (let i = 0; i < MAX_CATCH_UP && nextDue(cur) <= today; i++) {
      txs.push({
        id: crypto.randomUUID(), kind: cur.kind, amount: cur.amount, currency: cur.currency, ...(rate ? { rate } : {}),
        category: cur.category, note: cur.name, date: nextDue(cur), recurringId: cur.id,
      })
      cur = { ...cur, done: cur.done + 1 }
    }
    // Lo que siga vencido tras el tope se salta: si no, se generaría en la siguiente pasada.
    for (let i = 0; i < MAX_SKIP && nextDue(cur) <= today; i++) cur = { ...cur, done: cur.done + 1 }
    return cur
  })
  return txs.length ? { ...s, recurring, txs: [...s.txs, ...txs] } : s
}
