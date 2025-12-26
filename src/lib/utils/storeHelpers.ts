import { normalizeStoreName } from '@/lib/integrations/acuity'

/**
 * Convierte el nombre de una tienda a slug para URLs
 */
export function storeNameToSlug(storeName: string): string {
  const normalized = storeName.toLowerCase()
  if (normalized.includes('madrid')) return 'madrid'
  if (normalized.includes('barcelona')) return 'barcelona'
  if (normalized.includes('sevilla')) return 'sevilla'
  if (normalized.includes('málaga') || normalized.includes('malaga')) return 'malaga'
  if (normalized.includes('valencia')) return 'valencia'
  if (normalized.includes('bilbao')) return 'bilbao'
  if (normalized.includes('murcia')) return 'murcia'
  if (normalized.includes('zaragoza')) return 'zaragoza'
  if (normalized.includes('cdmx') || normalized.includes('polanco')) return 'cdmx'
  return normalized.replace(/the bundclub\s+/i, '').replace(/\s+/g, '-')
}

/**
 * Convierte slug a nombre de tienda normalizado
 */
export function slugToStoreName(slug: string): string {
  const slugMap: Record<string, string> = {
    'madrid': 'The Bundclub Madrid',
    'barcelona': 'The Bundclub Barcelona',
    'sevilla': 'The Bundclub Sevilla',
    'malaga': 'The Bundclub Málaga',
    'valencia': 'The Bundclub Valencia',
    'bilbao': 'The Bundclub Bilbao',
    'murcia': 'The Bundclub Murcia',
    'zaragoza': 'The Bundclub Zaragoza',
    'cdmx': 'The Bundclub CDMX (Polanco)',
  }
  return slugMap[slug.toLowerCase()] || slug
}

/**
 * Obtiene la ruta de la imagen del club
 */
export function getClubImagePath(slug: string): string {
  return `/clubs/${slug}.jpg`
}

/**
 * Filtra los datos de stats por tienda específica
 */
export function filterStatsByStore<T extends { byStore?: Array<{ storeName: string }> }>(
  data: T | undefined | null,
  targetStoreName: string
): T | undefined {
  if (!data || !data.byStore) return undefined

  const normalizedTarget = normalizeStoreName(targetStoreName)
  const storeData = data.byStore.find(store => 
    normalizeStoreName(store.storeName) === normalizedTarget
  )

  if (!storeData) return undefined

  // Retornar solo los datos de la tienda encontrada
  return {
    ...data,
    byStore: [storeData],
  } as T
}


