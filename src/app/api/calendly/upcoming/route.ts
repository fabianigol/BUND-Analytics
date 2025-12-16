import { NextRequest, NextResponse } from 'next/server'
import { addDays } from 'date-fns'
import { createCalendlyService, parseStoreInfo } from '@/lib/integrations/calendly'

const MAX_EVENTS = 200
const MAX_PAGES = 10

export async function GET(request: NextRequest) {
  try {
    const calendlyService = createCalendlyService()
    if (!calendlyService) {
      return NextResponse.json(
        {
          error:
            'Integración de Calendly no configurada. Añade CALENDLY_API_KEY a las variables de entorno.',
        },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get('days')
    const days = daysParam ? Number(daysParam) : 7

    if (!Number.isFinite(days) || days <= 0 || days > 30) {
      return NextResponse.json(
        { error: 'Parámetro days inválido. Debe estar entre 1 y 30.' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const storeFilter = searchParams.get('store')
    const eventTypeFilter = searchParams.get('event_type')
    const roomFilter = searchParams.get('room')

    const now = new Date()
    const endDate = addDays(now, days)

    // Obtener organización del usuario actual
    const currentUser = await calendlyService.getCurrentUser()
    const orgMemberships = await calendlyService.getCurrentOrganization()
    const organizationUri = orgMemberships.collection[0]?.organization?.uri

    // Cache de owners de event types
    const eventTypeOwnerCache = new Map<string, { ownerUri: string; ownerName: string }>()
    const userInfoCache = new Map<string, ReturnType<typeof parseStoreInfo>>()

    let pageToken: string | null = null
    let pagesProcessed = 0
    const upcomingEvents: Array<{
      id: string
      name: string
      status: string
      start_time: string
      end_time: string
      event_type: string
      invitee_name?: string
      invitee_email?: string
      store?: string | null
      event_type_category?: 'Fitting' | 'Medición' | null
      room?: 'I' | 'II' | null
      created_at: string
    }> = []

    while (pagesProcessed < MAX_PAGES && upcomingEvents.length < MAX_EVENTS) {
      const response = await calendlyService.getScheduledEvents({
        organizationUri,
        minStartTime: now.toISOString(),
        maxStartTime: endDate.toISOString(),
        status: 'active',
        count: 100,
        pageToken,
      })

      for (const event of response.collection) {
        if (upcomingEvents.length >= MAX_EVENTS) break

        // Obtener owner del event type
        let ownerName = 'Desconocido'
        let storeInfo: ReturnType<typeof parseStoreInfo> | null = null

        if (event.event_type) {
          if (!eventTypeOwnerCache.has(event.event_type)) {
            try {
              const eventTypeDetails = await calendlyService.getEventTypeDetails(
                event.event_type
              )
              const ownerUri = eventTypeDetails.resource.owner
              ownerName = (await calendlyService.getUser(ownerUri)).resource.name
              eventTypeOwnerCache.set(event.event_type, {
                ownerUri,
                ownerName,
              })
            } catch (err) {
              console.warn(`No se pudo obtener owner para event_type ${event.event_type}`, err)
            }
          } else {
            ownerName = eventTypeOwnerCache.get(event.event_type)!.ownerName
          }

          // Parsear información de tienda, tipo y sala
          if (!userInfoCache.has(ownerName)) {
            storeInfo = parseStoreInfo(ownerName)
            userInfoCache.set(ownerName, storeInfo)
          } else {
            storeInfo = userInfoCache.get(ownerName)!
          }
        }

        // Aplicar filtros
        if (storeFilter && storeInfo?.store !== storeFilter) {
          continue
        }
        if (eventTypeFilter && storeInfo?.eventType !== eventTypeFilter) {
          continue
        }
        if (roomFilter && storeInfo?.room !== roomFilter) {
          continue
        }

        const invitees = await calendlyService.getEventInvitees(event.uri)
        const invitee = invitees.collection[0]

        upcomingEvents.push({
          id: event.uri.split('/').pop() || event.uri,
          name: event.name,
          status: event.status,
          start_time: event.start_time,
          end_time: event.end_time,
          event_type: event.event_type,
          invitee_name: invitee?.name,
          invitee_email: invitee?.email,
          store: storeInfo?.store || null,
          event_type_category: storeInfo?.eventType || null,
          room: storeInfo?.room || null,
          created_at: event.created_at,
        })
      }

      const nextPageUrl = response.pagination.next_page
      if (!nextPageUrl || upcomingEvents.length >= MAX_EVENTS) {
        break
      }

      const url = new URL(nextPageUrl)
      const nextToken = url.searchParams.get('page_token')
      if (!nextToken) {
        break
      }

      pageToken = nextToken
      pagesProcessed++
    }

    return NextResponse.json({
      success: true,
      days,
      total_events: upcomingEvents.length,
      events: upcomingEvents,
      filters_applied: {
        store: storeFilter || null,
        event_type: eventTypeFilter || null,
        room: roomFilter || null,
      },
      pagination: {
        pages_processed: pagesProcessed + 1,
        max_pages: MAX_PAGES,
      },
    })
  } catch (error) {
    console.error('Calendly upcoming events error:', error)
    return NextResponse.json(
      { error: 'No se pudieron obtener las próximas citas de Calendly.' },
      { status: 500 }
    )
  }
}


