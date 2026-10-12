export interface Category {
  id: string
  name: string
  icon: string
  words: string[]
}

export const CATEGORIES: Category[] = [
  { id: 'comida', name: 'Comida', icon: '🍽️', words: ['comida', 'almuerzo', 'cena', 'desayuno', 'restaurante', 'menu', 'pizza', 'burger', 'hamburguesa', 'sushi', 'tacos', 'bar', 'cerveza', 'cana', 'tapas', 'delivery', 'glovo', 'rappi', 'ubereats', 'cafe', 'cafeteria', 'starbucks', 'helado', 'merienda', 'bocadillo', 'kebab'] },
  { id: 'super', name: 'Supermercado', icon: '🛒', words: ['super', 'supermercado', 'mercado', 'mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'walmart', 'compra', 'fruta', 'verdura', 'panaderia', 'pan', 'carniceria', 'fruteria'] },
  { id: 'transporte', name: 'Transporte', icon: '🚌', words: ['uber', 'taxi', 'cabify', 'didi', 'bus', 'metro', 'tren', 'gasolina', 'gasolinera', 'diesel', 'parking', 'peaje', 'bici', 'transporte', 'renfe', 'abono', 'coche', 'taller'] },
  { id: 'hogar', name: 'Hogar', icon: '🏠', words: ['alquiler', 'renta', 'hipoteca', 'luz', 'agua', 'gas', 'internet', 'wifi', 'fibra', 'comunidad', 'ikea', 'muebles', 'limpieza', 'electricidad', 'movil', 'telefono'] },
  { id: 'ocio', name: 'Ocio', icon: '🎬', words: ['cine', 'concierto', 'teatro', 'fiesta', 'copas', 'discoteca', 'juego', 'videojuego', 'steam', 'entrada', 'entradas', 'museo', 'libro', 'ocio'] },
  { id: 'salud', name: 'Salud', icon: '💊', words: ['farmacia', 'medico', 'dentista', 'gimnasio', 'gym', 'fisio', 'psicologo', 'optica', 'seguro', 'medicina', 'salud'] },
  { id: 'compras', name: 'Compras', icon: '🛍️', words: ['ropa', 'zapatos', 'zapatillas', 'amazon', 'zara', 'compras', 'regalo', 'electronica', 'shein', 'aliexpress', 'peluqueria', 'barberia'] },
  { id: 'suscripciones', name: 'Suscripciones', icon: '🔁', words: ['netflix', 'spotify', 'hbo', 'disney', 'prime', 'icloud', 'youtube', 'suscripcion', 'chatgpt', 'claude', 'dropbox', 'max'] },
  { id: 'educacion', name: 'Educación', icon: '📚', words: ['curso', 'matricula', 'universidad', 'colegio', 'academia', 'clase', 'clases', 'udemy'] },
  { id: 'viajes', name: 'Viajes', icon: '✈️', words: ['vuelo', 'hotel', 'airbnb', 'booking', 'viaje', 'hostal', 'ryanair', 'maleta'] },
  { id: 'otros', name: 'Otros', icon: '•', words: [] },
  { id: 'ingreso', name: 'Ingreso', icon: '💰', words: ['nomina', 'sueldo', 'salario', 'ingreso', 'paga', 'bizum', 'devolucion', 'freelance'] },
]

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'ingreso')

const byId = new Map(CATEGORIES.map((c) => [c.id, c]))
export const cat = (id: string) => byId.get(id) ?? byId.get('otros')!

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Deduce la categoría a partir del texto; `null` si no hay ninguna pista. */
export function detectCategory(text: string): string | null {
  const tokens = normalize(text).split(/[^a-z0-9]+/).filter(Boolean)
  for (const c of CATEGORIES) if (tokens.some((t) => c.words.includes(t))) return c.id
  for (const c of CATEGORIES)
    if (tokens.some((t) => c.words.some((w) => w.length >= 5 && t.startsWith(w)))) return c.id
  return null
}
