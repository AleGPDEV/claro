import { useEffect, useRef, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../lib/categories'
import { today } from '../lib/dates'
import { parseAmount } from '../lib/parse'
import { actions } from '../lib/store'
import type { Tx } from '../lib/types'

export default function EditSheet({ tx, onClose, onDelete }: { tx: Tx; onClose: () => void; onDelete: (tx: Tx) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const initial = { amount: String(Math.abs(tx.amount)).replace('.', ','), note: tx.note, category: tx.category, date: tx.date, refund: tx.amount < 0 }
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
          const amount = tx.kind === 'expense' && form.refund ? -value : value
          actions.updateTx({ ...tx, amount, note: form.note.trim(), category: form.category, date: form.date })
          close()
        }}
      >
        <h2>{tx.kind === 'income' ? 'Ingreso' : 'Gasto'}</h2>
        <div className="row">
          <label className="field">
            <span>Importe</span>
            <input inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </label>
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={form.date} max={today()} onChange={(e) => set({ date: e.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Nota</span>
          <input value={form.note} onChange={(e) => set({ note: e.target.value })} />
        </label>
        {tx.kind === 'expense' && (
          <>
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
            <label className="check">
              <input type="checkbox" checked={form.refund} onChange={(e) => set({ refund: e.target.checked })} /> Es una devolución (resta del gasto)
            </label>
          </>
        )}
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
