import { describe, expect, test } from 'vitest'
import { toCsv } from './csv'
import { findCurrency, flipRate, monthlyValue, quote, quoted, toMain } from './fx'
import { guessCurrency } from './locale'
import { dueCount, MAX_CATCH_UP, materialize, sanitize } from './model'
import type { Entry, Settings, Tx } from './types'

const tx = (over: Partial<Tx> = {}) => ({ id: 'a', kind: 'expense', amount: 10, category: 'comida', note: 'Café', date: '2026-10-12', ...over })
const entry = (over: Partial<Entry> = {}) => ({ ...tx(), currency: 'USD', value: over.amount ?? 10, ...over }) as Entry
const usdUyu = { ...sanitize(null, 'USD', 'UYU').settings, rate: 40 } satisfies Settings

describe('sanitize', () => {
  test('datos vacíos o basura dan un estado inicial', () => {
    expect(sanitize(null, 'UYU').settings.currency).toBe('UYU')
    expect(sanitize('x', 'UYU').txs).toEqual([])
  })

  test('descarta fechas que no existen', () => {
    const s = sanitize({ txs: [tx({ date: '2026-13-45' }), tx({ id: 'b', date: '2026-02-30' }), tx({ id: 'c' })] }, 'USD')
    expect(s.txs.map((t) => t.id)).toEqual(['c'])
  })

  test('los ids repetidos dejan de estarlo', () => {
    const s = sanitize({ txs: [tx(), tx(), tx()], recurring: [] }, 'USD')
    expect(new Set(s.txs.map((t) => t.id)).size).toBe(3)
    expect(s.txs[0].id).toBe('a')
  })

  test('descarta importes inválidos y conserva las devoluciones', () => {
    const s = sanitize({ txs: [tx({ amount: 0 }), tx({ id: 'b', amount: -5 }), tx({ id: 'c', amount: NaN }), tx({ id: 'd', kind: 'income', amount: -5 })] }, 'USD')
    expect(s.txs.map((t) => t.id)).toEqual(['b'])
  })

  test('descarta montos fuera de rango, también en devoluciones', () => {
    const s = sanitize({ txs: [tx({ amount: -100_000_000_000 }), tx({ id: 'b', amount: 100_000_000_000 }), tx({ id: 'c', amount: -500 })] }, 'USD')
    expect(s.txs.map((t) => t.id)).toEqual(['c'])
  })

  test('una categoría desconocida pasa a Otros', () => {
    expect(sanitize({ txs: [tx({ category: 'constructor' })] }, 'USD').txs[0].category).toBe('otros')
  })

  test('lo aprendido no puede tocar el prototipo', () => {
    const s = sanitize(JSON.parse('{"learned":{"__proto__":"comida","uber":"viajes","x":"nope"}}'), 'USD')
    expect(Object.keys(s.learned).sort()).toEqual(['__proto__', 'uber'])
    expect(Object.getPrototypeOf(s.learned)).toBe(Object.prototype)
  })
})

describe('fijos', () => {
  test('cuenta los cobros vencidos', () => {
    expect(dueCount('2026-10-13', 'month', '2026-10-12')).toBe(0)
    expect(dueCount('2026-10-12', 'month', '2026-10-12')).toBe(1)
    expect(dueCount('2026-05-31', 'month', '2026-10-12')).toBe(5)
    expect(dueCount('2026-09-28', 'week', '2026-10-12')).toBe(3)
  })

  test('genera los movimientos vencidos una sola vez', () => {
    const base = sanitize({ recurring: [{ id: 'r', kind: 'expense', name: 'Alquiler', amount: 650, category: 'hogar', every: 'month', start: '2026-08-31', done: 0 }] }, 'USD')
    const once = materialize(base, '2026-10-12')
    expect(once.txs.map((t) => t.date)).toEqual(['2026-08-31', '2026-09-30'])
    expect(materialize(once, '2026-10-12')).toBe(once)
  })

  test('una fecha muy antigua registra como mucho el tope, también en pasadas siguientes', () => {
    const old = sanitize({ recurring: [{ id: 'r', kind: 'expense', name: 'Gym', amount: 10, category: 'salud', every: 'week', start: '1990-01-01', done: 0 }] }, 'USD')
    expect(dueCount('1990-01-01', 'week', '2026-10-12')).toBe(MAX_CATCH_UP)
    const once = materialize(old, '2026-10-12')
    expect(once.txs).toHaveLength(MAX_CATCH_UP)
    expect(materialize(once, '2026-10-12')).toBe(once)
    expect(materialize(once, '2026-10-19').txs).toHaveLength(MAX_CATCH_UP + 1)
  })
})

describe('dos monedas', () => {
  test('convierte a la principal con el cambio actual o con el guardado', () => {
    expect(toMain(100, 'USD', undefined, usdUyu)).toBe(100)
    expect(toMain(4000, 'UYU', undefined, usdUyu)).toBe(100)
    expect(toMain(4000, 'UYU', 50, usdUyu)).toBe(80)
    // Una moneda que ya no se usa y sin cambio guardado: no hay cómo convertirla.
    expect(toMain(500, 'ARS', undefined, usdUyu)).toBe(500)
  })

  test('el cambio se muestra con la moneda fuerte a la izquierda', () => {
    expect(quote('USD', 'UYU')).toMatchObject({ base: 'USD', counter: 'UYU', inverted: false })
    expect(quote('UYU', 'USD')).toMatchObject({ base: 'USD', counter: 'UYU', inverted: true })
    expect(quoted(flipRate(40), true)).toBe(40)
  })

  test('los fijos se suman en la principal', () => {
    const r = { id: 'r', kind: 'expense', name: 'Alquiler', amount: 20000, currency: 'UYU', category: 'hogar', every: 'month', start: '2026-10-01', done: 0 } as const
    expect(monthlyValue(r, usdUyu)).toBe(500)
  })

  test('reconoce la moneda mencionada', () => {
    expect(findCurrency('café 150 pesos', ['USD', 'UYU'])?.code).toBe('UYU')
    expect(findCurrency('20usd uber', ['USD', 'UYU'])?.code).toBe('USD')
    expect(findCurrency('u$s 20 taxi', ['USD', 'UYU'])).toEqual({ code: 'USD', text: '$ 20 taxi' })
    expect(findCurrency('cambié dólares', ['USD', 'UYU'])?.code).toBe('USD')
    expect(findCurrency('taxi $20', ['USD', 'UYU'])).toBeNull()
    expect(findCurrency('café 150 pesos', ['USD'])).toBeNull()
    expect(findCurrency('pesas 20', ['USD', 'UYU'])).toBeNull()
  })

  test('los datos sin moneda estaban en la principal', () => {
    const s = sanitize({ txs: [tx(), tx({ id: 'b', currency: 'UYU', rate: 40 })], settings: { currency: 'UYU', second: 'UYU' } }, 'USD')
    expect(s.txs.map((t) => t.currency)).toEqual(['UYU', 'UYU'])
    expect(s.settings).toMatchObject({ currency: 'UYU', second: '', rate: 0, entryCurrency: 'UYU' })
  })

  test('un fijo en la segunda moneda guarda el cambio del día', () => {
    const base = sanitize({ recurring: [{ id: 'r', kind: 'expense', name: 'UTE', amount: 2000, currency: 'UYU', category: 'hogar', every: 'month', start: '2026-10-05', done: 0 }], settings: { currency: 'USD', second: 'UYU', rate: 40 } }, 'USD')
    expect(materialize(base, '2026-10-12').txs[0]).toMatchObject({ amount: 2000, currency: 'UYU', rate: 40 })
  })
})

describe('moneda por defecto', () => {
  test('la zona horaria decide aunque el idioma no tenga país', () => {
    expect(guessCurrency(['es'], 'America/Montevideo')).toBe('UYU')
    expect(guessCurrency(['es-419'], 'America/Argentina/Cordoba')).toBe('ARS')
  })
  test('si no, el país del idioma', () => expect(guessCurrency(['es', 'es-ES'], 'Etc/UTC')).toBe('EUR'))
  test('y si nada ayuda, USD', () => expect(guessCurrency(['es-419'], 'Etc/UTC')).toBe('USD'))
})

describe('CSV', () => {
  const rows = [entry({ note: '=HYPERLINK("x")' }), entry({ id: 'b', amount: -140, currency: 'UYU', value: -3.5, note: 'Devolución "café"' })]

  test('en español: BOM, punto y coma y coma decimal', () => {
    const csv = toCsv(rows, ',', 'USD')
    expect(csv.startsWith('﻿fecha;tipo;monto;moneda;en_USD;categoria;nota\r\n')).toBe(true)
    expect(csv).toContain('2026-10-12;devolución;-140;UYU;-3,5;"Comida";"Devolución ""café"""')
  })

  test('una nota que parece una fórmula se neutraliza', () => {
    expect(toCsv(rows, '.', 'USD')).toContain(`2026-10-12,gasto,10,USD,10,"Comida","'=HYPERLINK(""x"")"`)
    const risky = ["-2+3+cmd|' /C calc'!A0", '+SUM(A1:A9)', '@SUM(1)', '-A1']
    for (const note of risky) expect(toCsv([entry({ note })], '.', 'USD')).toContain(`,"'${note.replace(/"/g, '""')}"`)
  })

  test('un signo seguido de número y texto llano no lleva apóstrofo', () => {
    for (const note of ['-5 test', '+10 extra', '-3,50 propina'])
      expect(toCsv([entry({ note })], '.', 'USD')).toContain(`,"${note}"`)
  })
})
