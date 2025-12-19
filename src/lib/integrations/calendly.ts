import { CalendlyEvent } from '@/types'

const CALENDLY_API_URL = 'https://api.calendly.com'

// Utilidades para parsear información de tienda, tipo y sala desde nombres de usuarios
export interface StoreInfo {
  store: string | null
  eventType: 'Fitting' | 'Medición' | null
  room: 'I' | 'II' | null
  fullName: string
}

/**
 * Extrae información de tienda, tipo de evento y sala del nombre del usuario de Calendly
 * Ejemplos:
 * - "The Bundclub Madrid [Fitting I]" → { store: "Madrid", eventType: "Fitting", room: "I" }
 * - "The Bundclub Sevilla [Medición II]" → { store: "Sevilla", eventType: "Medición", room: "II" }
 */
export function parseStoreInfo(userName: string): StoreInfo {
  const fullName = userName.trim()
  
  // Extraer tienda (ciudad) - busca "The Bundclub [Ciudad]"
  const storeMatch = fullName.match(/The Bundclub\s+([^[\]]+)/i)
  const store = storeMatch ? storeMatch[1].trim() : null

  // Extraer tipo de evento y sala - busca "[Tipo Sala]" o "[Tipo I]" o "[Tipo II]"
  const bracketMatch = fullName.match(/\[([^\]]+)\]/)
  let eventType: 'Fitting' | 'Medición' | null = null
  let room: 'I' | 'II' | null = null

  if (bracketMatch) {
    const bracketContent = bracketMatch[1].trim()
    
    // Detectar tipo de evento
    if (bracketContent.toLowerCase().includes('fitting')) {
      eventType = 'Fitting'
    } else if (bracketContent.toLowerCase().includes('medición') || bracketContent.toLowerCase().includes('medicion')) {
      eventType = 'Medición'
    }

    // Detectar sala (I o II)
    if (bracketContent.match(/\bI\b/) && !bracketContent.match(/\bII\b/)) {
      room = 'I'
    } else if (bracketContent.match(/\bII\b/)) {
      room = 'II'
    } else if (bracketContent.match(/\b1\b/) && !bracketContent.match(/\b2\b/)) {
      room = 'I'
    } else if (bracketContent.match(/\b2\b/)) {
      room = 'II'
    }
  }

  return {
    store,
    eventType,
    room,
    fullName,
  }
}

interface CalendlyConfig {
  apiKey: string
}

export class CalendlyService {
  private apiKey: string

  constructor(config: CalendlyConfig) {
    this.apiKey = config.apiKey
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${CALENDLY_API_URL}${endpoint}`
    console.log(`[Calendly API] Request: ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      console.error(`[Calendly API] Error ${response.status}: ${errorText}`)
      throw new Error(`Calendly API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }

  async getCurrentUser() {
    return this.request<{ 
      resource: { 
        uri: string
        name: string
        email: string
        current_organization?: string
      } 
    }>('/users/me')
  }

  async getScheduledEvents(params: {
    userUri?: string
    organizationUri?: string
    minStartTime?: string
    maxStartTime?: string
    status?: 'active' | 'canceled'
    count?: number
    pageToken?: string | null
  }) {
    const searchParams = new URLSearchParams()
    if (params.userUri) {
      searchParams.set('user', params.userUri)
      console.log(`[Calendly API] Usando user URI: ${params.userUri}`)
    }
    if (params.organizationUri) {
      // La API de Calendly espera la URI completa de la organización
      searchParams.set('organization', params.organizationUri)
      console.log(`[Calendly API] Usando organization URI: ${params.organizationUri}`)
    }
    
    if (!params.userUri && !params.organizationUri) {
      console.error('[Calendly API] Error: ni userUri ni organizationUri están definidos')
      throw new Error('Se requiere userUri o organizationUri para obtener eventos programados')
    }
    
    if (params.minStartTime) {
      searchParams.set('min_start_time', params.minStartTime)
    }
    if (params.maxStartTime) {
      searchParams.set('max_start_time', params.maxStartTime)
    }
    if (params.status) {
      searchParams.set('status', params.status)
    }
    if (params.count) {
      searchParams.set('count', params.count.toString())
    }
    if (params.pageToken) {
      searchParams.set('page_token', params.pageToken)
      console.log(`[Calendly API] Usando page_token: ${params.pageToken.substring(0, 20)}...`)
    }
    
    const finalUrl = `/scheduled_events?${searchParams.toString()}`
    console.log(`[Calendly API] URL final: ${finalUrl}`)
    // No loguear parámetros completos para evitar exponer tokens

    return this.request<{
      collection: Array<{
        uri: string
        name: string
        status: string
        start_time: string
        end_time: string
        event_type: string
        location: { type: string; location?: string }
        invitees_counter: { active: number; total: number }
        created_at: string
        updated_at: string
      }>
      pagination: { count: number; next_page: string | null }
    }>(`/scheduled_events?${searchParams}`)
  }

  async getEventInvitees(eventUri: string) {
    const eventUuid = eventUri.split('/').pop()
    return this.request<{
      collection: Array<{
        uri: string
        email: string
        name: string
        status: string
        created_at: string
        updated_at: string
        cancel_url: string
        reschedule_url: string
      }>
    }>(`/scheduled_events/${eventUuid}/invitees`)
  }

  async getEventTypes(userUri?: string) {
    const searchParams = new URLSearchParams()
    if (userUri) {
      searchParams.set('user', userUri)
    }
    const query = searchParams.toString()
    return this.request<{
      collection: Array<{
        uri: string
        name: string
        active: boolean
        slug: string
        duration: number
        kind: string
        type: string
        owner: string
      }>
      pagination: { count: number; next_page: string | null }
    }>(`/event_types${query ? `?${query}` : ''}`)
  }

  async getEventTypeDetails(eventTypeUri: string) {
    const eventTypeUuid = eventTypeUri.split('/').pop()
    return this.request<{
      resource: {
        uri: string
        name: string
        active: boolean
        slug: string
        duration: number
        kind: string
        type: string
        owner: string
      }
    }>(`/event_types/${eventTypeUuid}`)
  }

  async getOrganizationMembers(organizationUri: string) {
    const searchParams = new URLSearchParams({ organization: organizationUri })
    return this.request<{
      collection: Array<{
        uri: string
        name: string
        email: string
        slug: string
        avatar_url?: string
      }>
      pagination: { count: number; next_page: string | null }
    }>(`/organization_memberships?${searchParams}`)
  }

  async getCurrentOrganization() {
    return this.request<{
      collection: Array<{
        uri: string
        role: string
        user: {
          uri: string
          name: string
          email: string
        }
        organization: {
          uri: string
          name: string
        }
      }>
    }>('/organization_memberships')
  }

  async getUser(userUri: string) {
    const userUuid = userUri.split('/').pop()
    return this.request<{
      resource: { uri: string; name: string; email: string }
    }>(`/users/${userUuid}`)
  }

  // Transform Calendly API data to our internal format
  transformEvent(apiEvent: {
    uri: string
    name: string
    status: string
    start_time: string
    end_time: string
    event_type: string
    created_at: string
    invitee?: {
      email: string
      name: string
    }
  }): Omit<CalendlyEvent, 'id'> {
    return {
      event_type: apiEvent.event_type,
      event_type_name: apiEvent.name,
      start_time: apiEvent.start_time,
      end_time: apiEvent.end_time,
      invitee_email: apiEvent.invitee?.email || '',
      invitee_name: apiEvent.invitee?.name || '',
      status: apiEvent.status as 'active' | 'canceled' | 'completed',
      metadata: {},
      created_at: apiEvent.created_at,
    }
  }
}

// Factory function to create service instance
export function createCalendlyService(): CalendlyService | null {
  const apiKey = process.env.CALENDLY_API_KEY
  if (!apiKey) return null
  return new CalendlyService({ apiKey })
}

// Factory function to create service instance from Supabase settings
export async function createCalendlyServiceFromSupabase(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<CalendlyService | null> {
  // Primero intentar desde variables de entorno
  const envApiKey = process.env.CALENDLY_API_KEY
  if (envApiKey) {
    return new CalendlyService({ apiKey: envApiKey })
  }

  // Si no está en variables de entorno, buscar en la base de datos
  try {
    const { data, error } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('integration', 'calendly')
      .single()

    if (error || !data) {
      return null
    }

    const settings = (data as any).settings || {}
    const apiKey = settings.api_key

    if (!apiKey) {
      return null
    }

    return new CalendlyService({ apiKey })
  } catch (error) {
    console.error('Error loading Calendly API key from database:', error)
    return null
  }
}

