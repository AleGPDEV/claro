export type Kind = 'expense' | 'income'
export type Every = 'week' | 'month' | 'year'

export interface Tx {
  id: string
  kind: Kind
  /** En la moneda `currency`. En gastos puede ser negativo: una devolución resta de su categoría. */
  amount: number
  currency: string
  /**
   * Tipo de cambio con el que se anotó, si no estaba en la moneda principal:
   * unidades de `currency` por 1 de la principal. Así el histórico no cambia al actualizar el cambio.
   */
  rate?: number
  category: string
  note: string
  /** Fecha local YYYY-MM-DD */
  date: string
  recurringId?: string
}

export interface Recurring {
  id: string
  kind: Kind
  name: string
  amount: number
  currency: string
  category: string
  every: Every
  start: string
  /** Número de cobros ya generados desde `start` */
  done: number
}

export interface Settings {
  /** Moneda principal: en ella se muestran los totales, el presupuesto y el ingreso. */
  currency: string
  /** Segunda moneda, o '' si la app se usa con una sola. */
  second: string
  /** Unidades de la segunda moneda por 1 de la principal; 0 si aún no se indicó. */
  rate: number
  /** Moneda que se asume al cargar un movimiento sin indicarla. */
  entryCurrency: string
  budget: number
  income: number
  weeklyHours: number
  theme: 'auto' | 'light' | 'dark'
  onboarded: boolean
  /** Fecha de la última copia descargada, o '' si nunca se hizo. */
  lastBackup: string
  /** A partir de qué día se vuelve a recordar hacer una copia. */
  backupReminder: string
}

export interface State {
  txs: Tx[]
  recurring: Recurring[]
  /** Nota normalizada → categoría elegida por el usuario */
  learned: Record<string, string>
  settings: Settings
}

/** Un movimiento con su valor ya convertido a la moneda principal. */
export type Entry = Tx & { value: number }
