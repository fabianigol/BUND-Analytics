import { NextRequest, NextResponse } from 'next/server'
import { createCalendlyService, createCalendlyServiceFromSupabase, parseStoreInfo } from '@/lib/integrations/calendly'
import { createClient } from '@/lib/supabase/server'

const MAX_PAGES = 20

export async function GET(request: NextRequest) {
  try {
    // Obtener el servicio desde la base de datos (solo OAuth, API Key ya no es soportada)
    const supabase = await createClient()
    const calendlyService = await createCalendlyServiceFromSupabase(supabase)
    
    if (!calendlyService) {
      // Si no hay servicio OAuth, devolver respuesta vacía
      return NextResponse.json({
        total_events: 0,
        active_events: 0,
        canceled_events: 0,
        by_store: {},
        by_event_type_category: {},
        by_room: {},
        message: 'Calendly no está conectado. Por favor, conecta Calendly desde la página de Integraciones usando OAuth 2.0.',
      })
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

    // Obtener usuario y organización según documentación oficial de Calendly
    // El endpoint /users/me devuelve tanto el URI del usuario como current_organization
    let currentUser
    let userUri: string | undefined
    let organizationUri: string | undefined
    
    try {
      // Intentar obtener el usuario actual
      currentUser = await calendlyService.getCurrentUser()
      userUri = currentUser.resource.uri
      // Según la documentación oficial, current_organization viene directamente en /users/me
      organizationUri = currentUser.resource.current_organization
      
      console.log(`[Calendly Metrics] Usuario obtenido: ${currentUser.resource.name}`)
      console.log(`[Calendly Metrics] userUri: ${userUri}`)
      console.log(`[Calendly Metrics] current_organization (desde /users/me): ${organizationUri || 'no disponible'}`)
    } catch (error: any) {
      // Si falla la autenticación (token inválido o expirado), devolver respuesta vacía
      console.error('[Calendly Metrics] Error de autenticación:', error)
      return NextResponse.json({
        total_events: 0,
        active_events: 0,
        canceled_events: 0,
        by_store: {},
        by_event_type_category: {},
        by_room: {},
        message: 'Error de autenticación con Calendly. Por favor, reconecta Calendly desde la página de Integraciones.',
      })
    }
    
    if (!userUri) {
      throw new Error('No se pudo obtener el URI del usuario de Calendly')
    }
    
    // Si no hay current_organization en /users/me, intentar obtenerla de organization_memberships como fallback
    if (!organizationUri) {
      try {
        console.log('[Calendly Metrics] current_organization no disponible, intentando obtener de organization_memberships...')
        const orgMemberships = await calendlyService.getCurrentOrganization()
        console.log(`[Calendly Metrics] Organizaciones encontradas: ${orgMemberships.collection?.length || 0}`)
        organizationUri = orgMemberships.collection?.[0]?.organization?.uri
        console.log(`[Calendly Metrics] organizationUri (desde organization_memberships): ${organizationUri || 'no encontrada'}`)
      } catch (error) {
        console.warn('[Calendly Metrics] Error obteniendo organización (usando userUri):', error)
        organizationUri = undefined
      }
    }
    
    const useUserUri = !organizationUri
    console.log(`[Calendly Metrics] useUserUri: ${useUserUri}`)

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
      const eventParams: Parameters<typeof calendlyService.getScheduledEvents>[0] = {
        minStartTime: startDate.toISOString(),
        maxStartTime: endDate.toISOString(),
        count: 100,
        pageToken,
      }
      
      // Asegurarse de que siempre se pase userUri o organizationUri
      if (useUserUri && userUri) {
        eventParams.userUri = userUri
        console.log(`[Calendly Metrics] Usando userUri: ${userUri}`)
      } else if (organizationUri) {
        eventParams.organizationUri = organizationUri
        console.log(`[Calendly Metrics] Usando organizationUri: ${organizationUri}`)
      } else if (userUri) {
        // Fallback: usar userUri si organizationUri no está disponible
        eventParams.userUri = userUri
        console.log(`[Calendly Metrics] Fallback: usando userUri: ${userUri}`)
      } else {
        throw new Error('No se pudo determinar userUri ni organizationUri')
      }
      
      console.log(`[Calendly Metrics] Parámetros finales:`, JSON.stringify(eventParams, null, 2))
      const response = await calendlyService.getScheduledEvents(eventParams)

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
  } catch (error: any) {
    console.error('Calendly monthly metrics error:', error)
    // Si es un error de autenticación o token inválido, devolver respuesta vacía
    if (error?.message?.includes('401') || error?.message?.includes('403') || 
        error?.message?.includes('Unauthorized') || error?.message?.includes('autenticación')) {
      return NextResponse.json({
        total_events: 0,
        active_events: 0,
        canceled_events: 0,
        by_store: {},
        by_event_type_category: {},
        by_room: {},
        message: 'Error de autenticación con Calendly. Por favor, reconecta Calendly desde la página de Integraciones.',
      })
    }
    // Para otros errores, devolver respuesta vacía con mensaje en lugar de 500
    return NextResponse.json({
      total_events: 0,
      active_events: 0,
      canceled_events: 0,
      by_store: {},
      by_event_type_category: {},
      by_room: {},
      message: 'No se pudieron obtener las métricas mensuales de Calendly. Por favor, verifica la conexión.',
    })
  }
}


