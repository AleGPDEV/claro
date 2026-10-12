import { useState } from 'react'
import { cat } from '../lib/categories'
import { addDays, diffDays, minDate, parseDate, today } from '../lib/dates'
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

const ARROWS: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }

function Heatmap({ txs, year }: { txs: Tx[]; year: number }) {
  const money = useMoney()
  const [active, setActive] = useState<string | null>(null)
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  const t = today()
  const totals = dailyTotals(txs, from, to)
  const sorted = [...totals.values()].filter((v) => v > 0).sort((a, b) => a - b)
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
  const cuts = [q(0.25), q(0.5), q(0.75)]
  const offset = (parseDate(from).getDay() + 6) % 7
  const days = Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i))
  const start = minDate(to, t) < from ? from : minDate(to, t)

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = ARROWS[e.key]
    if (!step) return
    e.preventDefault()
    const next = active ? addDays(active, step) : start
    if (next >= from && next <= to) setActive(next)
  }

  return (
    <>
      <div
        className="heat"
        tabIndex={0}
        role="group"
        aria-label={`Gasto de cada día de ${year}. Usá las flechas para recorrer los días.`}
        onKeyDown={onKeyDown}
        onFocus={() => active ?? setActive(start)}
      >
        {Array.from({ length: offset }, (_, i) => <i key={i} className="pad" />)}
        {days.map((date) => {
          const v = totals.get(date) ?? 0
          const level = v <= 0 ? 0 : 1 + cuts.filter((c) => v > c).length
          return (
            <i
              key={date}
              className={`${date > t ? 'future' : `l${level}`} ${date === active ? 'act' : ''}`}
              onClick={() => setActive(date)}
              onMouseEnter={() => setActive(date)}
            />
          )
        })}
      </div>
      <div className="heat-foot muted small">
        <span aria-live="polite">
          {active
            ? `${parseDate(active).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })} · ${active > t ? 'todavía no llegó' : money(totals.get(active) ?? 0)}`
            : 'Tocá un día para ver cuánto gastaste.'}
        </span>
        <span className="heat-legend" aria-hidden="true">
          Menos <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> Más
        </span>
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
  const balance = income - total
  const bars = buckets(period, txs)
  const max = Math.max(...bars.map((b) => b.value), 1)
  const cats = byCategory(txs, r.from, r.to)
  // Base del reparto: lo gastado en las categorías, sin restar devoluciones de otras.
  const gross = cats.reduce((s, c) => s + c.total, 0)
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
            <strong className={balance < 0 ? 'over' : ''}>{money(balance, true)}</strong>
            <small className="muted">
              {balance > 0 ? `ahorrás el ${Math.round((balance / income) * 100)}%` : balance === 0 ? 'gastás justo lo que entra' : 'gastás más de lo que entra'}
            </small>
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
                <i style={{ height: `${(Math.max(b.value, 0) / max) * 100}%` }} className={b.value <= 0 ? 'zero' : ''} />
              </span>
              <small>{b.tick}</small>
            </button>
          ))}
        </div>
      </section>

      {period.kind === 'year' && (
        <section className="card">
          <h2>Cada día del año</h2>
          <Heatmap key={r.from} txs={txs} year={Number(r.from.slice(0, 4))} />
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
                    <span>{money(c.total, true)} <small className="muted">{Math.round((c.total / gross) * 100)}%</small></span>
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
