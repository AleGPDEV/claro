import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Emite sw.js con la lista de archivos a guardar y una versión que cambia cuando cambian. */
function serviceWorker(): Plugin {
  return {
    name: 'claro-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle).filter((f) => f !== 'index.html'), ...readdirSync('public')].sort()
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10)
      const source = readFileSync('src/sw.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(['./', ...files]))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  // Rutas relativas: la app funciona igual en la raíz que en un subdirectorio (GitHub Pages).
  base: './',
  plugins: [react(), serviceWorker()],
  server: { port: 5180, strictPort: true },
})
