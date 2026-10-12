import { useEffect, useMemo, useRef, useState } from 'react'
import { cat, EXPENSE_CATEGORIES } from '../lib/categories'
import { today } from '../lib/dates'
import { parseEntry } from '../lib/parse'
import { hourlyRate, workTime } from '../lib/stats'
import { actions, useMoney, useStore } from '../lib/store'

export default function QuickAdd() {
  const { learned, settings } = useStore()
  const money = useMoney()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  // La categoría elegida a mano vale solo para la nota con la que se eligió.
  const [picked, setPicked] = useState<{ note: string; category: string } | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [added, setAdded] = useState<{ id: string; label: string } | null>(null)

  const parsed = useMemo(() => parseEntry(text, learned), [text, learned])
  const category = parsed.kind === 'income' ? 'ingreso' : picked?.note === parsed.note ? picked.category : parsed.category
  const entry = { ...parsed, category, date: date ?? parsed.date }
  const rate = hourlyRate(settings)

  // "/" enfoca la entrada rápida desde cualquier punto de la pantalla.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key !== '/' || /INPUT|SELECT|TEXTAREA/.test(el.tagName)) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(null), 5000)
    return () => clearTimeout(timer)
  }, [added])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (entry.amount === null) return
    const amount = entry.refund ? -entry.amount : entry.amount
    const id = actions.addTx({ kind: entry.kind, amount, category: entry.category, note: entry.note, date: entry.date })
    setAdded({ id, label: `${entry.note || cat(entry.category).name} · ${money(entry.amount)}` })
    setText('')
    setPicked(null)
    setDate(null)
  }

  return (
    <form className="quick" onSubmit={submit}>
      <div className="quick-row">
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="café 3,50"
          aria-label="Agregar movimiento"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button className="primary" disabled={entry.amount === null} aria-label="Agregar">
          +
        </button>
      </div>

      {entry.amount !== null ? (
        <>
          <div className="chips">
            {entry.kind === 'income' ? (
              <span className="chip">💰 Ingreso</span>
            ) : (
              <select className="chip" value={entry.category} onChange={(e) => setPicked({ note: parsed.note, category: e.target.value })} aria-label="Categoría">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            )}
            <input className="chip" type="date" value={entry.date} max={today()} onChange={(e) => setDate(e.target.value || null)} aria-label="Fecha" />
            <strong className="chip-amount">{entry.kind === 'income' || entry.refund ? '+' : ''}{money(entry.amount)}</strong>
          </div>
          {entry.doubt === 'year' && (
            <p className="hint doubt" role="status">
              ¿{parsed.amount} es el monto o un año? Se va a registrar como monto. Si el monto es otro, escribilo al final.
            </p>
          )}
          {entry.doubt === 'several' && (
            <p className="hint doubt" role="status">
              Hay varios números: se toma <b>{money(entry.amount)}</b> como monto y el resto queda en la nota.
            </p>
          )}
          {entry.refund ? (
            <p className="hint">Devolución: se resta de lo gastado en <b>{cat(entry.category).name}</b>.</p>
          ) : entry.kind === 'expense' ? (
            <p className="hint">
              Cada día serían <b>{money(entry.amount * 365, true)}</b> al año
              {rate > 0 && <> · te cuesta <b>{workTime(entry.amount, rate)}</b> de trabajo</>}
            </p>
          ) : null}
        </>
      ) : added ? (
        <p className="hint" role="status">
          ✓ {added.label}{' '}
          <button type="button" className="link" onClick={() => { actions.removeTx(added.id); setAdded(null) }}>
            Deshacer
          </button>
        </p>
      ) : (
        <p className="hint">Escribí qué y cuánto. También «ayer 20 cena», «+1500 sueldo» o «-30 devolución».</p>
      )}
    </form>
  )
}
