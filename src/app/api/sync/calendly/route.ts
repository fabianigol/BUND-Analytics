import { NextRequest, NextResponse } from 'next/server'
import { createCalendlyService, createCalendlyServiceFromSupabase, parseStoreInfo } from '@/lib/integrations/calendly'
import { createServiceRoleClient, createClient } from '@/lib/supabase/server'

const MAX_PAGES = 300 // Para manejar 20,000+ citas (100 eventos por página = 30,000 máximo)
const DELAY_BETWEEN_PAGES = 1500 // 1.5 segundos entre páginas para evitar rate limiting (429)
const DELAY_BETWEEN_API_CALLS = 300 // 300ms entre llamadas a API individuales

export async function POST(request: NextRequest) {
  try {
    // Intentar usar service role client, si no está disponible usar cliente normal
    let supabase
    try {
      supabase = createServiceRoleClient()
    } catch (error) {
      console.warn('Service role key no configurada, usando cliente normal:', error)
      supabase = await createClient()
    }

    // Intentar obtener el servicio desde variables de entorno o base de datos
    let calendlyService = createCalendlyService()
    
    if (!calendlyService) {
      // Si no está en variables de entorno, intentar desde la base de datos
      calendlyService = await createCalendlyServiceFromSupabase(supabase)
    }
    
    if (!calendlyService) {
      return NextResponse.json(
        { error: 'Calendly integration not configured. Please connect Calendly from the Integrations page or add CALENDLY_API_KEY to environment variables.' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const syncAll2025 = searchParams.get('sync_all_2025') === 'true'

    // Determinar el rango de fechas
    let minStartTime: string
    let maxStartTime: string

    // Formatear fechas en ISO 8601 completo con milisegundos según documentación de Calendly
    // Calendly requiere fechas con milisegundos para que la paginación funcione correctamente
    const formatDateWithMilliseconds = (date: Date): string => {
      const isoString = date.toISOString()
      // Asegurar que tenga milisegundos (3 dígitos) y luego agregar microsegundos (6 dígitos totales)
      if (isoString.includes('.')) {
        const [datePart, timePart] = isoString.split('.')
        const [time, tz] = timePart.split('Z')
        const milliseconds = time.padEnd(6, '0').substring(0, 6)
        return `${datePart}.${milliseconds}Z`
      } else {
        return isoString.replace('Z', '.000000Z')
      }
    }

    if (syncAll2025 || yearParam === '2025') {
      // Sincronizar todo 2025
      minStartTime = formatDateWithMilliseconds(new Date('2025-01-01T00:00:00.000Z'))
      maxStartTime = formatDateWithMilliseconds(new Date('2025-12-31T23:59:59.999Z'))
    } else if (yearParam) {
      const year = parseInt(yearParam)
      minStartTime = formatDateWithMilliseconds(new Date(`${year}-01-01T00:00:00.000Z`))
      maxStartTime = formatDateWithMilliseconds(new Date(`${year}-12-31T23:59:59.999Z`))
    } else {
      // Por defecto, sincronizar todo 2025
      minStartTime = formatDateWithMilliseconds(new Date('2025-01-01T00:00:00.000Z'))
      maxStartTime = formatDateWithMilliseconds(new Date('2025-12-31T23:59:59.999Z'))
    }
    
    console.log(`[Calendly Sync] Rango de fechas: ${minStartTime} a ${maxStartTime}`)

    // Crear log de sincronización
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        integration: 'calendly',
        status: 'running',
        records_synced: 0,
        metadata: {
          min_start_time: minStartTime,
          max_start_time: maxStartTime,
        },
      } as any)
      .select()
      .single()

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    // Obtener usuario y organización según documentación oficial de Calendly
    // El endpoint /users/me devuelve tanto el URI del usuario como current_organization
    const currentUser = await calendlyService.getCurrentUser()
    const userUri = currentUser.resource.uri
    // Según la documentación oficial, current_organization viene directamente en /users/me
    let organizationUri = currentUser.resource.current_organization
    
    console.log(`[Calendly Sync] Usuario actual: ${currentUser.resource.name} (${userUri})`)
    console.log(`[Calendly Sync] current_organization (desde /users/me): ${organizationUri || 'no disponible'}`)
    
    if (!userUri) {
      throw new Error('No se pudo obtener el URI del usuario de Calendly')
    }
    
    // Si no hay current_organization en /users/me, intentar obtenerla de organization_memberships como fallback
    if (!organizationUri) {
      try {
        console.log('[Calendly Sync] current_organization no disponible, intentando obtener de organization_memberships...')
        const orgMemberships = await calendlyService.getCurrentOrganization()
        console.log(`[Calendly Sync] Organizaciones encontradas: ${orgMemberships.collection.length}`)
        organizationUri = orgMemberships.collection[0]?.organization?.uri
        console.log(`[Calendly Sync] organizationUri (desde organization_memberships): ${organizationUri || 'no encontrada'}`)
      } catch (error) {
        console.warn('[Calendly Sync] Error obteniendo organización (usando userUri):', error)
        organizationUri = undefined
      }
    }
    
    const useUserUri = !organizationUri
    if (useUserUri) {
      console.warn('[Calendly Sync] No se encontró organización, usando user URI')
    } else {
      console.log(`[Calendly Sync] Usando organización: ${organizationUri}`)
    }

    // Cache de owners de event types
    const eventTypeOwnerCache = new Map<string, { ownerUri: string; ownerName: string }>()
    const userInfoCache = new Map<string, ReturnType<typeof parseStoreInfo>>()

    let pageToken: string | null = null
    let pagesProcessed = 0
    let totalEvents = 0
    let eventsSaved = 0
    const monthlyCounts: Record<string, { total: number; active: number; canceled: number; completed: number }> = {}

    // Obtener todos los eventos del rango de fechas
    console.log(`[Calendly Sync] Iniciando sincronización: ${minStartTime} a ${maxStartTime}`)
    console.log(`[Calendly Sync] Organization URI: ${organizationUri}`)
    console.log(`[Calendly Sync] Configurado para manejar hasta ${MAX_PAGES} páginas (${MAX_PAGES * 100} eventos máximo)`)
    
    // Función helper para hacer delay y evitar rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    
    while (pagesProcessed < MAX_PAGES) {
      try {
        const eventParams: Parameters<typeof calendlyService.getScheduledEvents>[0] = {
          minStartTime,
          maxStartTime,
          count: 100,
          pageToken,
        }
        
        if (useUserUri) {
          eventParams.userUri = userUri
          console.log(`[Calendly Sync] Configurando userUri: ${userUri}`)
        } else if (organizationUri) {
          eventParams.organizationUri = organizationUri
          console.log(`[Calendly Sync] Configurando organizationUri: ${organizationUri}`)
        } else {
          throw new Error('No se pudo determinar userUri ni organizationUri')
        }
        
        // Agregar delay entre páginas para evitar rate limiting (429 Too Many Requests)
        if (pagesProcessed > 0) {
          await delay(DELAY_BETWEEN_PAGES)
        }
        
        console.log(`[Calendly Sync] Obteniendo página ${pagesProcessed + 1}...`)
        const response = await calendlyService.getScheduledEvents(eventParams)
        console.log(`[Calendly Sync] Página ${pagesProcessed + 1}: ${response.collection.length} eventos encontrados`)

        // Procesar eventos en batch para mejor rendimiento
        const eventsToProcess = response.collection
        console.log(`[Calendly Sync] Procesando ${eventsToProcess.length} eventos de la página ${pagesProcessed + 1}...`)

        for (const event of eventsToProcess) {
          totalEvents++

          // Obtener owner del event type para parsear información (solo si no está en cache)
          let ownerName = 'Desconocido'
          let storeInfo: ReturnType<typeof parseStoreInfo> | null = null

          if (event.event_type) {
            if (!eventTypeOwnerCache.has(event.event_type)) {
              try {
                // Delay para evitar rate limiting
                await delay(DELAY_BETWEEN_API_CALLS)
                const eventTypeDetails = await calendlyService.getEventTypeDetails(
                  event.event_type
                )
                const ownerUri = eventTypeDetails.resource.owner
                await delay(DELAY_BETWEEN_API_CALLS)
                ownerName = (await calendlyService.getUser(ownerUri)).resource.name
                eventTypeOwnerCache.set(event.event_type, {
                  ownerUri,
                  ownerName,
                })
              } catch (err) {
                console.warn(`No se pudo obtener owner para event_type ${event.event_type}`, err)
                // Continuar sin owner si falla
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

          // OPTIMIZACIÓN CRÍTICA: Para 20,000+ eventos, NO obtenemos datos de invitados
          // El usuario solo necesita conteos, no nombres ni emails
          // Esto reduce las llamadas API de 20,000+ a 0, ahorrando horas de procesamiento
          let inviteeEmail = ''
          let inviteeName = ''
          
          // Comentado para optimizar: obtener invitados no es necesario para conteos
          // if (event.invitees_counter && event.invitees_counter.total > 0) {
          //   try {
          //     await delay(DELAY_BETWEEN_API_CALLS)
          //     const invitees = await calendlyService.getEventInvitees(event.uri)
          //     const invitee = invitees.collection[0]
          //     if (invitee) {
          //       inviteeEmail = invitee.email || ''
          //       inviteeName = invitee.name || ''
          //     }
          //   } catch (err) {
          //     // Silencioso para no saturar logs
          //   }
          // }

        // Determinar status
        const normalizedStatus = event.status.toLowerCase()
        const isCanceled = normalizedStatus === 'canceled' || normalizedStatus === 'cancelled'
        const isCompleted = normalizedStatus === 'completed'
        const status = isCanceled ? 'canceled' : isCompleted ? 'completed' : 'active'

        // Guardar evento en la base de datos
        // Para 20,000+ eventos, guardamos en batch para mejorar rendimiento
        const eventId = event.uri.split('/').pop() || event.uri
        const eventData = {
          id: eventId,
          event_type: event.event_type,
          event_type_name: event.name,
          start_time: event.start_time,
          end_time: event.end_time,
          invitee_email: inviteeEmail,
          invitee_name: inviteeName,
          status: status,
          metadata: {
            store: storeInfo?.store || null,
            event_type_category: storeInfo?.eventType || null,
            room: storeInfo?.room || null,
          },
        }

        // Guardar evento (upsert para evitar duplicados)
        const { error: upsertError } = await supabase
          .from('calendly_events')
          .upsert(eventData, {
            onConflict: 'id',
          } as any)

        if (upsertError) {
          console.error(`Error guardando evento ${eventId}:`, upsertError)
        } else {
          eventsSaved++
        }

        // Agregar a conteos mensuales
        const eventDate = new Date(event.start_time)
        const year = eventDate.getFullYear()
        const month = eventDate.getMonth() + 1
        const monthKey = `${year}-${month.toString().padStart(2, '0')}`

        if (!monthlyCounts[monthKey]) {
          monthlyCounts[monthKey] = { total: 0, active: 0, canceled: 0, completed: 0 }
        }

        monthlyCounts[monthKey].total++
        if (isCanceled) {
          monthlyCounts[monthKey].canceled++
        } else if (isCompleted) {
          monthlyCounts[monthKey].completed++
        } else {
          monthlyCounts[monthKey].active++
        }
        }

        const nextPageUrl = response.pagination.next_page
        if (!nextPageUrl) {
          console.log(`[Calendly Sync] No hay más páginas. Total procesado: ${pagesProcessed + 1} páginas`)
          break
        }

        // Extraer el page_token de la URL de next_page
        // La URL puede ser relativa o absoluta
        try {
          let url: URL
          if (nextPageUrl.startsWith('http')) {
            url = new URL(nextPageUrl)
          } else {
            // Si es relativa, construir URL completa
            url = new URL(nextPageUrl, 'https://api.calendly.com')
          }
          
          const nextToken = url.searchParams.get('page_token')
          if (!nextToken) {
            console.log(`[Calendly Sync] No se encontró page_token en next_page URL: ${nextPageUrl}`)
            console.log(`[Calendly Sync] URL parseada:`, url.toString())
            console.log(`[Calendly Sync] Search params:`, Array.from(url.searchParams.entries()))
            break
          }
          
          // Validar que el token no esté vacío
          if (nextToken.trim().length === 0) {
            console.log(`[Calendly Sync] page_token está vacío`)
            break
          }
          
          pageToken = nextToken
          pagesProcessed++

          // Log de progreso cada 5 páginas para mejor seguimiento
          if (pagesProcessed % 5 === 0) {
            const progress = ((pagesProcessed / MAX_PAGES) * 100).toFixed(1)
            console.log(`[Calendly Sync] Progreso: ${progress}% - ${pagesProcessed} páginas, ${totalEvents} eventos encontrados, ${eventsSaved} guardados`)
          }
        } catch (urlError) {
          console.error(`[Calendly Sync] Error parseando next_page URL: ${nextPageUrl}`, urlError)
          break
        }
      } catch (pageError) {
        console.error(`[Calendly Sync] Error en página ${pagesProcessed + 1}:`, pageError)
        throw pageError
      }
    }

    // Guardar conteos agregados por mes
    for (const [monthKey, counts] of Object.entries(monthlyCounts)) {
      const [year, month] = monthKey.split('-').map(Number)
      const countId = monthKey

      const { error: countError } = await supabase
        .from('calendly_appointment_counts')
        .upsert(
          {
            id: countId,
            year,
            month,
            total_count: counts.total,
            active_count: counts.active,
            canceled_count: counts.canceled,
            completed_count: counts.completed,
            updated_at: new Date().toISOString(),
          } as any,
          {
            onConflict: 'id',
          }
        )

      if (countError) {
        console.error(`Error guardando conteo para ${monthKey}:`, countError)
      }
    }

    // Actualizar log de sincronización
    if (syncLog) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'success',
          records_synced: eventsSaved,
          completed_at: new Date().toISOString(),
          metadata: {
            ...(syncLog.metadata as any || {}),
            total_events_found: totalEvents,
            events_saved: eventsSaved,
            monthly_counts: monthlyCounts,
            pages_processed: pagesProcessed,
          },
        } as any)
        .eq('id', syncLog.id)
    }

    // Actualizar última sincronización
    await supabase
      .from('integration_settings')
      .update({
        last_sync: new Date().toISOString(),
        connected: true,
      } as any)
      .eq('integration', 'calendly')

    const estimatedTime = ((pagesProcessed * DELAY_BETWEEN_PAGES) / 1000 / 60).toFixed(1)
    
    return NextResponse.json({
      success: true,
      message: `Sincronización completada: ${eventsSaved} eventos guardados de ${totalEvents} encontrados`,
      records_synced: eventsSaved,
      total_events_found: totalEvents,
      pages_processed: pagesProcessed,
      monthly_counts: monthlyCounts,
      date_range: {
        min_start_time: minStartTime,
        max_start_time: maxStartTime,
      },
      summary: {
        total_events: totalEvents,
        events_saved: eventsSaved,
        events_failed: totalEvents - eventsSaved,
        pages_processed: pagesProcessed,
        estimated_time_minutes: estimatedTime,
      },
    })
  } catch (error) {
    console.error('Calendly sync error:', error)
    
    // Intentar actualizar el log de error
    try {
      let supabase
      try {
        supabase = createServiceRoleClient()
      } catch {
        supabase = await createClient()
      }
      const { data: recentLogs } = await supabase
        .from('sync_logs')
        .select('id')
        .eq('integration', 'calendly')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)

      if (recentLogs && recentLogs.length > 0) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            error_message: String(error),
            completed_at: new Date().toISOString(),
          } as any)
          .eq('id', recentLogs[0].id)
      }
    } catch (logUpdateError) {
      console.error('Error updating sync log:', logUpdateError)
    }

    return NextResponse.json(
      { error: 'Failed to sync Calendly data', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to trigger Calendly sync',
    configured: !!process.env.CALENDLY_API_KEY,
    endpoints: {
      sync_all_2025: 'POST /api/sync/calendly?sync_all_2025=true',
      sync_year: 'POST /api/sync/calendly?year=2025',
      get_counts: 'GET /api/calendly/counts?year=2025',
    },
    description: 'Para sincronizar todas las citas de 2025, usa: POST /api/sync/calendly?sync_all_2025=true'
  })
}
