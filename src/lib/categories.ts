export interface Category {
  id: string
  name: string
  icon: string
  /** Palabras o frases (sin acentos, en singular) que delatan la categoría. */
  words: string[]
}

export const CATEGORIES: Category[] = [
  { id: 'comida', name: 'Comida', icon: '🍽️', words: ['uber eats', 'ubereats', 'pedidos ya', 'pedidosya', 'rappi', 'glovo', 'delivery', 'comida', 'almuerzo', 'cena', 'desayuno', 'merienda', 'restaurante', 'menu', 'pizza', 'pizzeria', 'burger', 'hamburguesa', 'sushi', 'taco', 'empanada', 'chivito', 'asado', 'parrilla', 'milanesa', 'pancho', 'bar', 'cerveza', 'birra', 'cana', 'tapas', 'trago', 'copa', 'vino', 'cafe', 'cafeteria', 'starbucks', 'helado', 'heladeria', 'bocadillo', 'sandwich', 'kebab', 'mcdonalds', 'kiosco'] },
  { id: 'super', name: 'Supermercado', icon: '🛒', words: ['tienda inglesa', 'super', 'supermercado', 'mercado', 'feria', 'almacen', 'mercadona', 'carrefour', 'lidl', 'aldi', 'walmart', 'disco', 'devoto', 'tata', 'geant', 'coto', 'jumbo', 'oxxo', 'compra', 'fruta', 'verdura', 'verduleria', 'fruteria', 'panaderia', 'pan', 'carniceria', 'yerba'] },
  { id: 'transporte', name: 'Transporte', icon: '🚌', words: ['matricula del auto', 'matricula auto', 'matricula del coche', 'matricula coche', 'matricula de la moto', 'matricula moto', 'seguro auto', 'seguro del auto', 'seguro coche', 'seguro del coche', 'seguro moto', 'uber', 'taxi', 'cabify', 'didi', 'bolt', 'remis', 'bus', 'omnibus', 'colectivo', 'bondi', 'boleto', 'stm', 'metro', 'subte', 'tren', 'pasaje', 'nafta', 'gasolina', 'gasolinera', 'combustible', 'diesel', 'gasoil', 'ancap', 'parking', 'estacionamiento', 'cochera', 'peaje', 'patente', 'bici', 'transporte', 'renfe', 'abono', 'coche', 'auto', 'moto', 'taller', 'mecanico'] },
  { id: 'hogar', name: 'Hogar', icon: '🏠', words: ['gastos comunes', 'alquiler', 'renta', 'hipoteca', 'expensas', 'contribucion', 'luz', 'ute', 'agua', 'ose', 'gas', 'internet', 'wifi', 'fibra', 'antel', 'movistar', 'comunidad', 'ikea', 'mueble', 'limpieza', 'electricidad', 'movil', 'celular', 'telefono', 'ferreteria'] },
  { id: 'ocio', name: 'Ocio', icon: '🎬', words: ['cine', 'concierto', 'recital', 'teatro', 'fiesta', 'copas', 'boliche', 'discoteca', 'juego', 'videojuego', 'steam', 'playstation', 'entrada', 'museo', 'libro', 'ocio', 'futbol', 'cancha'] },
  { id: 'salud', name: 'Salud', icon: '💊', words: ['sociedad medica', 'seguro medico', 'seguro salud', 'seguro de salud', 'farmacia', 'medico', 'dentista', 'odontologo', 'gimnasio', 'gym', 'fisio', 'psicologo', 'terapia', 'optica', 'medicina', 'remedio', 'mutualista', 'salud', 'analisis'] },
  { id: 'compras', name: 'Compras', icon: '🛍️', words: ['mercado libre', 'mercadolibre', 'ropa', 'zapato', 'zapatilla', 'championes', 'remera', 'amazon', 'zara', 'compras', 'regalo', 'electronica', 'shein', 'aliexpress', 'temu', 'peluqueria', 'barberia'] },
  { id: 'suscripciones', name: 'Suscripciones', icon: '🔁', words: ['google one', 'netflix', 'spotify', 'hbo', 'disney', 'prime', 'icloud', 'youtube', 'suscripcion', 'chatgpt', 'claude', 'dropbox'] },
  { id: 'educacion', name: 'Educación', icon: '📚', words: ['curso', 'matricula', 'universidad', 'facultad', 'colegio', 'academia', 'clase', 'udemy'] },
  { id: 'viajes', name: 'Viajes', icon: '✈️', words: ['vuelo', 'hotel', 'airbnb', 'booking', 'viaje', 'hostal', 'hostel', 'ryanair', 'maleta', 'pasaporte'] },
  { id: 'otros', name: 'Otros', icon: '•', words: [] },
  { id: 'ingreso', name: 'Ingreso', icon: '💰', words: ['sueldo', 'salario', 'nomina', 'ingreso', 'aguinaldo', 'quincena', 'honorarios', 'freelance'] },
]

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'ingreso')

const byId = new Map(CATEGORIES.map((c) => [c.id, c]))
export const cat = (id: string) => byId.get(id) ?? byId.get('otros')!
export const isCategory = (id: unknown): id is string => typeof id === 'string' && byId.has(id)

const wordIndex = new Map<string, string>()
const phrases: [phrase: string, id: string][] = []
for (const c of CATEGORIES)
  for (const w of c.words) {
    if (w.includes(' ')) phrases.push([w, c.id])
    else if (!wordIndex.has(w)) wordIndex.set(w, c.id)
  }

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export const tokenize = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter(Boolean)

/** La palabra tal cual y sus posibles singulares ("cafes" → "cafe", "buses" → "bus", "luces" → "luz"). */
export const wordForms = (t: string) => [t, t.replace(/s$/, ''), t.replace(/es$/, ''), t.replace(/ces$/, 'z')]

/** Deduce la categoría a partir del texto; `null` si no hay ninguna pista. */
export function detectCategory(text: string): string | null {
  const tokens = tokenize(text)
  const padded = ` ${tokens.join(' ')} `
  for (const [phrase, id] of phrases) if (padded.includes(` ${phrase} `)) return id
  for (const t of tokens)
    for (const form of wordForms(t)) {
      const id = wordIndex.get(form)
      if (id) return id
    }
  return null
}
