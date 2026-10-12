import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import { detectCategory } from './categories'
import { parseAmount, parseEntry } from './parse'

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 12, 12))
})
afterAll(() => {
  vi.useRealTimers()
})

const parse = (text: string, learned: Record<string, string> = {}) => parseEntry(text, learned)

describe('parseAmount', () => {
  test.each([
    ['3,50', 3.5],
    ['3.50', 3.5],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.500', 1500],
    ['0.125', 0.13],
    ['12', 12],
  ])('%s → %d', (raw, expected) => expect(parseAmount(raw)).toBe(expected))

  test.each(['', 'abc', '0'])('"%s" no es un importe', (raw) => expect(parseAmount(raw)).toBeNull())
})

describe('qué número es el importe', () => {
  test.each([
    ['café 3,50', 3.5, 'Café'],
    ['12 uber', 12, 'Uber'],
    ['2 cafés 3,50', 3.5, '2 cafés'],
    ['2 cafés 7', 7, '2 cafés'],
    ['café 3 50', 3.5, 'Café'],
    ['20 cena con 4 amigos', 20, 'Cena con 4 amigos'],
    ['concierto 2026 80', 80, 'Concierto 2026'],
    ['entradas $45 para 2', 45, 'Entradas para 2'],
    ['cena 30€', 30, 'Cena'],
    ['alquiler 1.500', 1500, 'Alquiler'],
    ['pilas x2 8', 8, 'Pilas x2'],
    ['uber 10 y 5 propina', 15, 'Uber propina'],
    ['super 1.200 + 350', 1550, 'Super'],
    ['cena 30 más 5', 35, 'Cena'],
  ])('%s → %d', (text, amount, note) => {
    const p = parse(text)
    expect(p.amount).toBe(amount)
    expect(p.note).toBe(note)
  })

  test('sin número no hay importe', () => expect(parse('café').amount).toBeNull())

  // Con un único número no hay forma de saber que es un año: se toma como monto y se avisa.
  test('un único número siempre es el monto, con aviso si parece un año', () => {
    expect(parse('concierto 2026')).toMatchObject({ amount: 2026, doubt: 'year' })
    expect(parse('concierto $2026').doubt).toBeNull()
    expect(parse('concierto 2026 80').doubt).toBe('several')
    expect(parse('alquiler 2500').doubt).toBeNull()
  })

  test('avisa cuando elige entre varios números por su posición', () => {
    expect(parse('20 cena con 4 amigos').doubt).toBe('several')
    expect(parse('2 cafés 3,50').doubt).toBeNull()
    expect(parse('café 3,50').doubt).toBeNull()
    expect(parse('café').doubt).toBeNull()
  })
})

describe('fecha', () => {
  test('por defecto, hoy', () => expect(parse('café 3').date).toBe('2026-10-12'))
  test('ayer', () => {
    const p = parse('ayer 20 cena')
    expect(p).toMatchObject({ date: '2026-10-11', amount: 20, note: 'Cena' })
  })
  test('anteayer', () => expect(parse('taxi 9 anteayer').date).toBe('2026-10-10'))
})

describe('moneda', () => {
  const both = ['USD', 'UYU']
  test('sin mención no hay moneda', () => expect(parseEntry('taxi 20', {}, both).currency).toBeNull())
  test('la mención marca el monto y sale de la nota', () => {
    expect(parseEntry('café 150 pesos', {}, both)).toMatchObject({ amount: 150, currency: 'UYU', note: 'Café', category: 'comida' })
    expect(parseEntry('20usd uber', {}, both)).toMatchObject({ amount: 20, currency: 'USD', note: 'Uber' })
    expect(parseEntry('entradas u$s 45 para 2', {}, both)).toMatchObject({ amount: 45, currency: 'USD', note: 'Entradas para 2', doubt: null })
    expect(parseEntry('-500 pesos devolución', {}, both)).toMatchObject({ amount: 500, currency: 'UYU', refund: true })
  })
  test('con una sola moneda, "pesos" es parte de la nota', () =>
    expect(parseEntry('café 150 pesos', {}, ['USD'])).toMatchObject({ amount: 150, currency: null, note: 'Café pesos' }))
})

describe('ingresos y devoluciones', () => {
  test('"+" marca un ingreso', () => expect(parse('+1500 extra')).toMatchObject({ kind: 'income', category: 'ingreso', amount: 1500 }))
  test('"sueldo" es un ingreso', () => expect(parse('sueldo 50000').kind).toBe('income'))
  test('un bizum no es un ingreso', () => expect(parse('bizum 20 a Juan')).toMatchObject({ kind: 'expense', amount: 20, refund: false }))
  test('"-" marca una devolución', () => expect(parse('-20 cine')).toMatchObject({ refund: true, amount: 20, note: 'Cine', category: 'ocio' }))
  test('"devolución" marca una devolución en su categoría', () =>
    expect(parse('devolución amazon 30')).toMatchObject({ kind: 'expense', refund: true, amount: 30, category: 'compras' }))
  test('un gasto normal no es devolución', () => expect(parse('cine 20').refund).toBe(false))
})

describe('categorías', () => {
  test.each([
    ['cafés', 'comida'],
    ['taxis', 'transporte'],
    ['uber', 'transporte'],
    ['uber eats', 'comida'],
    ['pedidosya', 'comida'],
    ['Pedidos Ya', 'comida'],
    ['nafta', 'transporte'],
    ['boleto', 'transporte'],
    ['UTE', 'hogar'],
    ['seguro auto', 'transporte'],
    ['seguro médico', 'salud'],
    ['mercado', 'super'],
    ['mercado libre', 'compras'],
    ['compras', 'compras'],
    ['compra', 'super'],
    ['caña', 'comida'],
    ['netflix', 'suscripciones'],
    ['pago resto alquiler', 'hogar'],
    ['matrícula del auto', 'transporte'],
    ['matrícula facultad', 'educacion'],
    ['luces', 'hogar'],
    ['copa de vino', 'comida'],
    ['copas', 'ocio'],
  ])('%s → %s', (text, id) => expect(detectCategory(text)).toBe(id))

  test.each(['constructor', 'toString', '__proto__', 'xyz', 'cursor', 'restaurar'])('"%s" no tiene categoría', (text) => {
    expect(detectCategory(text)).toBeNull()
    expect(parse(`${text} 5000`).category).toBe('otros')
  })

  test('lo aprendido manda sobre lo deducido', () => expect(parse('uber 12', { uber: 'viajes' }).category).toBe('viajes'))
  test('se ignora una categoría aprendida que no existe', () => expect(parse('uber 12', { uber: 'nope' }).category).toBe('transporte'))
})
