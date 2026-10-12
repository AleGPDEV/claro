import { addDays, addMonths, daysInMonth, diffDays, iso, minDate, parseDate, today } from './dates'
import type { Kind, Settings, Tx } from './types'

export type PeriodKind = 'week' | 'month' | 'year'
export interface Period {
  kind: PeriodKind
  anchor: string
}

export const sum = (txs: Tx[], from: string, to: string, kind: Kind = 'expense') =>
  txs.reduce((s, t) => (t.kind === kind && t.date >= from && t.date <= to ? s + t.amount : s), 0)

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function range(p: Period) {
  const d = parseDate(p.anchor)
  const y = d.getFullYear()
  const m = d.getMonth()
  if (p.kind === 'week') {
    const from = addDays(p.anchor, -((d.getDay() + 6) % 7))
    const to = addDays(from, 6)
    const a = parseDate(from)
    const b = parseDate(to)
    const label =
      a.getMonth() === b.getMonth()
        ? `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}`
        : `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`
    return { from, to, label }
  }
  if (p.kind === 'month') {
    const label = d.toLocaleDateString('es', { month: 'long', year: 'numeric' })
    return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m, daysInMonth(y, m))), label }
  }
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) }
}

export function shift(p: Period, n: number): Period {
  if (p.kind === 'week') return { ...p, anchor: addDays(p.anchor, 7 * n) }
  return { ...p, anchor: addMonths(p.anchor, (p.kind === 'year' ? 12 : 1) * n) }
}

/** Total del periodo frente al mismo tramo transcurrido del periodo anterior. */
export function compare(p: Period, txs: Tx[]) {
  const r = range(p)
  const prev = range(shift(p, -1))
  const elapsed = diffDays(r.from, minDate(today(), r.to))
  const total = sum(txs, r.from, r.to)
  const before = elapsed < 0 ? 0 : sum(txs, prev.from, minDate(addDays(prev.from, elapsed), prev.to))
  return { total, before, delta: before > 0 ? (total - before) / before : null, days: Math.max(1, elapsed + 1) }
}

export interface Bucket {
  from: string
  to: string
  tick: string
  title: string
  value: number
  current: boolean
}

export function buckets(p: Period, txs: Tx[]): Bucket[] {
  const r = range(p)
  const t = today()
  if (p.kind === 'year') {
    const y = Number(r.from.slice(0, 4))
    return MONTHS.map((name, m) => {
      const from = iso(new Date(y, m, 1))
      const to = iso(new Date(y, m, daysInMonth(y, m)))
      return { from, to, tick: name[0].toUpperCase(), title: `${name} ${y}`, value: sum(txs, from, to), current: t >= from && t <= to }
    })
  }
  const n = diffDays(r.from, r.to) + 1
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(r.from, i)
    const d = parseDate(date)
    const tick = p.kind === 'week' ? 'LMXJVSD'[i] : i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : ''
    const title = d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
    return { from: date, to: date, tick, title, value: sum(txs, date, date), current: date === t }
  })
}

export function byCategory(txs: Tx[], from: string, to: string) {
  const totals = new Map<string, number>()
  for (const t of txs)
    if (t.kind === 'expense' && t.date >= from && t.date <= to)
      totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount)
  // Una categoría con más devoluciones que gastos no es un gasto del periodo.
  return [...totals].map(([id, total]) => ({ id, total })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total)
}

export function dailyTotals(txs: Tx[], from: string, to: string) {
  const map = new Map<string, number>()
  for (const t of txs)
    if (t.kind === 'expense' && t.date >= from && t.date <= to) map.set(t.date, (map.get(t.date) ?? 0) + t.amount)
  return map
}

/** Lo que vale una hora de trabajo según el ingreso mensual declarado. */
export const hourlyRate = (s: Settings) =>
  s.income > 0 && s.weeklyHours > 0 ? s.income / ((s.weeklyHours * 52) / 12) : 0

export function workTime(amount: number, rate: number) {
  const h = amount / rate
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  return `${h.toLocaleString(undefined, { maximumFractionDigits: h < 10 ? 1 : 0 })} h`
}
