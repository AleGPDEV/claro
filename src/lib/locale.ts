const REGION_CURRENCY: Record<string, string> = {
  ES: 'EUR', MX: 'MXN', CO: 'COP', AR: 'ARS', CL: 'CLP', PE: 'PEN', DO: 'DOP', UY: 'UYU',
  US: 'USD', GB: 'GBP', BR: 'BRL', EC: 'USD', PA: 'USD', SV: 'USD', CR: 'CRC', GT: 'GTQ',
  BO: 'BOB', PY: 'PYG', VE: 'USD', HN: 'HNL', NI: 'NIO', FR: 'EUR', DE: 'EUR', IT: 'EUR', PT: 'EUR',
}

// La zona horaria dice dónde vive el usuario aunque el navegador esté en "es" o "es-419".
const ZONE_CURRENCY: [prefix: string, currency: string][] = [
  ['America/Montevideo', 'UYU'],
  ['America/Argentina/', 'ARS'], ['America/Buenos_Aires', 'ARS'],
  ['America/Mexico_City', 'MXN'], ['America/Monterrey', 'MXN'], ['America/Tijuana', 'MXN'], ['America/Cancun', 'MXN'],
  ['America/Merida', 'MXN'], ['America/Chihuahua', 'MXN'], ['America/Hermosillo', 'MXN'], ['America/Mazatlan', 'MXN'],
  ['America/Bogota', 'COP'], ['America/Santiago', 'CLP'], ['America/Punta_Arenas', 'CLP'], ['America/Lima', 'PEN'],
  ['America/Sao_Paulo', 'BRL'], ['America/Bahia', 'BRL'], ['America/Fortaleza', 'BRL'], ['America/Recife', 'BRL'], ['America/Manaus', 'BRL'],
  ['America/Asuncion', 'PYG'], ['America/La_Paz', 'BOB'], ['America/Santo_Domingo', 'DOP'], ['America/Costa_Rica', 'CRC'],
  ['America/Guatemala', 'GTQ'], ['America/Tegucigalpa', 'HNL'], ['America/Managua', 'NIO'],
  ['America/Guayaquil', 'USD'], ['America/Panama', 'USD'], ['America/El_Salvador', 'USD'],
  ['Europe/Madrid', 'EUR'], ['Atlantic/Canary', 'EUR'], ['Europe/Paris', 'EUR'], ['Europe/Berlin', 'EUR'],
  ['Europe/Rome', 'EUR'], ['Europe/Lisbon', 'EUR'], ['Europe/London', 'GBP'],
]

export const CURRENCIES = [...new Set(Object.values(REGION_CURRENCY))].sort()

function regionOf(language: string) {
  try {
    return new Intl.Locale(language).region
  } catch {
    return undefined
  }
}

export function guessCurrency(languages: readonly string[], timeZone: string) {
  const zone = ZONE_CURRENCY.find(([prefix]) => timeZone.startsWith(prefix))
  if (zone) return zone[1]
  for (const language of languages) {
    const region = regionOf(language)
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region]
  }
  return 'USD'
}

/** Separador decimal del idioma del navegador ("," en español). */
export const decimalSeparator = () =>
  new Intl.NumberFormat().formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.'
