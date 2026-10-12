import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Rutas relativas: la app funciona igual en la raíz que en un subdirectorio (GitHub Pages).
  base: './',
  plugins: [react()],
  server: { port: 5180, strictPort: true },
})
