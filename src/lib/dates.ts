const pad = (n: number) => String(n).padStart(2, '0')

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => iso(new Date())

export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number) {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}

export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

/** Suma meses conservando el día, recortado al último día del mes destino. */
export function addMonths(s: string, n: number) {
  const d = parseDate(s)
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const day = Math.min(d.getDate(), daysInMonth(first.getFullYear(), first.getMonth()))
  return iso(new Date(first.getFullYear(), first.getMonth(), day))
}

export const diffDays = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 864e5)

export const minDate = (a: string, b: string) => (a < b ? a : b)

export function dayLabel(s: string) {
  const t = today()
  if (s === t) return 'Hoy'
  if (s === addDays(t, -1)) return 'Ayer'
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  if (s.slice(0, 4) !== t.slice(0, 4)) opts.year = 'numeric'
  return parseDate(s).toLocaleDateString('es', opts)
}
