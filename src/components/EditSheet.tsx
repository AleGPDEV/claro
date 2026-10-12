import { useEffect, useRef, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../lib/categories'
import { today } from '../lib/dates'
import { isBimonetary, quote, quoted } from '../lib/fx'
import { parseAmount } from '../lib/parse'
import { actions, useStore } from '../lib/store'
import type { Tx } from '../lib/types'

type Type = 'expense' | 'refund' | 'income'

const show = (n: number) => (n > 0 ? String(n).replace('.', ',') : '')

export default function EditSheet({ tx, onClose, onDelete }: { tx: Tx; onClose: () => void; onDelete: (tx: Tx) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const { settings } = useStore()
  const { currency: main, second } = settings
  // El cambio se muestra como "1 USD = 40 UYU" aunque se guarde al revés.
  const rateText = (currency: string, rate: number | undefined) =>
    show(quoted(rate ?? (currency === second ? settings.rate : 0), quote(main, currency).inverted))

  const initial = {
    type: (tx.kind === 'income' ? 'income' : tx.amount < 0 ? 'refund' : 'expense') as Type,
    amount: show(Math.abs(tx.amount)),
    currency: tx.currency,
    rate: rateText(tx.currency, tx.rate),
    note: tx.note,
    // Un ingreso no tiene categoría de gasto: si se convierte en gasto, empieza en Otros.
    category: tx.kind === 'income' ? 'otros' : tx.category,
    date: tx.date,
  }
  const [form, setForm] = useState(initial)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const value = parseAmount(form.amount)
  const foreign = form.currency !== main
  const q = quote(main, form.currency)
  const rate = foreign ? parseAmount(form.rate) : null
  const valid = value !== null && form.date !== '' && (!foreign || rate !== null)
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => form[k] !== initial[k])
  const currencies = [...new Set([main, ...(isBimonetary(settings) ? [second] : []), tx.currency])]

  // showModal() retiene el foco dentro del diálogo y lo devuelve al cerrar.
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  const close = () => {
    dialog.current?.close()
    onClose()
  }
  const dismiss = () => {
    if (!dirty || confirm('¿Descartar los cambios?')) close()
  }

  return (
    <dialog
      ref={dialog}
      className="sheet"
      aria-label="Editar movimiento"
      onCancel={(e) => {
        e.preventDefault()
        dismiss()
      }}
      onClick={(e) => e.target === e.currentTarget && dismiss()}
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid || value === null) return
          const income = form.type === 'income'
          const { rate: _previous, ...rest } = tx
          actions.updateTx({
            ...rest,
            kind: income ? 'income' : 'expense',
            amount: form.type === 'refund' ? -value : value,
            currency: form.currency,
            ...(foreign && rate !== null ? { rate: quoted(rate, q.inverted) } : {}),
            category: income ? 'ingreso' : form.category,
            note: form.note.trim(),
            date: form.date,
          })
          close()
        }}
      >
        <h2>Editar movimiento</h2>
        <div className="row">
          <label className="field">
            <span>Tipo</span>
            <select value={form.type} onChange={(e) => set({ type: e.target.value as Type })}>
              <option value="expense">Gasto</option>
              <option value="refund">Devolución</option>
              <option value="income">Ingreso</option>
            </select>
          </label>
          <label className="field">
            <span>Monto</span>
            <input inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </label>
          {currencies.length > 1 && (
            <label className="field narrow">
              <span>Moneda</span>
              <select value={form.currency} onChange={(e) => set({ currency: e.target.value, rate: rateText(e.target.value, e.target.value === tx.currency ? tx.rate : undefined) })}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {foreign && (
          <label className="field">
            <span>Tipo de cambio de ese día: 1 {q.base} = ¿cuántos {q.counter}?</span>
            <input inputMode="decimal" value={form.rate} onChange={(e) => set({ rate: e.target.value })} />
          </label>
        )}
        <label className="field">
          <span>Nota</span>
          <input value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </label>
        <div className="row">
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={form.date} max={today()} onChange={(e) => set({ date: e.target.value })} />
          </label>
          {form.type !== 'income' && (
            <label className="field">
              <span>Categoría</span>
              <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {form.type === 'refund' && <p className="muted small">Una devolución resta de lo gastado en su categoría.</p>}
        <div className="row">
          <button type="button" className="danger" onClick={() => { close(); onDelete(tx) }}>
            Eliminar
          </button>
          <button type="button" onClick={dismiss}>Cancelar</button>
          <button className="primary" disabled={!valid}>Guardar</button>
        </div>
      </form>
    </dialog>
  )
}
