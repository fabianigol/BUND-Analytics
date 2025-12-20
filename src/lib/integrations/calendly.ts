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
  accessToken: string // OAuth access token (required)
  refreshToken?: string // OAuth refresh token
  expiresAt?: string | null // Token expiration time
  clientId?: string // OAuth client ID for refresh
  clientSecret?: string // OAuth client secret for refresh
  onTokenRefresh?: (tokens: { access_token: string; refresh_token?: string; expires_at?: string | null }) => Promise<void>
}

export class CalendlyService {
  private accessToken: string
  private refreshToken?: string
  private expiresAt?: string | null
  private clientId?: string
  private clientSecret?: string
  private onTokenRefresh?: (tokens: { access_token: string; refresh_token?: string; expires_at?: string | null }) => Promise<void>

  constructor(config: CalendlyConfig) {
    if (!config.accessToken) {
      throw new Error('OAuth accessToken is required. API Key support has been removed. Please use OAuth 2.0.')
    }
    this.accessToken = config.accessToken
    this.refreshToken = config.refreshToken
    this.expiresAt = config.expiresAt
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.onTokenRefresh = config.onTokenRefresh
  }

  private async ensureValidToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('No access token available')
    }

    // Check if token is expired or about to expire (refresh 5 minutes before expiration)
    if (this.expiresAt) {
      const expiresAt = new Date(this.expiresAt)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      if (expiresAt <= fiveMinutesFromNow) {
        console.log('[Calendly OAuth] Token expired or expiring soon, refreshing...')
        await this.refreshAccessToken()
      }
    }

    return this.accessToken
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error('Cannot refresh token: missing refresh_token, client_id, or client_secret')
    }

    const redirectUri = process.env.CALENDLY_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/calendly/callback`

    try {
      const response = await fetch('https://auth.calendly.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: redirectUri,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`)
      }

      const tokenData = await response.json()
      const { access_token, refresh_token, expires_in } = tokenData

      if (!access_token) {
        throw new Error('No access token received from refresh')
      }

      // Update tokens
      this.accessToken = access_token
      if (refresh_token) {
        this.refreshToken = refresh_token
      }
      this.expiresAt = expires_in
        ? new Date(Date.now() + expires_in * 1000).toISOString()
        : null

      // Call callback to save updated tokens
      if (this.onTokenRefresh) {
        await this.onTokenRefresh({
          access_token: this.accessToken,
          refresh_token: this.refreshToken,
          expires_at: this.expiresAt,
        })
      }

      console.log('[Calendly OAuth] Token refreshed successfully')
    } catch (error) {
      console.error('[Calendly OAuth] Error refreshing token:', error)
      throw error
    }
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${CALENDLY_API_URL}${endpoint}`
    console.log(`[Calendly API] Request: ${url}`)
    
    const token = await this.ensureValidToken()
    
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      // If 401, try refreshing token once
      if (response.status === 401 && this.accessToken) {
        console.log('[Calendly API] Got 401, attempting token refresh...')
        try {
          await this.refreshAccessToken()
          const newToken = await this.ensureValidToken()
          
          // Retry request with new token
          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              Authorization: `Bearer ${newToken}`,
              'Content-Type': 'application/json',
              ...options?.headers,
            },
          })

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text().catch(() => retryResponse.statusText)
            console.error(`[Calendly API] Error ${retryResponse.status} after refresh: ${errorText}`)
            throw new Error(`Calendly API error: ${retryResponse.status} ${retryResponse.statusText} - ${errorText}`)
          }

          return retryResponse.json()
        } catch (refreshError) {
          console.error('[Calendly API] Token refresh failed:', refreshError)
          throw new Error('Authentication failed: unable to refresh token')
        }
      }

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

// Factory function to create service instance from Supabase settings (OAuth only)
export async function createCalendlyServiceFromSupabase(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<CalendlyService | null> {
  try {
    const { data, error } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('integration', 'calendly')
      .single()

    if (error || !data) {
      console.log('[Calendly Service] No integration settings found in database')
      return null
    }

    const settings = (data as any).settings || {}
    
    // OAuth tokens are required - API Key support has been removed
    if (!settings.access_token) {
      console.log('[Calendly Service] No OAuth access_token found in settings')
      return null
    }

    const clientId = process.env.CALENDLY_CLIENT_ID
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.warn('[Calendly Service] OAuth tokens found but CLIENT_ID/CLIENT_SECRET not configured. Token refresh will not work.')
    }

    // Create callback to save refreshed tokens
    const onTokenRefresh = async (tokens: { access_token: string; refresh_token?: string; expires_at?: string | null }) => {
      await supabase
        .from('integration_settings')
        .update({
          settings: {
            ...settings,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || settings.refresh_token,
            expires_at: tokens.expires_at || settings.expires_at,
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('integration', 'calendly')
    }

    return new CalendlyService({
      accessToken: settings.access_token,
      refreshToken: settings.refresh_token,
      expiresAt: settings.expires_at,
      clientId,
      clientSecret,
      onTokenRefresh,
    })
  } catch (error) {
    console.error('[Calendly Service] Error loading configuration from database:', error)
    return null
  }
}

