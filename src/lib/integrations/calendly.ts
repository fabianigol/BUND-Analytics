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
    const response = await fetch(`${CALENDLY_API_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getCurrentUser() {
    return this.request<{ resource: { uri: string; name: string; email: string } }>(
      '/users/me'
    )
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
    }
    if (params.organizationUri) {
      searchParams.set('organization', params.organizationUri)
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
    }

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

