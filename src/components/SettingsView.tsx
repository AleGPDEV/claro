import { useRef, useState } from 'react'
import { cat } from '../lib/categories'
import { today } from '../lib/dates'
import { demoData } from '../lib/demo'
import { parseAmount } from '../lib/parse'
import { hourlyRate } from '../lib/stats'
import { actions, CURRENCIES, getState, sanitize, useMoney, useStore } from '../lib/store'
import type { Settings } from '../lib/types'

function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '')
  return (
    <label className="field">
      <span>{label}</span>
      <input inputMode="decimal" value={text} placeholder="—" onChange={(e) => setText(e.target.value)} onBlur={() => onCommit(parseAmount(text) ?? 0)} />
    </label>
  )
}

export default function SettingsView() {
  const { settings, txs } = useStore()
  const money = useMoney()
  const file = useRef<HTMLInputElement>(null)
  const rate = hourlyRate(settings)

  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const rows = [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((t) =>
      [t.date, t.kind === 'income' ? 'ingreso' : 'gasto', t.amount, esc(cat(t.category).name), esc(t.note)].join(','))
    download(`claro-${today()}.csv`, 'text/csv', ['fecha,tipo,importe,categoria,nota', ...rows].join('\n'))
  }

  const importJson = async (f: File | undefined) => {
    if (!f) return
    try {
      const next = sanitize(JSON.parse(await f.text()))
      if (!confirm(`Se reemplazarán tus datos actuales por ${next.txs.length} movimientos importados. ¿Continuar?`)) return
      actions.replace({ ...next, settings: { ...next.settings, onboarded: true } })
    } catch {
      alert('El archivo no es una copia válida de Claro.')
    }
  }

  return (
    <>
      <header className="top">
        <h1>Ajustes</h1>
      </header>

      <section className="card form">
        <label className="field">
          <span>Moneda</span>
          <select value={settings.currency} onChange={(e) => actions.setSettings({ currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <NumberField label="Presupuesto mensual" value={settings.budget} onCommit={(budget) => actions.setSettings({ budget })} />
        <div className="row">
          <NumberField label="Ingreso mensual neto" value={settings.income} onCommit={(income) => actions.setSettings({ income })} />
          <NumberField label="Horas / semana" value={settings.weeklyHours} onCommit={(h) => actions.setSettings({ weeklyHours: h || 40 })} />
        </div>
        {rate > 0 && <p className="muted small">Una hora de tu trabajo vale {money(rate)}. Claro lo usa para traducir gastos a tiempo.</p>}
        <label className="field">
          <span>Tema</span>
          <select value={settings.theme} onChange={(e) => actions.setSettings({ theme: e.target.value as Settings['theme'] })}>
            <option value="auto">Automático</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
      </section>

      <section className="card form">
        <h2>Tus datos</h2>
        <p className="muted small">Se guardan solo en este dispositivo. Haz una copia de vez en cuando.</p>
        <div className="row">
          <button onClick={() => download(`claro-${today()}.json`, 'application/json', JSON.stringify(getState(), null, 2))}>Copia (JSON)</button>
          <button onClick={exportCsv}>Exportar CSV</button>
        </div>
        <button onClick={() => file.current?.click()}>Restaurar una copia…</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = '' }} />
        {txs.length === 0 && <button onClick={() => actions.replace(demoData(getState()))}>Cargar datos de ejemplo</button>}
        <button className="danger" onClick={() => confirm('¿Borrar TODOS tus datos de este dispositivo? No se puede deshacer.') && actions.reset()}>
          Borrar todo
        </button>
      </section>
    </>
  )
}
