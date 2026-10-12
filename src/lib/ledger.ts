import { txValue } from './fx'
import type { Entry, State } from './types'

/** Cada movimiento con su valor en la moneda principal; es lo que usan todos los cálculos. */
export const ledger = (s: Pick<State, 'txs' | 'settings'>): Entry[] =>
  s.txs.map((t) => {
    const value = txValue(t, s.settings)
    return { ...t, value: value ?? 0, unconverted: value === null }
  })
