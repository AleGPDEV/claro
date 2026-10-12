import { addDays, addMonths, today } from './dates'
import type { State, Tx } from './types'

const SAMPLES: [note: string, category: string, min: number, max: number][] = [
  ['Café', 'comida', 1.5, 4],
  ['Café', 'comida', 1.5, 4],
  ['Menú del día', 'comida', 11, 16],
  ['Cena', 'comida', 18, 45],
  ['Supermercado', 'super', 15, 80],
  ['Panadería', 'super', 2, 6],
  ['Metro', 'transporte', 1.5, 3],
  ['Uber', 'transporte', 7, 18],
  ['Gasolina', 'transporte', 35, 60],
  ['Cine', 'ocio', 8, 12],
  ['Copas', 'ocio', 12, 40],
  ['Farmacia', 'salud', 5, 25],
  ['Ropa', 'compras', 20, 90],
  ['Amazon', 'compras', 9, 60],
]

/** Cinco meses de movimientos de ejemplo, escalados al presupuesto del usuario. */
export function demoData(state: State): State {
  const scale = state.settings.budget > 0 ? state.settings.budget / 1500 : 1
  const round = (n: number) => Math.max(1, scale >= 20 ? Math.round(n) : Math.round(n * 100) / 100)
  const t = today()
  const txs: Tx[] = []
  for (let i = 0; i < 150; i++) {
    const date = addDays(t, -i)
    const count = Math.floor(Math.random() * 4)
    for (let j = 0; j < count; j++) {
      const [note, category, min, max] = SAMPLES[Math.floor(Math.random() * SAMPLES.length)]
      const amount = round((min + Math.random() * (max - min)) * scale)
      txs.push({ id: crypto.randomUUID(), kind: 'expense', amount, category, note, date })
    }
  }
  const start = addMonths(t.slice(0, 8) + '01', -4)
  const fixed = (name: string, amount: number, category: string, day: number, kind: 'expense' | 'income' = 'expense') => ({
    id: crypto.randomUUID(), kind, name, amount: round(amount * scale), category, every: 'month' as const, start: addDays(start, day), done: 0,
  })
  return {
    ...state,
    txs,
    recurring: [
      fixed('Sueldo', 2100, 'ingreso', 0, 'income'),
      fixed('Alquiler', 650, 'hogar', 1),
      fixed('Internet', 38, 'hogar', 4),
      fixed('Gimnasio', 35, 'salud', 2),
      fixed('Netflix', 13.99, 'suscripciones', 9),
      fixed('Spotify', 10.99, 'suscripciones', 14),
    ],
  }
}
