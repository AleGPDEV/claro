import { detectCategory, isCategory, normalize, tokenize, wordForms } from './categories'
import { addDays, today } from './dates'
import { findCurrency } from './fx'
import type { Kind } from './types'

/** Tope de cualquier monto, tecleado o importado. */
export const MAX_AMOUNT = 1e10

export interface Parsed {
  /** Siempre positivo; `refund` indica que resta. */
  amount: number | null
  kind: Kind
  refund: boolean
  note: string
  category: string
  date: string
  /** Moneda mencionada en el texto ("usd", "pesos"…), o `null` si no se indica. */
  currency: string | null
  /**
   * Duda que conviene mostrar: el único número coincide con este año o el siguiente,
   * había varios números y se eligió uno por su posición, o la línea trae dos gastos.
   */
  doubt: 'year' | 'several' | 'two' | null
  /** Con dos gastos en una línea ("super 1200 y farmacia 400"), el texto del segundo. */
  next: string | null
}

/** Acepta "3,50", "3.50", "1.234,56", "1,234.56" y "1.500" (miles). */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return null
  const dot = s.lastIndexOf('.')
  const comma = s.lastIndexOf(',')
  if (dot >= 0 && comma >= 0) {
    const dec = dot > comma ? '.' : ','
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.')
  } else if (dot >= 0 || comma >= 0) {
    const sep = dot >= 0 ? '.' : ','
    const parts = s.split(sep)
    const thousands = parts.length > 2 || (parts[1].length === 3 && parts[0] !== '0')
    s = thousands ? parts.join('') : parts.join('.')
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 && n < MAX_AMOUNT ? Math.round(n * 100) / 100 : null
}

// Un número suelto: no pegado a letras ("x2", "covid19") ni a otro número.
const NUMBER = /(?<![\p{L}\p{N}.,])\d+(?:[.,]\d+)*(?![\p{L}\p{N}])/gu
const DAYS: Record<string, number> = { hoy: 0, ayer: -1, anteayer: -2, antier: -2 }
const REFUND_WORDS = ['devolucion', 'reembolso', 'reintegro']
const JOINER = /^\s*(?:y|\+|mas|más)(?:\s+(\p{L}+))?\s*$/iu

interface Candidate {
  start: number
  end: number
  raw: string
  value: number | null
  /** Lleva símbolo de moneda. */
  marked: boolean
  negative: boolean
  /** Tiene dos decimales, como un precio. */
  cents: boolean
  /** Cuenta cosas ("2 medialunas", "4 amigos"): no es un monto salvo que sea el único número. */
  quantity: boolean
}

// Palabras terminadas en "s" que no son un plural contable.
const NOT_PLURAL = ['mas', 'más', 'menos', 'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'gratis', 'antes', 'despues', 'después']
const isPlural = (word: string) => /^\p{L}{3,}s$/iu.test(word) && !NOT_PLURAL.includes(word.toLowerCase())
/** Un entero de los que cuentan cosas: una o dos cifras, hasta 31, sin símbolo ni signo. */
const countsThings = (c: Pick<Candidate, 'raw' | 'marked' | 'negative'>) =>
  !c.marked && !c.negative && /^\d{1,2}$/.test(c.raw) && Number(c.raw) <= 31

/** Un entero pequeño seguido de un plural: "2 medialunas", "3 cuotas", "4 amigos". */
function isQuantity(text: string, c: Pick<Candidate, 'end' | 'raw' | 'marked' | 'negative'>) {
  const word = text.slice(c.end).match(/^\s+(\p{L}+)(?!\p{L})/u)?.[1]
  return countsThings(c) && word !== undefined && isPlural(word)
}

/**
 * Los números del texto que pueden ser el monto. Si la línea trae dos gastos distintos,
 * `cut` es donde termina el primero y solo se devuelven sus números.
 */
function candidates(text: string): { found: Candidate[]; cut: number | null } {
  const found: Candidate[] = []
  for (const m of text.matchAll(NUMBER)) {
    let start = m.index
    let end = start + m[0].length
    let marked = false
    let negative = false
    const symbol = text.slice(0, start).match(/[$€]\s?$/)
    if (symbol) {
      marked = true
      start -= symbol[0].length
    }
    if (text[start - 1] === '-' && (start === 1 || /\s/.test(text[start - 2]))) {
      negative = true
      start--
    }
    const after = text.slice(end).match(/^\s?[$€]/)
    if (after) {
      marked = true
      end += after[0].length
    }
    const c = { start, end, raw: m[0], value: parseAmount(m[0]), marked, negative, cents: /[.,]\d{2}$/.test(m[0]) }
    found.push({ ...c, quantity: isQuantity(text, c) })
  }

  // "café 3 50" → 3,50: un entero corto seguido de exactamente dos cifras son los céntimos.
  // Con cuatro cifras o más ("concierto 2026 80") son dos números distintos.
  for (let i = 0; i < found.length - 1; i++) {
    const a = found[i]
    const b = found[i + 1]
    if (text.slice(a.end, b.start) === ' ' && /^\d{1,3}$/.test(a.raw) && /^\d{2}$/.test(b.raw) && !b.negative) {
      const raw = `${a.raw}.${b.raw}`
      found.splice(i, 2, { ...a, end: b.end, raw, value: parseAmount(raw), marked: a.marked || b.marked, cents: true, quantity: false })
      break
    }
  }

  // Dos montos unidos por "y", "+" o "más", con o sin una palabra en medio:
  // "uber 10 y 5 propina" → 15, "almuerzo 450 y propina 50" → 500.
  for (let i = 0; i < found.length - 1; ) {
    const a = found[i]
    const b = found[i + 1]
    const join = text.slice(a.end, b.start).match(JOINER)
    if (!join || a.value === null || b.value === null || b.negative || a.quantity || b.quantity) {
      i++
      continue
    }
    const word = join[1]
    // "café 150 y medialunas 2": lo que sigue a un plural es cuántas, no cuánto.
    if (word && isPlural(word) && countsThings(b)) {
      b.quantity = true
      i++
      continue
    }
    // "super 1200 y farmacia 400": la palabra del medio es de otra categoría, son dos gastos.
    const other = word ? detectCategory(word) : null
    if (other && other !== detectCategory(text.slice(0, a.start))) return { found: found.slice(0, i + 1), cut: a.end }
    const value = Math.round((a.value + b.value) * 100) / 100
    found.splice(i, 2, { ...a, end: b.end, raw: String(value), value, marked: a.marked || b.marked, cents: a.cents || b.cents })
  }
  return { found, cut: null }
}

/**
 * Elige cuál de los números es el monto, dejando fuera las cantidades si hay algo más.
 * Por orden: el que lleva símbolo de moneda, el único con céntimos, el del final,
 * el del principio y, si no, el último.
 */
function pickAmount(text: string, all: Candidate[]): { chosen?: Candidate; doubt: Parsed['doubt'] } {
  const amounts = all.filter((c) => !c.quantity)
  const found = amounts.length ? amounts : all
  const cents = found.filter((c) => c.cents)
  const sure = found.find((c) => c.marked) ?? (cents.length === 1 ? cents[0] : undefined)
  if (sure) return { chosen: sure, doubt: null }
  const chosen =
    found.find((c) => c.end === text.length) ?? found.find((c) => c.start === 0) ?? found[found.length - 1]
  if (found.length > 1) return { chosen, doubt: 'several' }
  // Solo este año o el que viene: 1950 o 2000 son montos corrientes en pesos.
  const year = Number(today().slice(0, 4))
  return { chosen, doubt: chosen && [year, year + 1].includes(Number(chosen.raw)) ? 'year' : null }
}

/**
 * Interpreta una entrada libre como "café 3,50", "ayer 20 cena", "+1500 sueldo" o "-20 cine".
 * `currencies` son las monedas que el usuario maneja; si menciona una ("café 150 pesos") se devuelve.
 */
export function parseEntry(text: string, learned: Record<string, string>, currencies: string[] = []): Parsed {
  let rest = text.trim()
  let kind: Kind = 'expense'
  if (rest.startsWith('+')) {
    kind = 'income'
    rest = rest.slice(1)
  }

  const mention = findCurrency(rest, currencies)
  if (mention) rest = mention.text

  let date = today()
  let dayWord = ''
  rest = rest
    .replace(/(^|\s)(hoy|ayer|anteayer|antier)(?=\s|$)/i, (_, pre: string, word: string) => {
      date = addDays(today(), DAYS[word.toLowerCase()])
      dayWord = word
      return pre
    })
    .replace(/\s+/g, ' ')
    .trim()

  const { found, cut } = candidates(rest)
  // El segundo gasto conserva la fecha escrita ("ayer super 1200 y farmacia 400").
  let next: string | null = null
  if (cut !== null) {
    next = `${dayWord} ${rest.slice(cut).replace(/^\s*(?:y|\+|mas|más)\s+/iu, '')}`.trim()
    rest = rest.slice(0, cut)
  }

  const { chosen, doubt } = pickAmount(rest, found)
  const amount = chosen?.value ?? null
  if (chosen) rest = `${rest.slice(0, chosen.start)} ${rest.slice(chosen.end)}`

  let note = rest.replace(/[€$]/g, '').replace(/\s+/g, ' ').trim()
  note = note.charAt(0).toUpperCase() + note.slice(1)

  const key = normalize(note)
  const remembered = Object.hasOwn(learned, key) && isCategory(learned[key]) ? learned[key] : null
  const detected = remembered ?? detectCategory(note)
  if (detected === 'ingreso') kind = 'income'
  const category = kind === 'income' ? 'ingreso' : (detected ?? 'otros')

  const refundWord = tokenize(note).some((t) => wordForms(t).some((f) => REFUND_WORDS.includes(f)))
  const refund = kind === 'expense' && (refundWord || chosen?.negative === true)

  return {
    amount, kind, refund, note, category, date,
    currency: mention?.code ?? null,
    doubt: amount === null ? null : next !== null ? 'two' : doubt,
    next: amount === null ? null : next,
  }
}
