import { NextRequest, NextResponse } from 'next/server'
import { createGoogleAnalyticsServiceFromSupabase } from '@/lib/integrations/google-analytics'
import { createClient } from '@/lib/supabase/server'
import { subDays, format } from 'date-fns'
import { Database } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    console.log('[Analytics Sync] Starting sync process...')
    const supabase = await createClient()

    // Obtener credenciales desde Supabase
    console.log('[Analytics Sync] Creating service from Supabase...')
    const analyticsService = await createGoogleAnalyticsServiceFromSupabase(supabase)
    
    if (!analyticsService) {
      console.error('[Analytics Sync] Service creation failed - not connected or missing credentials')
      return NextResponse.json(
        { error: 'Google Analytics no está conectado. Por favor, configura las credenciales primero.' },
        { status: 400 }
      )
    }
    
    console.log('[Analytics Sync] Service created successfully')

    // Obtener parámetros de fecha opcionales del body
    let dateRange: { startDate: string; endDate: string } | null = null
    try {
      const body = await request.json().catch(() => ({}))
      if (body.startDate && body.endDate) {
        const startDate = new Date(body.startDate)
        const endDate = new Date(body.endDate)
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
          dateRange = {
            startDate: body.startDate,
            endDate: body.endDate,
          }
          console.log(`[Analytics Sync] Using custom date range: ${dateRange.startDate} to ${dateRange.endDate}`)
        }
      }
    } catch (e) {
      // Si no hay body o no es JSON, usar rango por defecto
    }

    // Usar rango por defecto si no se proporcionó uno
    if (!dateRange) {
      dateRange = {
        startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
      }
      console.log(`[Analytics Sync] Using default date range: ${dateRange.startDate} to ${dateRange.endDate}`)
    }

    // Crear log de sincronización
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        integration: 'analytics',
        status: 'running',
        records_synced: 0,
      } as any)
      .select()
      .single()

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    try {
      // Fetch data from GA4
      console.log('[Analytics Sync] Fetching overview metrics...')
      let overviewMetrics
      try {
        overviewMetrics = await analyticsService.getOverviewMetrics(dateRange)
        console.log('[Analytics Sync] Overview metrics fetched:', overviewMetrics)
      } catch (error) {
        console.error('[Analytics Sync] Error fetching overview metrics:', error)
        throw new Error(`Error fetching overview metrics: ${error instanceof Error ? error.message : String(error)}`)
      }
      
      console.log('[Analytics Sync] Fetching traffic sources...')
      let trafficSources
      try {
        trafficSources = await analyticsService.getTrafficSources(dateRange)
        console.log('[Analytics Sync] Traffic sources fetched:', trafficSources.length, 'sources')
      } catch (error) {
        console.error('[Analytics Sync] Error fetching traffic sources:', error)
        throw new Error(`Error fetching traffic sources: ${error instanceof Error ? error.message : String(error)}`)
      }
      
      console.log('[Analytics Sync] Fetching top pages...')
      let topPages
      try {
        topPages = await analyticsService.getTopPages(dateRange)
        console.log('[Analytics Sync] Top pages fetched:', topPages.length, 'pages')
      } catch (error) {
        console.error('[Analytics Sync] Error fetching top pages:', error)
        throw new Error(`Error fetching top pages: ${error instanceof Error ? error.message : String(error)}`)
      }

      console.log('[Analytics Sync] Fetching device breakdown...')
      let deviceBreakdown: Array<{ device: string; sessions: number }> = []
      try {
        deviceBreakdown = await analyticsService.getDeviceBreakdown(dateRange)
        console.log('[Analytics Sync] Device breakdown fetched:', deviceBreakdown.length, 'devices')
        console.log('[Analytics Sync] Device breakdown data:', JSON.stringify(deviceBreakdown, null, 2))
      } catch (error) {
        console.error('[Analytics Sync] Error fetching device breakdown:', error)
        // No lanzar error, solo loguear - los dispositivos son opcionales
        deviceBreakdown = []
      }

      console.log('[Analytics Sync] Fetching geographic data...')
      let geographicData: Array<{ country: string; sessions: number; users: number }> = []
      try {
        geographicData = await analyticsService.getGeographicData(dateRange)
        console.log('[Analytics Sync] Geographic data fetched:', geographicData.length, 'countries')
        console.log('[Analytics Sync] Geographic data:', JSON.stringify(geographicData, null, 2))
      } catch (error) {
        console.error('[Analytics Sync] Error fetching geographic data:', error)
        // No lanzar error, solo loguear - los datos geográficos son opcionales
        geographicData = []
      }

      console.log('[Analytics Sync] Fetching city data...')
      let cityData: Array<{ city: string; country: string; sessions: number; users: number }> = []
      try {
        cityData = await analyticsService.getCityData(dateRange)
        console.log('[Analytics Sync] City data fetched:', cityData.length, 'cities')
        console.log('[Analytics Sync] City data:', JSON.stringify(cityData, null, 2))
      } catch (error) {
        console.error('[Analytics Sync] Error fetching city data:', error)
        // No lanzar error, solo loguear - los datos de ciudades son opcionales
        cityData = []
      }

      console.log('[Analytics Sync] Fetching hourly data...')
      let hourlyData: Array<{ hour: number; sessions: number; users: number }> = []
      try {
        hourlyData = await analyticsService.getHourlyData(dateRange)
        console.log('[Analytics Sync] Hourly data fetched:', hourlyData.length, 'hours')
        console.log('[Analytics Sync] Hourly data:', JSON.stringify(hourlyData, null, 2))
      } catch (error) {
        console.error('[Analytics Sync] Error fetching hourly data:', error)
        // No lanzar error, solo loguear - los datos horarios son opcionales
        hourlyData = []
      }

      // Obtener datos diarios para el rango de fechas
      console.log('[Analytics Sync] Fetching daily metrics...')
      let dailyMetrics
      try {
        dailyMetrics = await analyticsService.getDailyMetrics(dateRange)
        console.log('[Analytics Sync] Daily metrics fetched:', dailyMetrics?.rows?.length || 0, 'days')
      } catch (error) {
        console.error('[Analytics Sync] Error fetching daily metrics:', error)
        // Si falla, usar los datos agregados como fallback
        dailyMetrics = null
      }

      // Inicializar recordId
      let recordId: string = dateRange.endDate
      
      // Si tenemos datos diarios, guardar un registro por cada día
      if (dailyMetrics && dailyMetrics.rows && dailyMetrics.rows.length > 0) {
        console.log('[Analytics Sync] Processing daily data for', dailyMetrics.rows.length, 'days')
        
        let recordsProcessed = 0
        let recordsUpdated = 0
        let recordsInserted = 0

        for (const row of dailyMetrics.rows) {
          const dimensionValues = row.dimensionValues || []
          const metricValues = row.metricValues || []
          
          // La fecha viene en formato YYYYMMDD, necesitamos convertirla a YYYY-MM-DD
          const dateRaw = dimensionValues[0]?.value || dateRange.endDate
          let date = dateRaw
          if (dateRaw.length === 8) {
            // Convertir YYYYMMDD a YYYY-MM-DD
            date = `${dateRaw.substring(0, 4)}-${dateRaw.substring(4, 6)}-${dateRaw.substring(6, 8)}`
          }
          
          const sessions = parseInt(metricValues[0]?.value || '0', 10)
          const users = parseInt(metricValues[1]?.value || '0', 10)
          const newUsers = parseInt(metricValues[2]?.value || '0', 10)
          const pageViews = parseInt(metricValues[3]?.value || '0', 10)
          const bounceRate = parseFloat(metricValues[4]?.value || '0') * 100 // Convertir a porcentaje
          const avgSessionDuration = parseFloat(metricValues[5]?.value || '0')

          // Para cada día, guardamos los datos específicos de ese día
          // Los datos agregados (traffic sources, top pages, etc.) se comparten para todos los días
          const dailyData: Database['public']['Tables']['analytics_data']['Update'] = {
            id: date,
            date: date,
            sessions: sessions,
            users: users,
            new_users: newUsers,
            page_views: pageViews,
            bounce_rate: bounceRate,
            avg_session_duration: avgSessionDuration,
            traffic_sources: trafficSources, // Datos agregados del período
            top_pages: topPages, // Datos agregados del período
            device_breakdown: deviceBreakdown || [], // Datos agregados del período
            geographic_data: geographicData || [], // Datos agregados del período
            city_data: cityData || [], // Datos agregados del período
            hourly_data: hourlyData || [], // Datos agregados del período
          }

          // Check if data for this date already exists
          const { data: existingData } = await supabase
            .from('analytics_data')
            .select('id')
            .eq('date', date)
            .single()

          const existingDataTyped = existingData as any

          if (existingDataTyped?.id) {
            // Update existing record
            const { error: updateError } = await supabase
              .from('analytics_data')
              // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
              .update(dailyData as any)
              .eq('id', date)

            if (updateError) {
              console.error(`[Analytics Sync] Error updating record for date ${date}:`, updateError)
            } else {
              recordsUpdated++
            }
          } else {
            // Insert new record
            const insertData: Database['public']['Tables']['analytics_data']['Insert'] = {
              id: date,
              date: date,
              sessions: sessions,
              users: users,
              new_users: newUsers,
              page_views: pageViews,
              bounce_rate: bounceRate,
              avg_session_duration: avgSessionDuration,
              traffic_sources: trafficSources,
              top_pages: topPages,
              device_breakdown: deviceBreakdown || [],
              geographic_data: geographicData || [],
              city_data: cityData || [],
              hourly_data: hourlyData || [],
            }
            const { error: insertError } = await supabase
              .from('analytics_data')
              // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
              .insert(insertData as any)

            if (insertError) {
              console.error(`[Analytics Sync] Error inserting record for date ${date}:`, insertError)
            } else {
              recordsInserted++
            }
          }
          
          recordsProcessed++
        }

        console.log(`[Analytics Sync] Processed ${recordsProcessed} daily records: ${recordsInserted} inserted, ${recordsUpdated} updated`)
        recordId = dateRange.endDate // Usar la fecha de fin como ID de referencia
      } else {
        // Inicializar recordId para el caso de fallback
        let recordId: string
        // Fallback: guardar un solo registro agregado para la fecha de fin
        console.log('[Analytics Sync] No daily data available, saving aggregated record for end date')
        
        const transformedData = analyticsService.transformOverviewData(
          overviewMetrics,
          trafficSources,
          topPages,
          dateRange.endDate
        )

        const transformedDataWithDevices = {
          ...transformedData,
          device_breakdown: deviceBreakdown || [],
          geographic_data: geographicData || [],
          city_data: cityData || [],
          hourly_data: hourlyData || [],
        } as any

        // Check if data for this date already exists
        const { data: existingData } = await supabase
          .from('analytics_data')
          .select('id')
          .eq('date', transformedData.date)
          .single()

        const existingDataTyped = existingData as any

        if (existingDataTyped?.id) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('analytics_data')
            // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
            .update(transformedDataWithDevices as any)
            .eq('id', existingDataTyped.id)

          if (updateError) {
            throw updateError
          }
          console.log(`[Analytics Sync] Updated aggregated record for date ${transformedData.date}`)
          recordId = existingDataTyped.id
        } else {
          // Insert new record
          const recordToInsert = {
            id: transformedData.date,
            ...transformedDataWithDevices,
          }
          
          const { error: insertError } = await supabase
            .from('analytics_data')
            .insert(recordToInsert as any)

          if (insertError) {
            throw insertError
          }
          console.log(`[Analytics Sync] Inserted aggregated record for date ${transformedData.date}`)
          recordId = transformedData.date
        }
      }

      // Update sync log
      const syncLogTyped = syncLog as any
      if (syncLogTyped?.id) {
        await supabase
          .from('sync_logs')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update({
            status: 'completed',
            records_synced: 1,
            error_message: null,
          } as any)
          .eq('id', syncLogTyped.id)
      }

      // Update last_sync timestamp
      await supabase
        .from('integration_settings')
        // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
        .update({
          last_sync: new Date().toISOString(),
        } as any)
        .eq('integration', 'analytics')

      const recordsSynced = dailyMetrics && dailyMetrics.rows ? dailyMetrics.rows.length : 1
      
      return NextResponse.json({
        success: true,
        message: 'Analytics data synced successfully',
        records_synced: recordsSynced,
        date_range: dateRange,
      })
    } catch (syncError) {
      console.error('[Analytics Sync] Error during sync:', syncError)

      // Update sync log with error
      const syncLogTyped = syncLog as any
      if (syncLogTyped?.id) {
        const errorMessage = syncError instanceof Error 
          ? syncError.message 
          : typeof syncError === 'object' && syncError !== null
            ? JSON.stringify(syncError)
            : String(syncError)
        
        await supabase
          .from('sync_logs')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update({
            status: 'failed',
            error_message: errorMessage,
          } as any)
          .eq('id', syncLogTyped.id)
      }

      throw syncError
    }
  } catch (error) {
    console.error('Analytics sync error:', error)
    
    // Extract error message properly
    let errorMessage = 'Unknown error'
    let errorDetails = ''
    
    if (error instanceof Error) {
      errorMessage = error.message
      // Check if it's a gRPC error with details
      if ((error as any).code && (error as any).details) {
        errorDetails = (error as any).details
      } else if (error.stack) {
        errorDetails = error.stack
      }
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error)
    } else {
      errorMessage = String(error)
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to sync Analytics data', 
        details: errorDetails || errorMessage
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  const supabase = await createClient()
  
  const { data } = await supabase
    .from('integration_settings')
    .select('connected, last_sync')
    .eq('integration', 'analytics')
    .single()

  const dataTyped = data as any

  return NextResponse.json({ 
    message: 'Use POST to trigger Analytics sync',
    configured: dataTyped?.connected || false,
    lastSync: dataTyped?.last_sync || null,
  })
}
