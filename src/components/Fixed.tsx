import { useState } from 'react'
import { cat, detectCategory } from '../lib/categories'
import { dayLabel, today } from '../lib/dates'
import { parseAmount } from '../lib/parse'
import { actions, monthlyCost, nextDue, useMoney, useStore } from '../lib/store'
import type { Every } from '../lib/types'

const EVERY: Record<Every, string> = { week: 'semana', month: 'mes', year: 'año' }

export default function Fixed() {
  const { recurring, settings } = useStore()
  const money = useMoney()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [every, setEvery] = useState<Every>('month')
  const [start, setStart] = useState(today())
  const [income, setIncome] = useState(false)

  const expenses = recurring.filter((r) => r.kind === 'expense')
  const monthly = expenses.reduce((s, r) => s + monthlyCost(r), 0)
  const value = parseAmount(amount)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || value === null || !start) return
    const category = income ? 'ingreso' : (detectCategory(name) ?? 'suscripciones')
    actions.addRecurring({ kind: income ? 'income' : 'expense', name: name.trim(), amount: value, category, every, start })
    setName('')
    setAmount('')
  }

  return (
    <>
      <header className="top">
        <h1>Fijos</h1>
        <span className="muted">Suscripciones, alquiler, nómina…</span>
      </header>

      <section className="hero">
        <span className="label">Gastos fijos al año</span>
        <strong className="big">{money(monthly * 12, true)}</strong>
        <span className="muted small">
          {money(monthly, true)} al mes
          {settings.income > 0 && monthly > 0 && <> · {Math.round((monthly / settings.income) * 100)}% de tu ingreso</>}
        </span>
      </section>

      {recurring.length > 0 && (
        <section className="card">
          <div className="txlist">
            {[...recurring].sort((a, b) => monthlyCost(b) - monthlyCost(a)).map((r) => (
              <div key={r.id} className="tx">
                <span className="tx-icon" aria-hidden="true">{cat(r.category).icon}</span>
                <span className="tx-text">
                  <span>{r.name}</span>
                  <small>
                    {money(r.amount)} / {EVERY[r.every]} · próximo: {dayLabel(nextDue(r)).toLowerCase()}
                  </small>
                </span>
                <span className={r.kind === 'income' ? 'tx-amount income' : 'tx-amount'}>
                  {r.kind === 'income' ? '+' : ''}{money(monthlyCost(r) * 12, true)}<small className="muted"> /año</small>
                </span>
                <button className="icon-btn" aria-label={`Eliminar ${r.name}`} onClick={() => confirm(`¿Eliminar «${r.name}»? Los movimientos ya generados se conservan.`) && actions.removeRecurring(r.id)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <form className="card form" onSubmit={submit}>
        <h2>Añadir fijo</h2>
        <label className="field">
          <span>Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Netflix" />
        </label>
        <div className="row">
          <label className="field">
            <span>Importe</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="13,99" />
          </label>
          <label className="field">
            <span>Cada</span>
            <select value={every} onChange={(e) => setEvery(e.target.value as Every)}>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Año</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Próximo cobro</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={income} onChange={(e) => setIncome(e.target.checked)} /> Es un ingreso
        </label>
        <button className="primary" disabled={!name.trim() || value === null}>Añadir</button>
      </form>
    </>
  )
}
