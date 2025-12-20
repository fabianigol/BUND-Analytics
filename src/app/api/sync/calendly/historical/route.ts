import { NextRequest, NextResponse } from 'next/server'
import { createCalendlyServiceFromSupabase, parseStoreInfo } from '@/lib/integrations/calendly'
import { createServiceRoleClient, createClient } from '@/lib/supabase/server'

const MAX_PAGES = 300 // Para manejar 20,000+ citas (100 eventos por página = 30,000 máximo)
const DELAY_BETWEEN_PAGES = 1500 // 1.5 segundos entre páginas para evitar rate limiting
const DELAY_BETWEEN_API_CALLS = 300 // 300ms entre llamadas a API individuales

// Helper para generar ID compuesto
function generateStatsId(
  userName: string,
  year: number,
  month: number,
  eventTypeCategory: string | null,
  status: string,
  hasUtm: boolean
): string {
  const parts = [
    userName,
    year.toString(),
    month.toString().padStart(2, '0'),
    eventTypeCategory || 'unknown',
    status,
    hasUtm ? 'utm' : 'no_utm'
  ]
  return parts.join('|')
}

// Helper para extraer UTM desde invitee tracking URL o metadata
function extractUtmParams(event: any): { has_utm: boolean; utm_params: Record<string, string> } {
  const utmParams: Record<string, string> = {}
  let hasUtm = false

  // Intentar obtener desde invitees (si hay tracking URL)
  // Nota: No obtenemos invitees para optimización, pero podemos revisar metadata
  if (event.metadata && typeof event.metadata === 'object') {
    const metadata = event.metadata as Record<string, any>
    
    // Buscar parámetros UTM en metadata
    const utmFields = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    for (const field of utmFields) {
      if (metadata[field]) {
        utmParams[field] = String(metadata[field])
        hasUtm = true
      }
    }
  }

  return { has_utm: hasUtm, utm_params: utmParams }
}

// Helper para detectar si un evento fue rescheduled
// En la API de Calendly, un evento rescheduled puede tener:
// - Una propiedad cancellation_kind === 'rescheduled' (si fue cancelado para reprogramar)
// - O podemos detectarlo si hay un nuevo evento asociado
// Por ahora, revisaremos el status y metadata para detectarlo
function detectStatus(event: any): 'active' | 'canceled' | 'rescheduled' {
  const normalizedStatus = (event.status || '').toLowerCase()
  
  // Si está explícitamente cancelado y tiene reschedule_url, probablemente fue reprogramado
  if ((normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') && event.reschedule_url) {
    return 'rescheduled'
  }

  // Si tiene metadata indicando rescheduled
  if (event.metadata && typeof event.metadata === 'object') {
    const metadata = event.metadata as Record<string, any>
    if (metadata.cancellation_kind === 'rescheduled' || metadata.rescheduled === true) {
      return 'rescheduled'
    }
  }

  // Si está cancelado
  if (normalizedStatus === 'canceled' || normalizedStatus === 'cancelled') {
    return 'canceled'
  }

  // completed se trata como active según especificación
  if (normalizedStatus === 'completed') {
    return 'active'
  }

  // Por defecto, active
  return 'active'
}

export async function POST(request: NextRequest) {
  try {
    // Intentar usar service role client
    let supabase
    try {
      supabase = createServiceRoleClient()
    } catch (error) {
      console.warn('Service role key no configurada, usando cliente normal:', error)
      supabase = await createClient()
    }

    // Obtener servicio Calendly desde Supabase (solo OAuth, API Key ya no es soportada)
    const calendlyService = await createCalendlyServiceFromSupabase(supabase)

    if (!calendlyService) {
      return NextResponse.json(
        { error: 'Calendly integration not configured. Please connect Calendly using OAuth 2.0 from the Integrations page.' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const testMonthParam = searchParams.get('test_month')
    const yearParam = searchParams.get('year') || '2025'

    // Determinar el rango de fechas
    let minStartTime: string
    let maxStartTime: string

    const formatDateWithMilliseconds = (date: Date): string => {
      const isoString = date.toISOString()
      if (isoString.includes('.')) {
        const [datePart, timePart] = isoString.split('.')
        const [time, tz] = timePart.split('Z')
        const milliseconds = time.padEnd(6, '0').substring(0, 6)
        return `${datePart}.${milliseconds}Z`
      } else {
        return isoString.replace('Z', '.000000Z')
      }
    }

    if (testMonthParam) {
      // Modo prueba: solo un mes específico
      const month = parseInt(testMonthParam)
      if (isNaN(month) || month < 1 || month > 12) {
        return NextResponse.json(
          { error: 'test_month debe ser un número entre 1 y 12' },
          { status: 400 }
        )
      }
      const year = parseInt(yearParam)
      minStartTime = formatDateWithMilliseconds(new Date(year, month - 1, 1, 0, 0, 0, 0))
      const lastDay = new Date(year, month, 0, 23, 59, 59, 999)
      maxStartTime = formatDateWithMilliseconds(lastDay)
      console.log(`[Historical Sync] Modo prueba: solo mes ${month} de ${year}`)
    } else {
      // Por defecto, todo 2025
      minStartTime = formatDateWithMilliseconds(new Date('2025-01-01T00:00:00.000Z'))
      maxStartTime = formatDateWithMilliseconds(new Date('2025-12-31T23:59:59.999Z'))
    }

    console.log(`[Historical Sync] Rango de fechas: ${minStartTime} a ${maxStartTime}`)

    // Crear log de sincronización
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        integration: 'calendly',
        status: 'running',
        records_synced: 0,
        metadata: {
          type: 'historical_2025',
          min_start_time: minStartTime,
          max_start_time: maxStartTime,
          test_mode: !!testMonthParam,
        },
      } as any)
      .select()
      .single()

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    // Obtener usuario y organización
    const currentUser = await calendlyService.getCurrentUser()
    const userUri = currentUser.resource.uri
    let organizationUri = currentUser.resource.current_organization

    if (!userUri) {
      throw new Error('No se pudo obtener el URI del usuario de Calendly')
    }

    if (!organizationUri) {
      try {
        const orgMemberships = await calendlyService.getCurrentOrganization()
        organizationUri = orgMemberships.collection[0]?.organization?.uri
      } catch (error) {
        console.warn('[Historical Sync] Error obteniendo organización:', error)
      }
    }

    const useUserUri = !organizationUri
    console.log(`[Historical Sync] Usando ${useUserUri ? 'user URI' : 'organization URI'}`)

    // Caches para optimizar llamadas API
    const eventTypeOwnerCache = new Map<string, { ownerUri: string; ownerName: string }>()
    const userInfoCache = new Map<string, ReturnType<typeof parseStoreInfo>>()

    // Agregados para guardar en calendly_historical_stats
    const statsMap = new Map<string, {
      id: string
      user_name: string
      user_store: string | null
      event_type_category: 'Medición' | 'Fitting' | null
      room: 'I' | 'II' | null
      year: number
      month: number
      status: 'active' | 'canceled' | 'rescheduled'
      count: number
      has_utm: boolean
      utm_params: Record<string, string>
    }>()

    let pageToken: string | null = null
    let pagesProcessed = 0
    let totalEvents = 0
    const maxPagesForTest = testMonthParam ? 10 : MAX_PAGES // Limitar a 10 páginas en modo prueba

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    console.log(`[Historical Sync] Iniciando sincronización (max ${maxPagesForTest} páginas)...`)

    while (pagesProcessed < maxPagesForTest) {
      try {
        const eventParams: Parameters<typeof calendlyService.getScheduledEvents>[0] = {
          minStartTime,
          maxStartTime,
          count: 100,
          pageToken,
        }

        if (useUserUri) {
          eventParams.userUri = userUri
        } else if (organizationUri) {
          eventParams.organizationUri = organizationUri
        }

        if (pagesProcessed > 0) {
          await delay(DELAY_BETWEEN_PAGES)
        }

        console.log(`[Historical Sync] Obteniendo página ${pagesProcessed + 1}...`)
        const response = await calendlyService.getScheduledEvents(eventParams)
        console.log(`[Historical Sync] Página ${pagesProcessed + 1}: ${response.collection.length} eventos`)

        for (const event of response.collection) {
          totalEvents++

          // Obtener owner del event type
          let ownerName = 'Desconocido'
          let storeInfo: ReturnType<typeof parseStoreInfo> | null = null

          if (event.event_type) {
            if (!eventTypeOwnerCache.has(event.event_type)) {
              try {
                await delay(DELAY_BETWEEN_API_CALLS)
                const eventTypeDetails = await calendlyService.getEventTypeDetails(event.event_type)
                const ownerUri = eventTypeDetails.resource.owner
                await delay(DELAY_BETWEEN_API_CALLS)
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

          // Detectar estado
          const status = detectStatus(event)

          // Extraer UTM
          const { has_utm, utm_params } = extractUtmParams(event)

          // Obtener fecha del evento
          const eventDate = new Date(event.start_time)
          const year = eventDate.getFullYear()
          const month = eventDate.getMonth() + 1

          // Generar ID compuesto
          const statsId = generateStatsId(
            storeInfo?.fullName || ownerName,
            year,
            month,
            storeInfo?.eventType || null,
            status,
            has_utm
          )

          // Agregar o incrementar contador
          if (statsMap.has(statsId)) {
            statsMap.get(statsId)!.count++
          } else {
            statsMap.set(statsId, {
              id: statsId,
              user_name: storeInfo?.fullName || ownerName,
              user_store: storeInfo?.store || null,
              event_type_category: storeInfo?.eventType || null,
              room: storeInfo?.room || null,
              year,
              month,
              status,
              count: 1,
              has_utm,
              utm_params,
            })
          }
        }

        const nextPageUrl = response.pagination.next_page
        if (!nextPageUrl) {
          console.log(`[Historical Sync] No hay más páginas`)
          break
        }

        try {
          let url: URL
          if (nextPageUrl.startsWith('http')) {
            url = new URL(nextPageUrl)
          } else {
            url = new URL(nextPageUrl, 'https://api.calendly.com')
          }

          const nextToken = url.searchParams.get('page_token')
          if (!nextToken || nextToken.trim().length === 0) {
            break
          }

          pageToken = nextToken
          pagesProcessed++

          if (pagesProcessed % 5 === 0) {
            console.log(`[Historical Sync] Progreso: ${pagesProcessed} páginas, ${totalEvents} eventos procesados`)
          }
        } catch (urlError) {
          console.error(`[Historical Sync] Error parseando next_page URL:`, urlError)
          break
        }
      } catch (pageError) {
        console.error(`[Historical Sync] Error en página ${pagesProcessed + 1}:`, pageError)
        throw pageError
      }
    }

    // Guardar agregados en calendly_historical_stats
    const statsArray = Array.from(statsMap.values())
    console.log(`[Historical Sync] Guardando ${statsArray.length} agregados en calendly_historical_stats...`)

    let statsSaved = 0
    for (const stat of statsArray) {
      const { error: upsertError } = await supabase
        .from('calendly_historical_stats')
        .upsert(
          {
            ...stat,
            utm_params: stat.utm_params,
            updated_at: new Date().toISOString(),
          } as any,
          {
            onConflict: 'id',
          }
        )

      if (upsertError) {
        console.error(`Error guardando stat ${stat.id}:`, upsertError)
      } else {
        statsSaved++
      }
    }

    // Actualizar log de sincronización
    if (syncLog) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'success',
          records_synced: statsSaved,
          completed_at: new Date().toISOString(),
          metadata: {
            ...(syncLog.metadata as any || {}),
            total_events_found: totalEvents,
            stats_saved: statsSaved,
            pages_processed: pagesProcessed,
          },
        } as any)
        .eq('id', syncLog.id)
    }

    return NextResponse.json({
      success: true,
      message: `Sincronización histórica completada: ${statsSaved} agregados guardados de ${totalEvents} eventos procesados`,
      records_synced: statsSaved,
      total_events_processed: totalEvents,
      pages_processed: pagesProcessed,
      stats_by_status: {
        active: statsArray.filter(s => s.status === 'active').reduce((sum, s) => sum + s.count, 0),
        canceled: statsArray.filter(s => s.status === 'canceled').reduce((sum, s) => sum + s.count, 0),
        rescheduled: statsArray.filter(s => s.status === 'rescheduled').reduce((sum, s) => sum + s.count, 0),
      },
      date_range: {
        min_start_time: minStartTime,
        max_start_time: maxStartTime,
      },
      test_mode: !!testMonthParam,
    })
  } catch (error) {
    console.error('Historical sync error:', error)

    // Actualizar log de error
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
      { error: 'Failed to sync historical Calendly data', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger historical Calendly sync',
    endpoints: {
      sync_all_2025: 'POST /api/sync/calendly/historical',
      sync_test_month: 'POST /api/sync/calendly/historical?test_month=3',
      sync_year: 'POST /api/sync/calendly/historical?year=2025',
    },
    description: 'Para sincronizar todas las citas de 2025, usa: POST /api/sync/calendly/historical?test_month=3 (prueba con marzo)',
  })
}

