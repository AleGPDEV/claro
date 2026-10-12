import { today } from './dates'
import { actions, getState } from './store'

export function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBackup() {
  actions.markBackup()
  download(`claro-${today()}.json`, 'application/json', JSON.stringify(getState(), null, 2))
}
