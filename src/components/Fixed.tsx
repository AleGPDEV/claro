import { useState } from 'react'
import { cat, detectCategory } from '../lib/categories'
import { addMonths, dayLabel, today } from '../lib/dates'
import { parseAmount } from '../lib/parse'
import { actions, dueCount, monthlyCost, nextDue, useMoney, useStore } from '../lib/store'
import type { Every, Recurring } from '../lib/types'

const EVERY: Record<Every, string> = { week: 'semana', month: 'mes', year: 'año' }
const blank = () => ({ name: '', amount: '', every: 'month' as Every, start: today(), income: false })

export default function Fixed() {
  const { recurring, settings } = useStore()
  const money = useMoney()
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState<string | null>(null)
  const set = (patch: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...patch }))
  const editing = recurring.find((r) => r.id === editingId)

  const expenses = recurring.filter((r) => r.kind === 'expense')
  const monthly = expenses.reduce((s, r) => s + monthlyCost(r), 0)
  const value = parseAmount(form.amount)
  // Más atrás no tiene sentido registrar cobros, y mantiene acotado el número de atrasados.
  const earliest = addMonths(today(), -60)
  const tooOld = form.start !== '' && form.start < earliest

  // Al editar, los cobros ya generados no cambian; solo cuenta si se mueve la fecha o la frecuencia.
  const rescheduled = !editing || form.start !== nextDue(editing) || form.every !== editing.every
  const overdue = rescheduled && form.start ? dueCount(form.start, form.every, today()) : 0

  const edit = (r: Recurring) => {
    setEditingId(r.id)
    setForm({ name: r.name, amount: String(r.amount).replace('.', ','), every: r.every, start: nextDue(r), income: r.kind === 'income' })
  }
  const cancel = () => {
    setEditingId(null)
    setForm(blank())
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name || value === null || !form.start || tooOld) return
    const kind = form.income ? 'income' : 'expense'
    const category = form.income ? 'ingreso' : (detectCategory(name) ?? 'suscripciones')
    if (editing) {
      const keepCategory = name === editing.name && kind === editing.kind
      actions.updateRecurring({
        ...editing, name, kind, amount: value, every: form.every,
        category: keepCategory ? editing.category : category,
        ...(rescheduled ? { start: form.start, done: 0 } : {}),
      })
    } else {
      actions.addRecurring({ kind, name, amount: value, category, every: form.every, start: form.start })
    }
    cancel()
  }

  return (
    <>
      <header className="top">
        <h1>Fijos</h1>
        <span className="muted">Suscripciones, alquiler, sueldo…</span>
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
              <div key={r.id} className={r.id === editingId ? 'tx editing' : 'tx'}>
                <button className="tx-main" onClick={() => edit(r)} aria-label={`Editar ${r.name}`}>
                  <span className="tx-icon" aria-hidden="true">{cat(r.category).icon}</span>
                  <span className="tx-text">
                    <span>{r.name}</span>
                    <small>
                      {money(r.amount)} / {EVERY[r.every]} · próximo: {dayLabel(nextDue(r)).toLowerCase()}
                    </small>
                  </span>
                  <span className={r.kind === 'income' ? 'tx-amount stack income' : 'tx-amount stack'}>
                    {r.kind === 'income' ? '+' : ''}{money(monthlyCost(r) * 12, true)}
                    <small className="muted">al año</small>
                  </span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Eliminar ${r.name}`}
                  onClick={() => {
                    if (!confirm(`¿Eliminar «${r.name}»? Los movimientos ya generados se conservan.`)) return
                    if (r.id === editingId) cancel()
                    actions.removeRecurring(r.id)
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <form className="card form" onSubmit={submit}>
        <h2>{editing ? `Editar «${editing.name}»` : 'Agregar fijo'}</h2>
        <label className="field">
          <span>Nombre</span>
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Netflix" />
        </label>
        <div className="row">
          <label className="field">
            <span>Monto</span>
            <input inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="13,99" />
          </label>
          <label className="field">
            <span>Cada</span>
            <select value={form.every} onChange={(e) => set({ every: e.target.value as Every })}>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Año</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Próximo cobro</span>
          <input type="date" value={form.start} min={earliest} onChange={(e) => set({ start: e.target.value })} />
        </label>
        {tooOld ? (
          <p className="warn small" role="status">La fecha no puede ser anterior a hace 5 años.</p>
        ) : overdue > 0 && form.start < today() && (
          <p className="warn small" role="status">
            Esa fecha ya pasó: al guardar se registrarán <b>{overdue}</b> {overdue === 1 ? 'cobro anterior' : 'cobros anteriores'}
            {value !== null && <> ({money(overdue * value)} en total)</>}. Si solo querés los próximos, elegí una fecha futura.
          </p>
        )}
        {editing && <p className="muted small">Los cambios se aplican a los próximos cobros; los ya registrados no se modifican.</p>}
        <label className="check">
          <input type="checkbox" checked={form.income} onChange={(e) => set({ income: e.target.checked })} /> Es un ingreso
        </label>
        <div className="row">
          {editing && <button type="button" onClick={cancel}>Cancelar</button>}
          <button className="primary" disabled={!form.name.trim() || value === null || !form.start || tooOld}>{editing ? 'Guardar' : 'Agregar'}</button>
        </div>
      </form>
    </>
  )
}
