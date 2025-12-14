import { CalendlyEvent } from '@/types'

const CALENDLY_API_URL = 'https://api.calendly.com'

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
    userUri: string
    minStartTime?: string
    maxStartTime?: string
    status?: 'active' | 'canceled'
    count?: number
  }) {
    const searchParams = new URLSearchParams({
      user: params.userUri,
      ...(params.minStartTime && { min_start_time: params.minStartTime }),
      ...(params.maxStartTime && { max_start_time: params.maxStartTime }),
      ...(params.status && { status: params.status }),
      ...(params.count && { count: params.count.toString() }),
    })

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

  async getEventTypes(userUri: string) {
    const searchParams = new URLSearchParams({ user: userUri })
    return this.request<{
      collection: Array<{
        uri: string
        name: string
        active: boolean
        slug: string
        duration: number
        kind: string
        type: string
      }>
    }>(`/event_types?${searchParams}`)
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

