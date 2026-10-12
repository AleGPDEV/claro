import { useEffect, useRef, useState } from 'react'
import { download, downloadBackup } from '../lib/backup'
import { toCsv } from '../lib/csv'
import { dayLabel, today } from '../lib/dates'
import { demoData } from '../lib/demo'
import { decimalSeparator } from '../lib/locale'
import { parseAmount } from '../lib/parse'
import { hourlyRate } from '../lib/stats'
import { actions, CURRENCIES, getState, importState, isPersisted, useMoney, useStore } from '../lib/store'
import type { Settings } from '../lib/types'

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
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const rate = hourlyRate(settings)

  useEffect(() => {
    isPersisted().then(setPersisted)
  }, [])

  const importJson = async (f: File | undefined) => {
    if (!f) return
    try {
      const next = importState(JSON.parse(await f.text()))
      if (!confirm(`Se reemplazarán tus datos actuales por ${next.txs.length} movimientos importados. ¿Continuar?`)) return
      actions.replace({ ...next, settings: { ...next.settings, onboarded: true } })
    } catch {
      alert('El archivo no es una copia válida de Claro.')
    }
  }

  // Cada campo lleva como `key` su valor guardado: si cambia por una restauración u otra
  // pestaña, el campo se recrea y no puede volver a escribir el valor antiguo.
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
        <NumberField key={`b${settings.budget}`} label="Presupuesto mensual" value={settings.budget} onCommit={(budget) => actions.setSettings({ budget })} />
        <div className="row">
          <NumberField key={`i${settings.income}`} label="Ingreso mensual neto" value={settings.income} onCommit={(income) => actions.setSettings({ income })} />
          <NumberField key={`h${settings.weeklyHours}`} label="Horas / semana" value={settings.weeklyHours} onCommit={(h) => actions.setSettings({ weeklyHours: h || 40 })} />
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
        <p className="muted small">
          Se guardan solo en este dispositivo.{' '}
          {settings.lastBackup ? `Última copia: ${dayLabel(settings.lastBackup).toLowerCase()}.` : 'Todavía no has hecho ninguna copia.'}
        </p>
        {persisted === false && (
          <p className="warn small">
            El navegador puede borrar estos datos si pasas un tiempo sin abrir la app (en iPhone, unos 7 días).
            Para evitarlo, instálala en la pantalla de inicio y descarga una copia de vez en cuando.
          </p>
        )}
        <div className="row">
          <button onClick={downloadBackup}>Copia (JSON)</button>
          <button onClick={() => download(`claro-${today()}.csv`, 'text/csv;charset=utf-8', toCsv(txs, decimalSeparator()))}>Exportar CSV</button>
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
