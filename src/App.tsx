import { useEffect, useState } from 'react'
import Analysis from './components/Analysis'
import EditSheet from './components/EditSheet'
import Fixed from './components/Fixed'
import Onboarding from './components/Onboarding'
import SettingsView from './components/SettingsView'
import Today from './components/Today'
import { today } from './lib/dates'
import type { Period, PeriodKind } from './lib/stats'
import { actions, useStore } from './lib/store'
import type { Tx } from './lib/types'

type Tab = 'hoy' | 'analisis' | 'fijos' | 'ajustes'

const TABS: { id: Tab; label: string; path: string }[] = [
  { id: 'hoy', label: 'Hoy', path: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 100 8 4 4 0 000-8z' },
  { id: 'analisis', label: 'Análisis', path: 'M5 20v-7M12 20V4M19 20v-11' },
  { id: 'fijos', label: 'Fijos', path: 'M4 9a8 8 0 0114-4l2 2M20 4v3h-3M20 15a8 8 0 01-14 4l-2-2M4 20v-3h3' },
  { id: 'ajustes', label: 'Ajustes', path: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5v4M8 15v4' },
]

export default function App() {
  const { settings, txs } = useStore()
  const [tab, setTab] = useState<Tab>('hoy')
  const [period, setPeriod] = useState<Period>({ kind: 'month', anchor: today() })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Tx | null>(null)
  const editing = txs.find((t) => t.id === editingId)

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
  }, [settings.theme])

  useEffect(() => {
    if (!deleted) return
    const timer = setTimeout(() => setDeleted(null), 7000)
    return () => clearTimeout(timer)
  }, [deleted])

  if (!settings.onboarded) return <Onboarding />

  const openPeriod = (kind: PeriodKind) => {
    setPeriod({ kind, anchor: today() })
    setTab('analisis')
  }
  const onEdit = (tx: Tx) => setEditingId(tx.id)

  return (
    <div className="app">
      <main>
        {tab === 'hoy' && <Today openPeriod={openPeriod} onEdit={onEdit} />}
        {tab === 'analisis' && <Analysis period={period} setPeriod={setPeriod} onEdit={onEdit} />}
        {tab === 'fijos' && <Fixed />}
        {tab === 'ajustes' && <SettingsView />}
      </main>
      {deleted && (
        <div className="toast" role="status">
          Movimiento eliminado
          <button className="link" onClick={() => { actions.restoreTx(deleted); setDeleted(null) }}>
            Deshacer
          </button>
        </div>
      )}
      <nav className="tabs" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={t.path} />
            </svg>
            {t.label}
          </button>
        ))}
      </nav>
      {editing && (
        <EditSheet
          key={editing.id}
          tx={editing}
          onClose={() => setEditingId(null)}
          onDelete={(tx) => {
            actions.removeTx(tx.id)
            setDeleted(tx)
          }}
        />
      )}
    </div>
  )
}
