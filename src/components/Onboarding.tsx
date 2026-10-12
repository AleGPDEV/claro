import { useState } from 'react'
import { parseAmount } from '../lib/parse'
import { actions, CURRENCIES, useStore } from '../lib/store'

export default function Onboarding() {
  const { settings } = useStore()
  const [currency, setCurrency] = useState(settings.currency)
  const [budget, setBudget] = useState('')
  const [income, setIncome] = useState('')

  return (
    <form
      className="onboarding"
      onSubmit={(e) => {
        e.preventDefault()
        actions.finishOnboarding({ currency, budget: parseAmount(budget) ?? 0, income: parseAmount(income) ?? 0 })
      }}
    >
      <h1>Claro</h1>
      <p className="lead">Tené claro en qué se va tu plata: hoy, este mes y este año.</p>

      <label className="field">
        <span>Moneda</span>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Presupuesto mensual <em>opcional</em></span>
        <input inputMode="decimal" placeholder="Para saber cuánto podés gastar cada día" value={budget} onChange={(e) => setBudget(e.target.value)} />
      </label>
      <label className="field">
        <span>Ingreso mensual neto <em>opcional</em></span>
        <input inputMode="decimal" placeholder="Para traducir gastos a horas de trabajo" value={income} onChange={(e) => setIncome(e.target.value)} />
      </label>

      <button className="primary">Empezar</button>
      <p className="muted small">Tus datos se guardan solo en este dispositivo. Sin cuentas ni servidores.</p>
    </form>
  )
}
