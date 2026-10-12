// Plantilla: vite.config.ts sustituye la versión y la lista de archivos en cada build.
const CACHE = 'claro-022b9da701'
const ASSETS = ["./","apple-touch-icon.png","assets/index-BL0p-jvP.js","assets/index-DwrXq6Ia.css","icon-192.png","icon-512.png","icon.svg","manifest.webmanifest"]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  )
})

// Cada versión tiene su caché; al activarse se borran las de versiones anteriores.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('claro-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Navegación: red primero para recibir versiones nuevas; sin conexión, la app guardada.
      if (req.mode === 'navigate') {
        try {
          return await fetch(req)
        } catch {
          return (await cache.match(req)) ?? (await cache.match('./')) ?? Response.error()
        }
      }
      return (await cache.match(req)) ?? fetch(req)
    }),
  )
})
