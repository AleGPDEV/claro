export type Kind = 'expense' | 'income'
export type Every = 'week' | 'month' | 'year'

export interface Tx {
  id: string
  kind: Kind
  /** En gastos puede ser negativo: una devolución resta de su categoría. */
  amount: number
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
  category: string
  every: Every
  start: string
  /** Número de cobros ya generados desde `start` */
  done: number
}

export interface Settings {
  currency: string
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
