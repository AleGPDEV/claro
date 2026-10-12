import { cat } from '../lib/categories'
import { addDays, daysInMonth, parseDate, today } from '../lib/dates'
import { demoData } from '../lib/demo'
import { byCategory, compare, dailyTotals, hourlyRate, sum, workTime, type PeriodKind } from '../lib/stats'
import { actions, getState, monthlyCost, useMoney, useStore, type Money } from '../lib/store'
import type { State, Tx } from '../lib/types'
import QuickAdd from './QuickAdd'
import TxList from './TxList'

export function Delta({ value }: { value: number | null }) {
  if (value === null) return null
  const pct = Math.round(Math.abs(value) * 100)
  if (pct === 0) return <span className="delta">= igual</span>
  return <span className={value > 0 ? 'delta up' : 'delta down'}>{value > 0 ? '▲' : '▼'} {pct}%</span>
}

function insights(state: State, money: Money) {
  const { txs, recurring, settings } = state
  const t = today()
  const d = parseDate(t)
  const dim = daysInMonth(d.getFullYear(), d.getMonth())
  const from = t.slice(0, 8) + '01'
  const month = sum(txs, from, t)
  const out: { icon: string; text: React.ReactNode }[] = []
  if (month === 0) return out

  const variable = txs.filter((x) => !x.recurringId)
  const fixed = recurring.filter((r) => r.kind === 'expense').reduce((s, r) => s + monthlyCost(r), 0)

  if (d.getDate() >= 3) {
    const pace = (sum(variable, from, t) / d.getDate()) * dim + Math.max(fixed, month - sum(variable, from, t))
    out.push({
      icon: '🔮',
      text: (
        <>
          A este ritmo cerrarás el mes en <b>{money(pace, true)}</b>
          {settings.budget > 0 && (pace > settings.budget
            ? <>, <b>{money(pace - settings.budget, true)}</b> por encima de tu presupuesto.</>
            : <>, <b>{money(settings.budget - pace, true)}</b> por debajo de tu presupuesto.</>)}
          {settings.budget === 0 && '.'}
        </>
      ),
    })
  }

  const [top] = byCategory(txs, from, t)
  if (top) {
    out.push({
      icon: cat(top.id).icon,
      text: <>Tu mayor gasto del mes es <b>{cat(top.id).name}</b>: {money(top.total, true)}, el {Math.round((top.total / month) * 100)}% del total.</>,
    })
  }

  // Gastos hormiga: importes pequeños que pasan desapercibidos pero suman.
  const reference = settings.budget || settings.income
  if (reference > 0) {
    const limit = reference * 0.005
    const ants = variable.filter((x) => x.kind === 'expense' && x.date >= from && x.date <= t && x.amount <= limit)
    const total = ants.reduce((s, x) => s + x.amount, 0)
    if (ants.length >= 3) {
      out.push({
        icon: '🐜',
        text: <>{ants.length} gastos pequeños (menos de {money(limit, true)}) suman <b>{money(total)}</b> este mes. Al año serían unos <b>{money((total / d.getDate()) * 365, true)}</b>.</>,
      })
    }
  }

  const rate = hourlyRate(settings)
  if (rate > 0) out.push({ icon: '⏳', text: <>Lo gastado este mes equivale a <b>{workTime(month, rate)}</b> de tu trabajo.</> })

  if (fixed > 0) {
    out.push({
      icon: '🔁',
      text: <>Tus gastos fijos son <b>{money(fixed, true)}</b> al mes, <b>{money(fixed * 12, true)}</b> al año{settings.income > 0 && <> ({Math.round((fixed / settings.income) * 100)}% de tu ingreso)</>}.</>,
    })
  }

  const days = dailyTotals(variable, from, t)
  const zero = d.getDate() - days.size
  if (zero > 0 && d.getDate() >= 5) out.push({ icon: '🌱', text: <><b>{zero}</b> {zero === 1 ? 'día' : 'días'} sin gastar este mes.</> })

  return out
}

export default function Today({ openPeriod, onEdit }: { openPeriod: (k: PeriodKind) => void; onEdit: (tx: Tx) => void }) {
  const state = useStore()
  const money = useMoney()
  const { txs, recurring, settings } = state
  const t = today()
  const d = parseDate(t)
  const dim = daysInMonth(d.getFullYear(), d.getMonth())
  const monthFrom = t.slice(0, 8) + '01'

  const spentToday = sum(txs, t, t)
  const month = compare({ kind: 'month', anchor: t }, txs)
  const year = compare({ kind: 'year', anchor: t }, txs)
  const avg30 = sum(txs.filter((x) => !x.recurringId), addDays(t, -30), addDays(t, -1)) / 30

  // El presupuesto diario se calcula sobre lo que queda tras los gastos fijos.
  const variable = txs.filter((x) => !x.recurringId)
  const fixed = recurring.filter((r) => r.kind === 'expense').reduce((s, r) => s + monthlyCost(r), 0)
  const flexible = settings.budget - fixed
  const varToday = sum(variable, t, t)
  const varMonth = sum(variable, monthFrom, t)
  const daysLeft = dim - d.getDate() + 1
  const available = (flexible - (varMonth - varToday)) / daysLeft - varToday

  const todays = txs.filter((x) => x.date === t)
  const tips = insights(state, money)

  return (
    <>
      <header className="top">
        <h1>Claro</h1>
        <span className="muted">{d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </header>

      <QuickAdd />

      <section className="hero">
        {settings.budget > 0 ? (
          <>
            <span className="label">Disponible hoy</span>
            <strong className={available < 0 ? 'big over' : 'big'}>{money(available)}</strong>
            <div className="meter" role="img" aria-label={`Gasto variable del mes: ${money(varMonth)} de ${money(flexible)}`}>
              <i style={{ width: `${Math.min(100, Math.max(0, (varMonth / Math.max(flexible, 1)) * 100))}%` }} className={varMonth > flexible ? 'over' : ''} />
              <b style={{ left: `${(d.getDate() / dim) * 100}%` }} title="Hoy" />
            </div>
            <span className="muted small">
              {money(varMonth, true)} de {money(Math.max(flexible, 0), true)} este mes
              {fixed > 0 && <> (sin fijos)</>} · {daysLeft} {daysLeft === 1 ? 'día' : 'días'} por delante
            </span>
          </>
        ) : (
          <>
            <span className="label">Gastado hoy</span>
            <strong className="big">{money(spentToday)}</strong>
            <span className="muted small">Define un presupuesto en Ajustes para saber cuánto puedes gastar cada día.</span>
          </>
        )}
      </section>

      <section className="tiles">
        <button onClick={() => openPeriod('week')}>
          <span className="label">Hoy</span>
          <strong>{money(spentToday, true)}</strong>
          <small className="muted">media {money(avg30, true)}</small>
        </button>
        <button onClick={() => openPeriod('month')}>
          <span className="label">Mes</span>
          <strong>{money(month.total, true)}</strong>
          <small><Delta value={month.delta} /></small>
        </button>
        <button onClick={() => openPeriod('year')}>
          <span className="label">Año</span>
          <strong>{money(year.total, true)}</strong>
          <small><Delta value={year.delta} /></small>
        </button>
      </section>

      {tips.length > 0 && (
        <section className="card insights">
          <h2>Para tener en cuenta</h2>
          <ul>
            {tips.map((tip, i) => (
              <li key={i}>
                <span aria-hidden="true">{tip.icon}</span>
                <p>{tip.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {todays.length > 0 ? (
        <section className="card">
          <h2>Hoy</h2>
          <TxList txs={todays} onEdit={onEdit} showDays={false} />
        </section>
      ) : txs.length === 0 ? (
        <section className="card empty">
          <p>Aún no hay movimientos. Añade el primero arriba.</p>
          <button className="link" onClick={() => actions.replace(demoData(getState()))}>
            Ver la app con datos de ejemplo
          </button>
        </section>
      ) : (
        <p className="muted center">Hoy no has gastado nada todavía.</p>
      )}
    </>
  )
}
