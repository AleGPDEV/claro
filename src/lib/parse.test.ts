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
    ['uber 10 y 5 propina', 15, 'Uber y propina'],
    ['super 1.200 + 350', 1550, 'Super'],
    ['cena 30 más 5', 35, 'Cena'],
    ['almuerzo 450 y propina 50', 500, 'Almuerzo y propina'],
    ['café 3,50 y 2 medialunas', 3.5, 'Café y 2 medialunas'],
    ['café 3 y 2 medialunas', 3, 'Café y 2 medialunas'],
    ['pago 3 cuotas 1200', 1200, 'Pago 3 cuotas'],
    ['12 uber 2 personas', 12, 'Uber 2 personas'],
    ['café 150 y medialunas 2', 150, 'Café y medialunas 2'],
    ['uber 10 y taxi 5', 15, 'Uber y taxi'],
    ['alquiler 25000 y luz 3000', 28000, 'Alquiler y luz'],
    ['10 uber y 5 taxi', 15, 'Uber y taxi'],
    ['cena 30+5', 35, 'Cena'],
    ['pan y queso 200', 200, 'Pan y queso'],
    ['uber 10 y 5 propina y 2 peaje', 17, 'Uber y propina y peaje'],
  ])('%s → %d', (text, amount, note) => {
    const p = parse(text)
    expect(p.amount).toBe(amount)
    expect(p.note).toBe(note)
  })

  test('sin número no hay importe', () => expect(parse('café').amount).toBeNull())

  // Con un único número no hay forma de saber que es un año: se toma como monto y se avisa.
  test('dos gastos de categorías distintas no se suman: el segundo queda para después', () => {
    expect(parse('super 1200 y farmacia 400')).toMatchObject({ amount: 1200, note: 'Super', category: 'super', doubt: 'two', next: 'farmacia 400' })
    expect(parse('ayer cena 30 + cine 12')).toMatchObject({ amount: 30, note: 'Cena', date: '2026-10-11', next: 'ayer cine 12' })
    expect(parse('cosas 100 y farmacia 40')).toMatchObject({ amount: 100, next: 'farmacia 40' })
    expect(parse('farmacia 400')).toMatchObject({ amount: 400, category: 'salud', doubt: null, next: null })
    expect(parse('almuerzo 450 y propina 50').next).toBeNull()
    expect(parse('super 1200 y la farmacia 400')).toMatchObject({ amount: 1200, note: 'Super', next: 'la farmacia 400' })
    expect(parse('cine 20 y 2 cervezas')).toMatchObject({ amount: 20, note: 'Cine y 2 cervezas', next: null })
  })

  test('el monto puede ir antes del concepto, y el signo se queda en su tramo', () => {
    expect(parse('1200 super y 400 farmacia')).toMatchObject({ amount: 1200, note: 'Super', category: 'super', next: '400 farmacia' })
    expect(parse('400 farmacia')).toMatchObject({ amount: 400, category: 'salud' })
    expect(parse('+1500 sueldo y super 500')).toMatchObject({ kind: 'income', amount: 1500, note: 'Sueldo', next: 'super 500' })
    expect(parse('super 500')).toMatchObject({ kind: 'expense', amount: 500 })
    expect(parse('-200 devolución amazon y super 300')).toMatchObject({ refund: true, amount: 200, category: 'compras', next: 'super 300' })
    expect(parse('super 300').refund).toBe(false)
  })

  test('tres gastos se anotan de a uno', () => {
    const first = parse('ayer super 1200 y farmacia 400 y cine 600')
    expect(first).toMatchObject({ amount: 1200, date: '2026-10-11', next: 'ayer farmacia 400 y cine 600' })
    const second = parse(first.next!)
    expect(second).toMatchObject({ amount: 400, category: 'salud', date: '2026-10-11', next: 'ayer cine 600' })
    expect(parse(second.next!)).toMatchObject({ amount: 600, category: 'ocio', date: '2026-10-11', next: null })
  })

  test('un único número siempre es el monto, con aviso si coincide con este año o el siguiente', () => {
    expect(parse('concierto 2027').doubt).toBe('year')
    for (const text of ['nafta 2000', 'super 1950', '4 amigos asado 2000', 'viaje 2028']) expect(parse(text).doubt).toBeNull()
    expect(parse('concierto 2026')).toMatchObject({ amount: 2026, doubt: 'year' })
    expect(parse('concierto $2026').doubt).toBeNull()
    expect(parse('concierto 2026 80').doubt).toBe('several')
    expect(parse('alquiler 2500').doubt).toBeNull()
  })

  test('avisa cuando elige entre varios números por su posición', () => {
    expect(parse('uber 12 a las 3').doubt).toBe('several')
    // Una cantidad ("4 amigos") no compite con el monto, así que no hay duda.
    expect(parse('20 cena con 4 amigos').doubt).toBeNull()
    expect(parse('2 cafés 7').doubt).toBeNull()
    expect(parse('2 cafés')).toMatchObject({ amount: 2, doubt: null })
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
    expect(parseEntry('almuerzo $450', {}, both)).toMatchObject({ amount: 450, currency: 'UYU', note: 'Almuerzo' })
    expect(parseEntry('entradas u$s 45 para 2', {}, both)).toMatchObject({ amount: 45, currency: 'USD', note: 'Entradas para 2', doubt: null })
    expect(parseEntry('-500 pesos devolución', {}, both)).toMatchObject({ amount: 500, currency: 'UYU', refund: true })
  })
  test('al partir la línea, cada tramo conserva su moneda', () => {
    const first = parseEntry('super 30 y farmacia 10 usd', {}, both)
    expect(first).toMatchObject({ amount: 30, currency: null, note: 'Super', next: 'farmacia 10 usd' })
    expect(parseEntry(first.next!, {}, both)).toMatchObject({ amount: 10, currency: 'USD', note: 'Farmacia', category: 'salud' })

    const reversed = parseEntry('farmacia 10 usd y super 900', {}, both)
    expect(reversed).toMatchObject({ amount: 10, currency: 'USD', next: 'super 900' })
    expect(parseEntry(reversed.next!, {}, both)).toMatchObject({ amount: 900, currency: null })

    const pesos = parseEntry('super 1200 pesos y farmacia u$s 10', {}, both)
    expect(pesos).toMatchObject({ amount: 1200, currency: 'UYU', note: 'Super', next: 'farmacia u$s 10' })
  })

  test('misma categoría en monedas distintas: no se suman', () => {
    expect(parseEntry('alquiler 500 usd y luz 3000 pesos', {}, both)).toMatchObject({ amount: 500, currency: 'USD', note: 'Alquiler', next: 'luz 3000 pesos' })
    expect(parseEntry('uber 10 usd y 5 usd propina', {}, both)).toMatchObject({ amount: 15, currency: 'USD', note: 'Uber y propina', next: null })
    // Si solo un tramo dice la moneda no se sabe en cuál está el otro: tampoco se suman.
    expect(parseEntry('alquiler 20000 y luz 50 usd', {}, both)).toMatchObject({ amount: 20000, currency: null, next: 'luz 50 usd' })
    expect(parseEntry('alquiler 500 usd y luz 3000', {}, both)).toMatchObject({ amount: 500, currency: 'USD', next: 'luz 3000' })
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
    ['copas', 'comida'],
  ])('%s → %s', (text, id) => expect(detectCategory(text)).toBe(id))

  test.each(['constructor', 'toString', '__proto__', 'xyz', 'cursor', 'restaurar'])('"%s" no tiene categoría', (text) => {
    expect(detectCategory(text)).toBeNull()
    expect(parse(`${text} 5000`).category).toBe('otros')
  })

  test('lo aprendido manda sobre lo deducido', () => expect(parse('uber 12', { uber: 'viajes' }).category).toBe('viajes'))
  test('se ignora una categoría aprendida que no existe', () => expect(parse('uber 12', { uber: 'nope' }).category).toBe('transporte'))
})
