import { useEffect, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../lib/categories'
import { today } from '../lib/dates'
import { parseAmount } from '../lib/parse'
import { actions } from '../lib/store'
import type { Tx } from '../lib/types'

export default function EditSheet({ tx, onClose }: { tx: Tx; onClose: () => void }) {
  const [amount, setAmount] = useState(String(tx.amount).replace('.', ','))
  const [note, setNote] = useState(tx.note)
  const [category, setCategory] = useState(tx.category)
  const [date, setDate] = useState(tx.date)
  const value = parseAmount(amount)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <form
        className="sheet form"
        role="dialog"
        aria-label="Editar movimiento"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (value === null || !date) return
          actions.updateTx({ ...tx, amount: value, note: note.trim(), category, date })
          onClose()
        }}
      >
        <h2>{tx.kind === 'income' ? 'Ingreso' : 'Gasto'}</h2>
        <div className="row">
          <label className="field">
            <span>Importe</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="field">
            <span>Fecha</span>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Nota</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {tx.kind === 'expense' && (
          <label className="field">
            <span>Categoría</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="row">
          <button type="button" className="danger" onClick={() => { actions.removeTx(tx.id); onClose() }}>
            Eliminar
          </button>
          <button className="primary" disabled={value === null}>Guardar</button>
        </div>
      </form>
    </div>
  )
}
