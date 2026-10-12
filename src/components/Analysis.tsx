import { useState } from 'react'
import { cat } from '../lib/categories'
import { addDays, diffDays, parseDate, today } from '../lib/dates'
import { buckets, byCategory, compare, dailyTotals, range, shift, sum, type Period, type PeriodKind } from '../lib/stats'
import { useMoney, useStore } from '../lib/store'
import type { Tx } from '../lib/types'
import { Delta } from './Today'
import TxList from './TxList'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
]

function Heatmap({ txs, year }: { txs: Tx[]; year: number }) {
  const money = useMoney()
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const totals = dailyTotals(txs, from, to)
  const sorted = [...totals.values()].sort((a, b) => a - b)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
  const cuts = [q(0.25), q(0.5), q(0.75)]
  const t = today()
  const offset = (parseDate(from).getDay() + 6) % 7
  const days = Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i))

  return (
    <>
      <div className="heat" role="img" aria-label={`Gasto diario de ${year}`}>
        {Array.from({ length: offset }, (_, i) => <i key={i} className="pad" />)}
        {days.map((date) => {
          const v = totals.get(date) ?? 0
          const level = v === 0 ? 0 : 1 + cuts.filter((c) => v > c).length
          const label = parseDate(date).toLocaleDateString('es', { day: 'numeric', month: 'short' })
          return <i key={date} className={date > t ? 'future' : `l${level}`} title={date > t ? label : `${label} · ${money(v)}`} />
        })}
      </div>
      <div className="heat-legend muted small">
        Menos <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> Más
      </div>
    </>
  )
}

export default function Analysis({ period, setPeriod, onEdit }: { period: Period; setPeriod: (p: Period) => void; onEdit: (tx: Tx) => void }) {
  const { txs } = useStore()
  const money = useMoney()
  const [selected, setSelected] = useState<number | null>(null)
  const [limit, setLimit] = useState(30)

  const r = range(period)
  const { total, delta, days } = compare(period, txs)
  const income = sum(txs, r.from, r.to, 'income')
  const bars = buckets(period, txs)
  const max = Math.max(...bars.map((b) => b.value), 1)
  const cats = byCategory(txs, r.from, r.to)
  const isCurrent = today() >= r.from && today() <= r.to
  const focus = selected !== null ? bars[selected] : null
  const list = txs.filter((x) => x.date >= (focus?.from ?? r.from) && x.date <= (focus?.to ?? r.to))

  const change = (p: Period) => {
    setSelected(null)
    setLimit(30)
    setPeriod(p)
  }

  return (
    <>
      <div className="segmented" role="tablist">
        {KINDS.map((k) => (
          <button key={k.id} role="tab" aria-selected={period.kind === k.id} className={period.kind === k.id ? 'on' : ''} onClick={() => change({ kind: k.id, anchor: today() })}>
            {k.label}
          </button>
        ))}
      </div>

      <div className="pager">
        <button onClick={() => change(shift(period, -1))} aria-label="Anterior">‹</button>
        <span>{r.label}</span>
        <button onClick={() => change(shift(period, 1))} disabled={isCurrent} aria-label="Siguiente">›</button>
      </div>

      <section className="hero">
        <span className="label">Gastado</span>
        <strong className="big">{money(total)}</strong>
        <span className="muted small">
          <Delta value={delta} /> {delta !== null && 'frente al periodo anterior · '}
          {money(total / (isCurrent ? days : diffDays(r.from, r.to) + 1), true)} al día
        </span>
      </section>

      {income > 0 && (
        <section className="tiles two">
          <div>
            <span className="label">Ingresos</span>
            <strong>{money(income, true)}</strong>
          </div>
          <div>
            <span className="label">Balance</span>
            <strong className={income - total < 0 ? 'over' : ''}>{money(income - total, true)}</strong>
            <small className="muted">{income - total > 0 ? `ahorras el ${Math.round(((income - total) / income) * 100)}%` : 'gastas más de lo que entra'}</small>
          </div>
        </section>
      )}

      <section className="card">
        <h2>
          {focus ? focus.title : period.kind === 'year' ? 'Por mes' : 'Por día'}
          <span className="muted">{focus ? money(focus.value) : ''}</span>
        </h2>
        <div className={`bars n${bars.length > 12 ? 'many' : 'few'}`}>
          {bars.map((b, i) => (
            <button
              key={b.from}
              className={`${selected === i ? 'sel' : ''} ${b.current ? 'cur' : ''}`}
              title={`${b.title} · ${money(b.value)}`}
              aria-label={`${b.title}: ${money(b.value)}`}
              aria-pressed={selected === i}
              onClick={() => setSelected(selected === i ? null : i)}
            >
              <span className="track">
                <i style={{ height: `${(b.value / max) * 100}%` }} className={b.value === 0 ? 'zero' : ''} />
              </span>
              <small>{b.tick}</small>
            </button>
          ))}
        </div>
      </section>

      {period.kind === 'year' && (
        <section className="card">
          <h2>Cada día del año</h2>
          <Heatmap txs={txs} year={Number(r.from.slice(0, 4))} />
        </section>
      )}

      {cats.length > 0 && (
        <section className="card">
          <h2>En qué</h2>
          <ul className="cats">
            {cats.map((c) => (
              <li key={c.id}>
                <span aria-hidden="true">{cat(c.id).icon}</span>
                <div>
                  <p>
                    <span>{cat(c.id).name}</span>
                    <span>{money(c.total, true)} <small className="muted">{Math.round((c.total / total) * 100)}%</small></span>
                  </p>
                  <div className="catbar"><i style={{ width: `${(c.total / cats[0].total) * 100}%` }} /></div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Movimientos {focus && <button className="link" onClick={() => setSelected(null)}>ver todo el periodo</button>}</h2>
        {list.length === 0 ? (
          <p className="muted">Sin movimientos.</p>
        ) : (
          <>
            <TxList txs={[...list].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)} onEdit={onEdit} />
            {list.length > limit && <button className="link more" onClick={() => setLimit(limit + 50)}>Ver más ({list.length - limit})</button>}
          </>
        )}
      </section>
    </>
  )
}
