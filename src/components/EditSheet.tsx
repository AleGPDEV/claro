import { useEffect, useRef, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../lib/categories'
import { today } from '../lib/dates'
import { parseAmount } from '../lib/parse'
import { actions } from '../lib/store'
import type { Tx } from '../lib/types'

type Type = 'expense' | 'refund' | 'income'

export default function EditSheet({ tx, onClose, onDelete }: { tx: Tx; onClose: () => void; onDelete: (tx: Tx) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const initial = {
    type: (tx.kind === 'income' ? 'income' : tx.amount < 0 ? 'refund' : 'expense') as Type,
    amount: String(Math.abs(tx.amount)).replace('.', ','),
    note: tx.note,
    // Un ingreso no tiene categoría de gasto: si se convierte en gasto, empieza en Otros.
    category: tx.kind === 'income' ? 'otros' : tx.category,
    date: tx.date,
  }
  const [form, setForm] = useState(initial)
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const value = parseAmount(form.amount)
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => form[k] !== initial[k])

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
          if (value === null || !form.date) return
          const income = form.type === 'income'
          actions.updateTx({
            ...tx,
            kind: income ? 'income' : 'expense',
            amount: form.type === 'refund' ? -value : value,
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
        </div>
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
          <button className="primary" disabled={value === null}>Guardar</button>
        </div>
      </form>
    </dialog>
  )
}
