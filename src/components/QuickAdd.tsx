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
  const [category, setCategory] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [added, setAdded] = useState<{ id: string; label: string } | null>(null)

  const parsed = useMemo(() => parseEntry(text, learned), [text, learned])
  const entry = { ...parsed, category: parsed.kind === 'income' ? 'ingreso' : (category ?? parsed.category), date: date ?? parsed.date }
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
    const id = actions.addTx({ kind: entry.kind, amount: entry.amount, category: entry.category, note: entry.note, date: entry.date })
    setAdded({ id, label: `${entry.note || cat(entry.category).name} · ${money(entry.amount)}` })
    setText('')
    setCategory(null)
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
          aria-label="Añadir movimiento"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button className="primary" disabled={entry.amount === null} aria-label="Añadir">
          +
        </button>
      </div>

      {entry.amount !== null ? (
        <>
          <div className="chips">
            {entry.kind === 'income' ? (
              <span className="chip">💰 Ingreso</span>
            ) : (
              <select className="chip" value={entry.category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            )}
            <input className="chip" type="date" value={entry.date} max={today()} onChange={(e) => setDate(e.target.value || null)} aria-label="Fecha" />
            <strong className="chip-amount">{entry.kind === 'income' ? '+' : ''}{money(entry.amount)}</strong>
          </div>
          {entry.kind === 'expense' && (
            <p className="hint">
              Cada día serían <b>{money(entry.amount * 365, true)}</b> al año
              {rate > 0 && <> · te cuesta <b>{workTime(entry.amount, rate)}</b> de trabajo</>}
            </p>
          )}
        </>
      ) : added ? (
        <p className="hint">
          ✓ {added.label}{' '}
          <button type="button" className="link" onClick={() => { actions.removeTx(added.id); setAdded(null) }}>
            Deshacer
          </button>
        </p>
      ) : (
        <p className="hint">Escribe qué y cuánto. Prueba «ayer 20 cena» o «+1500 nómina».</p>
      )}
    </form>
  )
}
