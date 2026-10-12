import { cat } from './categories'
import type { Tx } from './types'

// "-5 propina" o "+10 extra" son un número y texto llano: Excel no los evalúa.
const PLAIN_SIGNED = /^[+-][\d.,]*(\s[\p{L}\p{N}\s.,]*)?$/u
const looksLikeFormula = (s: string) => /^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !PLAIN_SIGNED.test(s))

/** Texto entre comillas; si puede ser una fórmula, se neutraliza para que Excel no la ejecute. */
const cell = (s: string) => `"${(looksLikeFormula(s) ? `'${s}` : s).replace(/"/g, '""')}"`

/**
 * CSV que Excel abre bien según el idioma: con BOM para los acentos y, donde el decimal
 * es una coma, con punto y coma como separador de columnas.
 */
export function toCsv(txs: Tx[], decimal: string) {
  const sep = decimal === ',' ? ';' : ','
  const rows = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => {
      const type = t.kind === 'income' ? 'ingreso' : t.amount < 0 ? 'devolución' : 'gasto'
      return [t.date, type, String(t.amount).replace('.', decimal), cell(cat(t.category).name), cell(t.note)].join(sep)
    })
  return '﻿' + [['fecha', 'tipo', 'monto', 'categoria', 'nota'].join(sep), ...rows].join('\r\n')
}
