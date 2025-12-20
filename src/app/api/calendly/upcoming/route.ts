import { NextRequest, NextResponse } from 'next/server'
import { addDays } from 'date-fns'
import { createCalendlyService, createCalendlyServiceFromSupabase, parseStoreInfo } from '@/lib/integrations/calendly'
import { createClient } from '@/lib/supabase/server'

const MAX_EVENTS = 200
const MAX_PAGES = 10

export async function GET(request: NextRequest) {
  try {
    // Obtener el servicio desde la base de datos (solo OAuth, API Key ya no es soportada)
    const supabase = await createClient()
    const calendlyService = await createCalendlyServiceFromSupabase(supabase)
    
    if (!calendlyService) {
      // Si no hay servicio OAuth, devolver respuesta vacía
      return NextResponse.json({
        events: [],
        total: 0,
        message: 'Calendly no está conectado. Por favor, conecta Calendly desde la página de Integraciones usando OAuth 2.0.',
      })
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

    const storeFilter = searchParams.get('store')
    const eventTypeFilter = searchParams.get('event_type')
    const roomFilter = searchParams.get('room')

    const now = new Date()
    const endDate = addDays(now, days)

    // Obtener usuario y organización según documentación oficial de Calendly
    // El endpoint /users/me devuelve tanto el URI del usuario como current_organization
    let currentUser
    try {
      currentUser = await calendlyService.getCurrentUser()
    } catch (error: any) {
      // Si falla la autenticación (token inválido o expirado), devolver respuesta vacía
      console.error('[Calendly Upcoming] Error de autenticación:', error)
      return NextResponse.json({
        events: [],
        total: 0,
        message: 'Error de autenticación con Calendly. Por favor, reconecta Calendly desde la página de Integraciones.',
      })
    }
    
    const userUri = currentUser.resource.uri
    // Según la documentación oficial, current_organization viene directamente en /users/me
    let organizationUri = currentUser.resource.current_organization
    
    console.log(`[Calendly Upcoming] userUri: ${userUri}`)
    console.log(`[Calendly Upcoming] current_organization (desde /users/me): ${organizationUri || 'no disponible'}`)
    
    if (!userUri) {
      throw new Error('No se pudo obtener el URI del usuario de Calendly')
    }
    
    // Si no hay current_organization en /users/me, intentar obtenerla de organization_memberships como fallback
    if (!organizationUri) {
      try {
        console.log('[Calendly Upcoming] current_organization no disponible, intentando obtener de organization_memberships...')
        const orgMemberships = await calendlyService.getCurrentOrganization()
        organizationUri = orgMemberships.collection?.[0]?.organization?.uri
        console.log(`[Calendly Upcoming] organizationUri (desde organization_memberships): ${organizationUri || 'no encontrada'}`)
      } catch (error) {
        console.warn('[Calendly Upcoming] Error obteniendo organización (usando userUri):', error)
        organizationUri = undefined
      }
    }
    
    const useUserUri = !organizationUri
    console.log(`[Calendly Upcoming] useUserUri: ${useUserUri}`)

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
      const eventParams: Parameters<typeof calendlyService.getScheduledEvents>[0] = {
        minStartTime: now.toISOString(),
        maxStartTime: endDate.toISOString(),
        status: 'active',
        count: 100,
        pageToken,
      }
      
      // Asegurarse de que siempre se pase userUri o organizationUri
      if (useUserUri && userUri) {
        eventParams.userUri = userUri
        console.log(`[Calendly Upcoming] Usando userUri: ${userUri}`)
      } else if (organizationUri) {
        eventParams.organizationUri = organizationUri
        console.log(`[Calendly Upcoming] Usando organizationUri: ${organizationUri}`)
      } else if (userUri) {
        // Fallback: usar userUri si organizationUri no está disponible
        eventParams.userUri = userUri
        console.log(`[Calendly Upcoming] Fallback: usando userUri: ${userUri}`)
      } else {
        throw new Error('No se pudo determinar userUri ni organizationUri')
      }
      
      console.log(`[Calendly Upcoming] Parámetros finales:`, JSON.stringify(eventParams, null, 2))
      const response = await calendlyService.getScheduledEvents(eventParams)

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
  } catch (error: any) {
    console.error('Calendly upcoming events error:', error)
    // Si es un error de autenticación o token inválido, devolver respuesta vacía
    if (error?.message?.includes('401') || error?.message?.includes('403') || 
        error?.message?.includes('Unauthorized') || error?.message?.includes('autenticación')) {
      return NextResponse.json({
        events: [],
        total: 0,
        message: 'Error de autenticación con Calendly. Por favor, reconecta Calendly desde la página de Integraciones.',
      })
    }
    // Para otros errores, devolver respuesta vacía con mensaje en lugar de 500
    return NextResponse.json({
      events: [],
      total: 0,
      message: 'No se pudieron obtener las próximas citas de Calendly. Por favor, verifica la conexión.',
    })
  }
}


