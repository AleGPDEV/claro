import type { Recurring, Settings, Tx } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Hay segunda moneda y se conoce su tipo de cambio. */
export const isBimonetary = (s: Settings) => s.second !== '' && s.rate > 0

/**
 * Pasa un monto a la moneda principal. `rate` son las unidades de `currency` por 1 de la
 * principal; si falta, se usa el cambio actual de la segunda moneda.
 */
export function toMain(amount: number, currency: string, rate: number | undefined, s: Settings) {
  if (currency === s.currency) return amount
  const r = rate ?? (currency === s.second ? s.rate : 0)
  return r > 0 ? round2(amount / r) : amount
}

export const txValue = (t: Tx, s: Settings) => toMain(t.amount, t.currency, t.rate, s)

/** Cambio que se guarda con un movimiento nuevo en `currency`. */
export const snapshotRate = (currency: string, s: Settings) =>
  currency !== s.currency && currency === s.second && s.rate > 0 ? s.rate : undefined

const perMonth = (r: Recurring) => (r.every === 'week' ? (r.amount * 52) / 12 : r.every === 'year' ? r.amount / 12 : r.amount)

/** Coste mensual de un fijo, en la moneda principal. */
export const monthlyValue = (r: Recurring, s: Settings) => toMain(perMonth(r), r.currency, undefined, s)

export const flipRate = (x: number) => (x > 0 ? Number((1 / x).toPrecision(8)) : 0)

const STRONG = ['USD', 'EUR', 'GBP']

/**
 * Cómo enseñar un tipo de cambio: "1 USD = 40 UYU" aunque la principal sea UYU.
 * `inverted` indica que lo mostrado es el inverso de lo guardado.
 */
export function quote(main: string, other: string) {
  const inverted = STRONG.includes(other) && !STRONG.includes(main)
  return { base: inverted ? other : main, counter: inverted ? main : other, inverted }
}

/** Convierte entre el cambio guardado y el mostrado (la misma operación en ambos sentidos). */
export const quoted = (rate: number, inverted: boolean) => (inverted ? flipRate(rate) : rate)

const ALIASES: Record<string, string[]> = {
  USD: ['usd', 'u$s', 'us$', 'dolar', 'dolares', 'dólar', 'dólares'],
  EUR: ['eur', 'euro', 'euros', '€'],
  GBP: ['gbp', 'libra', 'libras'],
  BRL: ['brl', 'real', 'reales'],
  PEN: ['pen', 'sol', 'soles'],
}
const PESOS = ['UYU', 'ARS', 'MXN', 'COP', 'CLP', 'DOP']

const currencyWords = (code: string) =>
  ALIASES[code] ?? (PESOS.includes(code) ? [code.toLowerCase(), 'peso', 'pesos'] : [code.toLowerCase()])

/**
 * Busca en el texto una mención a alguna de las monedas ("usd", "u$s", "dólares", "pesos").
 * Devuelve la moneda y el texto con la mención cambiada por "$", que marca el número de al lado
 * como el monto. Un "$" suelto no dice nada: según el país son pesos o dólares.
 */
export function findCurrency(text: string, codes: string[]): { code: string; text: string } | null {
  const owner = new Map<string, string>()
  for (const code of codes) for (const w of currencyWords(code)) if (!owner.has(w)) owner.set(w, code)
  if (owner.size === 0) return null
  const words = [...owner.keys()].sort((a, b) => b.length - a.length).map((w) => w.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&'))
  const m = new RegExp(`(?<!\\p{L})(${words.join('|')})(?!\\p{L})`, 'iu').exec(text)
  if (!m) return null
  return { code: owner.get(m[1].toLowerCase())!, text: `${text.slice(0, m.index)}$${text.slice(m.index + m[1].length)}` }
}
