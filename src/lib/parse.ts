import { detectCategory, isCategory, normalize, tokenize, wordForms } from './categories'
import { addDays, today } from './dates'
import { findCurrency, maskCurrencies } from './fx'
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
  /** Con dos gastos en una línea ("super 1200 y farmacia 400"), el texto del segundo tal como se escribió. */
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
/** Palabra que une dos tramos: "super 1200 y farmacia 400", "cena 30 + 5", "20 más 5". */
const JOINER = /^(?:y|\+|mas|más)$/i

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
const isPlural = (word: string | undefined) => word !== undefined && /^\p{L}{3,}s$/iu.test(word) && !NOT_PLURAL.includes(word.toLowerCase())

/**
 * Un entero pequeño (hasta 31, sin símbolo ni signo) que cuenta cosas: va seguido de un plural
 * ("2 medialunas", "4 amigos") o sigue a un plural que abre el tramo ("y medialunas 2").
 */
function isQuantity(text: string, c: Pick<Candidate, 'start' | 'end' | 'raw' | 'marked' | 'negative'>) {
  if (c.marked || c.negative || !/^\d{1,2}$/.test(c.raw) || Number(c.raw) > 31) return false
  const after = text.slice(c.end).match(/^\s+(\p{L}+)(?!\p{L})/u)?.[1]
  const before = text.slice(0, c.start).match(/(?:^|(?:^|\s)(?:y|\+|mas|más)\s+)(\p{L}+)\s+$/iu)?.[1]
  return isPlural(after) || isPlural(before)
}

/** Los números del texto que pueden ser el monto. */
function candidates(text: string): Candidate[] {
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
  return found
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

interface Group {
  from: number
  to: number
}

/**
 * Parte las palabras en tramos con monto propio. Un "y", "+" o "más" separa solo si hay un
 * monto a cada lado: en "pan y queso 200" o "café 3,50 y 2 medialunas" forma parte de la nota.
 */
function splitGroups(tokens: string[], currencies: string[]): Group[] {
  const hasAmount = (from: number, to: number) =>
    candidates(maskCurrencies(tokens.slice(from, to).join(' '), currencies)).some((c) => c.value !== null && !c.quantity)
  const groups: Group[] = []
  let from = 0
  for (let i = 1; i < tokens.length - 1; i++) {
    if (!JOINER.test(tokens[i])) continue
    let end = tokens.findIndex((t, j) => j > i && JOINER.test(t))
    if (end < 0) end = tokens.length
    if (i > from && hasAmount(from, i) && hasAmount(i + 1, end)) {
      groups.push({ from, to: i })
      from = i + 1
    }
  }
  groups.push({ from, to: tokens.length })
  return groups
}

/**
 * Interpreta una entrada libre como "café 3,50", "ayer 20 cena", "+1500 sueldo" o "-20 cine".
 * `currencies` son las monedas que el usuario maneja; si menciona una ("café 150 pesos") se devuelve.
 *
 * Una línea con varios tramos ("alquiler 25000 y luz 3000") se suma en un solo movimiento
 * mientras sean de la misma categoría y digan la misma moneda (o ninguna). Donde cambian
 * ("super 1200 y farmacia 400", "super 30 y farmacia 10 usd") la línea se corta: se interpreta lo anterior y el resto
 * se devuelve en `next`, sin tocar, para anotarlo aparte.
 */
export function parseEntry(text: string, learned: Record<string, string>, currencies: string[] = []): Parsed {
  let rest = text.trim()
  let kind: Kind = 'expense'
  if (rest.startsWith('+')) {
    kind = 'income'
    rest = rest.slice(1)
  }

  let date = today()
  let dayWord = ''
  const tokens = rest
    .replace(/(^|\s)(hoy|ayer|anteayer|antier)(?=\s|$)/i, (_, pre: string, word: string) => {
      date = addDays(today(), DAYS[word.toLowerCase()])
      dayWord = word
      return pre
    })
    .replace(/(\d)\+(\d)/g, '$1 + $2')
    .split(/\s+/)
    .filter(Boolean)

  const groups = splitGroups(tokens, currencies)
  const textOf = (g: Group) => tokens.slice(g.from, g.to).join(' ')
  const traits = (g: Group) => ({ category: detectCategory(textOf(g)), currency: findCurrency(textOf(g), currencies)?.code ?? null })
  const head = traits(groups[0])
  let taken = 1
  for (; taken < groups.length; taken++) {
    const t = traits(groups[taken])
    const otherCategory = t.category !== null && t.category !== head.category
    // También si solo uno de los dos dice la moneda: sumar "alquiler 20000 y luz 50 usd" sería un error grande y silencioso.
    if (otherCategory || t.currency !== head.currency) break
  }
  // El segundo gasto conserva la fecha escrita ("ayer super 1200 y farmacia 400").
  const next = taken < groups.length ? `${dayWord} ${tokens.slice(groups[taken].from).join(' ')}`.trim() : null

  let amount: number | null = null
  let currency: string | null = null
  let doubt: Parsed['doubt'] = null
  let negative = false
  const notes: string[] = []
  for (const g of groups.slice(0, taken)) {
    currency ??= findCurrency(textOf(g), currencies)?.code ?? null
    // Cada mención a una moneda pasa a "$", que marca como monto el número de al lado.
    const masked = maskCurrencies(textOf(g), currencies)
    const picked = pickAmount(masked, candidates(masked))
    const { chosen } = picked
    if (chosen && chosen.value !== null) amount = Math.round(((amount ?? 0) + chosen.value) * 100) / 100
    negative ||= chosen?.negative === true
    doubt ??= picked.doubt
    const piece = (chosen ? `${masked.slice(0, chosen.start)} ${masked.slice(chosen.end)}` : masked).replace(/[€$]/g, '').replace(/\s+/g, ' ').trim()
    if (piece) notes.push(piece)
  }

  let note = notes.join(' y ')
  note = note.charAt(0).toUpperCase() + note.slice(1)

  const key = normalize(note)
  const remembered = Object.hasOwn(learned, key) && isCategory(learned[key]) ? learned[key] : null
  const detected = remembered ?? detectCategory(note)
  if (detected === 'ingreso') kind = 'income'
  const category = kind === 'income' ? 'ingreso' : (detected ?? 'otros')

  const refundWord = tokenize(note).some((t) => wordForms(t).some((f) => REFUND_WORDS.includes(f)))
  const refund = kind === 'expense' && (refundWord || negative)

  return {
    amount, kind, refund, note, category, date, currency,
    doubt: amount === null ? null : next !== null ? 'two' : doubt,
    next: amount === null ? null : next,
  }
}
