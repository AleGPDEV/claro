import { cat } from '../lib/categories'
import { dayLabel } from '../lib/dates'
import { useMoney } from '../lib/store'
import type { Tx } from '../lib/types'

export default function TxList({ txs, onEdit, showDays = true }: { txs: Tx[]; onEdit: (tx: Tx) => void; showDays?: boolean }) {
  const money = useMoney()
  const days = new Map<string, Tx[]>()
  for (const t of [...txs].sort((a, b) => b.date.localeCompare(a.date))) {
    if (!days.has(t.date)) days.set(t.date, [])
    days.get(t.date)!.push(t)
  }

  return (
    <div className="txlist">
      {[...days].map(([date, list]) => (
        <section key={date}>
          {showDays && (
            <h3>
              <span>{dayLabel(date)}</span>
              <span>{money(list.reduce((s, t) => (t.kind === 'expense' ? s + t.amount : s), 0))}</span>
            </h3>
          )}
          {list.map((t) => {
            const c = cat(t.category)
            const refund = t.kind === 'expense' && t.amount < 0
            const incoming = t.kind === 'income' || refund
            return (
              <button key={t.id} className="tx" onClick={() => onEdit(t)}>
                <span className="tx-icon" aria-hidden="true">{c.icon}</span>
                <span className="tx-text">
                  <span>{t.note || c.name}</span>
                  <small>{c.name}{refund ? ' · devolución' : ''}{t.recurringId ? ' · fijo' : ''}</small>
                </span>
                <span className={incoming ? 'tx-amount income' : 'tx-amount'}>
                  {incoming ? '+' : ''}{money(Math.abs(t.amount))}
                </span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}
