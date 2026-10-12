import { cat } from '../lib/categories'
import { dayLabel } from '../lib/dates'
import { useMoney, useStore } from '../lib/store'
import type { Entry } from '../lib/types'

export default function TxList({ txs, onEdit, showDays = true }: { txs: Entry[]; onEdit: (tx: Entry) => void; showDays?: boolean }) {
  const money = useMoney()
  const main = useStore().settings.currency
  const days = new Map<string, Entry[]>()
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
              <span>{money(list.reduce((s, t) => (t.kind === 'expense' ? s + t.value : s), 0))}</span>
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
                <span className={`tx-amount stack ${incoming ? 'income' : ''}`}>
                  {incoming ? '+' : ''}{money(Math.abs(t.amount), false, t.currency)}
                  {t.currency !== main && <small className="muted">≈ {money(Math.abs(t.value))}</small>}
                </span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}
