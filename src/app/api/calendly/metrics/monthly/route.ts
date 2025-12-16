import { NextRequest, NextResponse } from 'next/server'
import { createCalendlyService, parseStoreInfo } from '@/lib/integrations/calendly'

const MAX_PAGES = 20

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
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')

    const now = new Date()
    const year = yearParam ? Number(yearParam) : now.getFullYear()
    const month = monthParam ? Number(monthParam) : now.getMonth() + 1

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Parámetros year o month inválidos.' },
        { status: 400 }
      )
    }

    // Rango del mes solicitado
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    // Obtener organización del usuario actual
    const currentUser = await calendlyService.getCurrentUser()
    const orgMemberships = await calendlyService.getCurrentOrganization()
    const organizationUri = orgMemberships.collection[0]?.organization?.uri

    // Cache de owners de event types para evitar llamadas repetidas
    const eventTypeOwnerCache = new Map<string, { ownerUri: string; ownerName: string }>()
    const userInfoCache = new Map<string, ReturnType<typeof parseStoreInfo>>()

    let pageToken: string | null = null
    let pagesProcessed = 0

    let totalEvents = 0
    let activeEvents = 0
    let canceledEvents = 0
    const byEventType: Record<
      string,
      { count: number; active: number; canceled: number }
    > = {}
    const byStore: Record<
      string,
      { count: number; active: number; canceled: number }
    > = {}
    const byEventTypeCategory: Record<
      string,
      { count: number; active: number; canceled: number }
    > = {}
    const byRoom: Record<
      string,
      { count: number; active: number; canceled: number }
    > = {}
    const byStoreAndType: Record<
      string,
      { count: number; active: number; canceled: number }
    > = {}

    // Consultar eventos de toda la organización (no solo del usuario actual)
    while (pagesProcessed < MAX_PAGES) {
      const response = await calendlyService.getScheduledEvents({
        organizationUri,
        minStartTime: startDate.toISOString(),
        maxStartTime: endDate.toISOString(),
        count: 100,
        pageToken,
      })

      for (const event of response.collection) {
        totalEvents++

        const normalizedStatus = event.status.toLowerCase()
        const isCanceled =
          normalizedStatus === 'canceled' || normalizedStatus === 'cancelled'

        if (isCanceled) {
          canceledEvents++
        } else {
          activeEvents++
        }

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
              // Obtener nombre del owner
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

        // Agregar por tipo de evento (URI)
        const eventTypeKey = event.event_type || 'unknown'
        if (!byEventType[eventTypeKey]) {
          byEventType[eventTypeKey] = { count: 0, active: 0, canceled: 0 }
        }
        byEventType[eventTypeKey].count++
        if (isCanceled) {
          byEventType[eventTypeKey].canceled++
        } else {
          byEventType[eventTypeKey].active++
        }

        // Agregar por tienda
        if (storeInfo?.store) {
          const storeKey = storeInfo.store
          if (!byStore[storeKey]) {
            byStore[storeKey] = { count: 0, active: 0, canceled: 0 }
          }
          byStore[storeKey].count++
          if (isCanceled) {
            byStore[storeKey].canceled++
          } else {
            byStore[storeKey].active++
          }
        }

        // Agregar por tipo de evento (Fitting/Medición)
        if (storeInfo?.eventType) {
          const typeKey = storeInfo.eventType
          if (!byEventTypeCategory[typeKey]) {
            byEventTypeCategory[typeKey] = { count: 0, active: 0, canceled: 0 }
          }
          byEventTypeCategory[typeKey].count++
          if (isCanceled) {
            byEventTypeCategory[typeKey].canceled++
          } else {
            byEventTypeCategory[typeKey].active++
          }
        }

        // Agregar por sala
        if (storeInfo?.room) {
          const roomKey = storeInfo.room
          if (!byRoom[roomKey]) {
            byRoom[roomKey] = { count: 0, active: 0, canceled: 0 }
          }
          byRoom[roomKey].count++
          if (isCanceled) {
            byRoom[roomKey].canceled++
          } else {
            byRoom[roomKey].active++
          }
        }

        // Agregar por combinación tienda + tipo
        if (storeInfo?.store && storeInfo?.eventType) {
          const comboKey = `${storeInfo.store} - ${storeInfo.eventType}`
          if (!byStoreAndType[comboKey]) {
            byStoreAndType[comboKey] = { count: 0, active: 0, canceled: 0 }
          }
          byStoreAndType[comboKey].count++
          if (isCanceled) {
            byStoreAndType[comboKey].canceled++
          } else {
            byStoreAndType[comboKey].active++
          }
        }
      }

      const nextPageUrl = response.pagination.next_page
      if (!nextPageUrl) {
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
      year,
      month,
      total_events: totalEvents,
      active_events: activeEvents,
      canceled_events: canceledEvents,
      by_event_type: byEventType,
      by_store: byStore,
      by_event_type_category: byEventTypeCategory,
      by_room: byRoom,
      by_store_and_type: byStoreAndType,
      pagination: {
        pages_processed: pagesProcessed + 1,
        max_pages: MAX_PAGES,
      },
    })
  } catch (error) {
    console.error('Calendly monthly metrics error:', error)
    return NextResponse.json(
      { error: 'No se pudieron obtener las métricas mensuales de Calendly.' },
      { status: 500 }
    )
  }
}


