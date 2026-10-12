// Genera los iconos PNG de la app (iOS y Android no aceptan SVG como icono instalable).
// Dibuja lo mismo que public/icon.svg. Uso: npm run icons
import { writeFileSync } from 'node:fs'
import { crc32, deflateSync } from 'node:zlib'

const BG = [14, 15, 17]
const FG = [61, 214, 140]
const C = 256 // centro, en el lienzo de 512 del SVG
const R = 120 // radio del anillo
const HALF = 22 // medio grosor del trazo
const FROM = 45 // el arco empieza a 45° y recorre 560 unidades de trazo
const SWEEP = (560 / R) * (180 / Math.PI)

const cap = (deg) => [C + R * Math.cos((deg * Math.PI) / 180), C + R * Math.sin((deg * Math.PI) / 180)]
const caps = [cap(FROM), cap(FROM + SWEEP)]

function inside(x, y) {
  const dx = x - C
  const dy = y - C
  const d = Math.hypot(dx, dy)
  if (d <= 26) return true
  if (caps.some(([cx, cy]) => Math.hypot(x - cx, y - cy) <= HALF)) return true
  if (Math.abs(d - R) > HALF) return false
  const angle = (((Math.atan2(dy, dx) * 180) / Math.PI - FROM) % 360 + 360) % 360
  return angle <= SWEEP
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

function png(size) {
  const SS = 4 // muestras por lado en cada píxel, para suavizar bordes
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1)
    for (let x = 0; x < size; x++) {
      let hits = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++)
          if (inside(((x + (sx + 0.5) / SS) * 512) / size, ((y + (sy + 0.5) / SS) * 512) / size)) hits++
      const a = hits / (SS * SS)
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 2, 0, 0, 0], 8) // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size))
  console.log(name)
}
