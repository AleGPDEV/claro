import { detectCategory, normalize } from './categories'
import { addDays, today } from './dates'
import type { Kind } from './types'

export interface Parsed {
  amount: number | null
  kind: Kind
  note: string
  category: string
  date: string
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
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

const NUMBER = /\d+(?:[.,]\d+)*/g
const DAYS: Record<string, number> = { hoy: 0, ayer: -1, anteayer: -2 }

/** Interpreta una entrada libre como "café 3,50", "ayer 20 cena" o "+1500 nómina". */
export function parseEntry(text: string, learned: Record<string, string>): Parsed {
  let rest = text.trim()
  let kind: Kind = 'expense'
  if (rest.startsWith('+')) {
    kind = 'income'
    rest = rest.slice(1)
  }

  let date = today()
  rest = rest.replace(/(^|\s)(hoy|ayer|anteayer)(?=\s|$)/i, (_, pre: string, word: string) => {
    date = addDays(today(), DAYS[word.toLowerCase()])
    return pre
  })

  // Si empieza por un número, ese es el importe; si no, el último número del texto.
  const numbers = [...rest.matchAll(NUMBER)]
  const leading = numbers[0] && rest.trimStart().startsWith(numbers[0][0])
  const match = leading ? numbers[0] : numbers[numbers.length - 1]
  const amount = match ? parseAmount(match[0]) : null
  if (match) rest = rest.slice(0, match.index) + rest.slice(match.index! + match[0].length)

  let note = rest.replace(/[€$]/g, '').replace(/\s+/g, ' ').trim()
  note = note.charAt(0).toUpperCase() + note.slice(1)

  const detected = learned[normalize(note)] ?? detectCategory(note)
  if (detected === 'ingreso') kind = 'income'
  const category = kind === 'income' ? 'ingreso' : (detected ?? 'otros')

  return { amount, kind, note, category, date }
}
