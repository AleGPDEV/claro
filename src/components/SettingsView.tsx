import { useEffect, useRef, useState } from 'react'
import { download, downloadBackup } from '../lib/backup'
import { toCsv } from '../lib/csv'
import { dayLabel, today } from '../lib/dates'
import { demoData } from '../lib/demo'
import { isBimonetary, quote, quoted } from '../lib/fx'
import { decimalSeparator } from '../lib/locale'
import { parseAmount } from '../lib/parse'
import { hourlyRate } from '../lib/stats'
import { actions, CURRENCIES, getState, importState, isPersisted, useLedger, useMoney } from '../lib/store'
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
  const { settings, txs } = useLedger()
  const money = useMoney()
  const { currency: main, second } = settings
  const q = quote(main, second)

  const changeMain = (code: string) => {
    const mine = txs.filter((t) => t.currency === main).length
    // Sin segunda moneda, cambiar la principal solo puede ser corregir un error: los números no cambian.
    if (code !== second && mine > 0 && !confirm(`Tus ${mine} movimientos en ${main} van a pasar a figurar en ${code}, con los mismos números. Hacelo solo si te habías equivocado de moneda. ¿Continuar?`)) return
    actions.setMainCurrency(code)
  }
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
        <div className="row">
          <label className="field">
            <span>Moneda principal</span>
            <select value={main} onChange={(e) => changeMain(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Segunda moneda</span>
            <select value={second} onChange={(e) => actions.setSecondCurrency(e.target.value)}>
              <option value="">Ninguna</option>
              {CURRENCIES.filter((c) => c !== main).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {second && (
          <>
            <NumberField
              key={`r${main}${second}${settings.rate}`}
              label={`Tipo de cambio: 1 ${q.base} = ¿cuántos ${q.counter}?`}
              value={quoted(settings.rate, q.inverted)}
              onCommit={(x) => actions.setSettings({ rate: quoted(x, q.inverted) })}
            />
            {isBimonetary(settings) ? (
              <>
                <p className="muted small">
                  Los totales se muestran en {main}. Cada movimiento en {second} guarda el cambio del día en que lo anotás,
                  así que actualizar este valor no altera lo ya registrado.
                </p>
                <button onClick={() => actions.swapCurrencies()}>Usar {second} como principal</button>
              </>
            ) : (
              <p className="warn small">Indicá el tipo de cambio para poder anotar movimientos en {second}.</p>
            )}
          </>
        )}
        <NumberField key={`b${settings.budget}`} label={`Presupuesto mensual (${main})`} value={settings.budget} onCommit={(budget) => actions.setSettings({ budget })} />
        <div className="row">
          <NumberField key={`i${settings.income}`} label={`Ingreso mensual neto (${main})`} value={settings.income} onCommit={(income) => actions.setSettings({ income })} />
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
          {settings.lastBackup ? `Última copia: ${dayLabel(settings.lastBackup).toLowerCase()}.` : 'Todavía no hiciste ninguna copia.'}
        </p>
        {persisted === false && (
          <p className="warn small">
            El navegador puede borrar estos datos si pasás un tiempo sin abrir la app (en iPhone, unos 7 días).
            Para evitarlo, instalala en la pantalla de inicio y descargá una copia de vez en cuando.
          </p>
        )}
        <div className="row">
          <button onClick={downloadBackup}>Copia (JSON)</button>
          <button onClick={() => download(`claro-${today()}.csv`, 'text/csv;charset=utf-8', toCsv(txs, decimalSeparator(), main))}>Exportar CSV</button>
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
