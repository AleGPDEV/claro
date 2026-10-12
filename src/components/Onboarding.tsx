import { useState } from 'react'
import { quote, quoted } from '../lib/fx'
import { parseAmount } from '../lib/parse'
import { actions, CURRENCIES, useStore } from '../lib/store'

export default function Onboarding() {
  const { settings } = useStore()
  const [currency, setCurrency] = useState(settings.currency)
  const [second, setSecond] = useState(settings.second)
  const [rate, setRate] = useState('')
  const [budget, setBudget] = useState('')
  const [income, setIncome] = useState('')
  const other = second !== currency ? second : ''
  const q = quote(currency, other)

  return (
    <form
      className="onboarding"
      onSubmit={(e) => {
        e.preventDefault()
        actions.finishOnboarding({
          currency,
          second: other,
          rate: other ? quoted(parseAmount(rate) ?? 0, q.inverted) : 0,
          entryCurrency: currency,
          budget: parseAmount(budget) ?? 0,
          income: parseAmount(income) ?? 0,
        })
      }}
    >
      <h1>Claro</h1>
      <p className="lead">Tené claro en qué se va tu plata: hoy, este mes y este año.</p>

      <div className="row">
        <label className="field">
          <span>Moneda principal</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Segunda moneda <em>opcional</em></span>
          <select value={other} onChange={(e) => setSecond(e.target.value)}>
            <option value="">Ninguna</option>
            {CURRENCIES.filter((c) => c !== currency).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {other && (
        <label className="field">
          <span>Tipo de cambio: 1 {q.base} = ¿cuántos {q.counter}?</span>
          <input inputMode="decimal" placeholder="Lo podés cambiar cuando quieras en Ajustes" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>Presupuesto mensual en {currency} <em>opcional</em></span>
        <input inputMode="decimal" placeholder="Para saber cuánto podés gastar cada día" value={budget} onChange={(e) => setBudget(e.target.value)} />
      </label>
      <label className="field">
        <span>Ingreso mensual neto en {currency} <em>opcional</em></span>
        <input inputMode="decimal" placeholder="Para traducir gastos a horas de trabajo" value={income} onChange={(e) => setIncome(e.target.value)} />
      </label>

      <button className="primary">Empezar</button>
      <p className="muted small">Tus datos se guardan solo en este dispositivo. Sin cuentas ni servidores.</p>
    </form>
  )
}
