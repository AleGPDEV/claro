import { diffDays } from './dates'
import type { Recurring, Settings, Tx } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Hay segunda moneda y se conoce su tipo de cambio. */
export const isBimonetary = (s: Settings) => s.second !== '' && s.rate > 0

/**
 * Pasa un monto a la moneda principal. `rate` son las unidades de `currency` por 1 de la
 * principal; si falta, se usa el cambio actual de la segunda moneda. Sin ningún cambio
 * conocido devuelve `null`: nunca se asume que una moneda vale lo mismo que otra.
 */
export function toMain(amount: number, currency: string, rate: number | undefined, s: Settings): number | null {
  if (currency === s.currency) return amount
  const r = rate ?? (currency === s.second ? s.rate : 0)
  return r > 0 ? round2(amount / r) : null
}

export const txValue = (t: Tx, s: Settings) => toMain(t.amount, t.currency, t.rate, s)

/** Se puede expresar en la moneda principal algo anotado hoy en `currency`. */
export const convertible = (currency: string, s: Settings) => currency === s.currency || (currency === s.second && s.rate > 0)

/** Cambio actual para un movimiento en `currency`, o `undefined` si está en la principal. */
export const snapshotRate = (currency: string, s: Settings) =>
  currency !== s.currency && currency === s.second && s.rate > 0 ? s.rate : undefined

/**
 * Cambio que se guarda con un movimiento fechado en `date`. Para una fecha pasada vale más el
 * de otro movimiento cercano a ese día que el de hoy, si lo hay.
 */
export function rateOn(currency: string, date: string, today: string, txs: Tx[], s: Settings) {
  const current = snapshotRate(currency, s)
  if (!current || date === today) return current
  let best = current
  let gap = Math.abs(diffDays(date, today))
  for (const t of txs) {
    if (t.currency !== currency || !t.rate) continue
    const g = Math.abs(diffDays(date, t.date))
    if (g < gap) {
      best = t.rate
      gap = g
    }
  }
  return best
}

const perMonth = (r: Recurring) => (r.every === 'week' ? (r.amount * 52) / 12 : r.every === 'year' ? r.amount / 12 : r.amount)

/** Coste mensual de un fijo en la moneda principal; 0 si no se puede convertir (ver `convertible`). */
export const monthlyValue = (r: Recurring, s: Settings) => toMain(perMonth(r), r.currency, undefined, s) ?? 0

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

// "peso" en singular no está: es también una palabra corriente ("balanza peso 800").
const ALIASES: Record<string, string[]> = {
  USD: ['usd', 'u$s', 'us$', 'dolar', 'dolares', 'dólar', 'dólares'],
  EUR: ['eur', 'euro', 'euros', '€'],
  GBP: ['gbp', 'libra', 'libras'],
  BRL: ['brl', 'reales'],
  PEN: ['pen', 'soles'],
}
const PESOS = ['UYU', 'ARS', 'MXN', 'COP', 'CLP', 'DOP']

const currencyWords = (code: string) =>
  ALIASES[code] ?? (PESOS.includes(code) ? [code.toLowerCase(), 'pesos'] : [code.toLowerCase()])

/**
 * Busca en el texto una mención a alguna de las monedas ("usd", "u$s", "dólares", "pesos").
 * Devuelve la moneda y el texto con la mención cambiada por "$", que marca el número de al lado
 * como el monto. Un "$" junto a un número son pesos si una sola de las monedas es un peso
 * (en el Río de la Plata los dólares se escriben "U$S"); si no, no dice nada.
 */
export function findCurrency(text: string, codes: string[]): { code: string; text: string } | null {
  const { owner, pattern } = mentions(codes)
  const m = pattern && new RegExp(pattern, 'iu').exec(text)
  if (m) return { code: owner.get(m[1].toLowerCase())!, text: `${text.slice(0, m.index)}$${text.slice(m.index + m[1].length)}` }
  const pesos = codes.filter((c) => PESOS.includes(c))
  if (codes.length > 1 && pesos.length === 1 && /\$\s?\d|\d\s?\$/.test(text)) return { code: pesos[0], text }
  return null
}

/** Cambia por "$" todas las menciones a una moneda, sin alterar el número de palabras del texto. */
export function maskCurrencies(text: string, codes: string[]) {
  const { pattern } = mentions(codes)
  return pattern ? text.replace(new RegExp(pattern, 'giu'), '$$') : text
}

function mentions(codes: string[]) {
  const owner = new Map<string, string>()
  for (const code of codes) for (const w of currencyWords(code)) if (!owner.has(w)) owner.set(w, code)
  const words = [...owner.keys()].sort((a, b) => b.length - a.length).map((w) => w.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&'))
  return { owner, pattern: words.length ? `(?<!\\p{L})(${words.join('|')})(?!\\p{L})` : null }
}
