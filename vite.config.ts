import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Emite sw.js con la lista de archivos a guardar y una versión que cambia cuando cambia cualquiera. */
function serviceWorker(): Plugin {
  return {
    name: 'claro-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const statics = readdirSync('public').sort()
      const files = [...Object.keys(bundle).filter((f) => f !== 'index.html'), ...statics].sort()
      const template = readFileSync('src/sw.js', 'utf8')
      // Los archivos del bundle llevan su hash en el nombre; los de public/ y la plantilla
      // no, así que se incluye su contenido para que cualquier cambio publique versión nueva.
      const hash = createHash('sha256').update(files.join('|')).update(template)
      for (const f of statics) hash.update(readFileSync(`public/${f}`))
      const index = bundle['index.html']
      if (index?.type === 'asset') hash.update(index.source)
      const version = hash.digest('hex').slice(0, 10)
      const source = template
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
