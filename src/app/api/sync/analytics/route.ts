import { NextRequest, NextResponse } from 'next/server'
import { createGoogleAnalyticsServiceFromSupabase } from '@/lib/integrations/google-analytics'
import { createClient } from '@/lib/supabase/server'
import { subDays, format } from 'date-fns'

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

      // Transform data to internal format
      const transformedData = analyticsService.transformOverviewData(
        overviewMetrics,
        trafficSources,
        topPages,
        dateRange.endDate
      )

      // Check if data for this date already exists
      const { data: existingData } = await supabase
        .from('analytics_data')
        .select('id')
        .eq('date', transformedData.date)
        .single()

      let recordId: string

      const existingDataTyped = existingData as any

      if (existingDataTyped?.id) {
        // Update existing record
        const { data: updatedData, error: updateError } = await supabase
          .from('analytics_data')
          .update(transformedData as any)
          .eq('id', existingDataTyped.id)
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        const updatedDataTyped = updatedData as any
        recordId = updatedDataTyped.id
        console.log(`[Analytics Sync] Updated existing record for date ${transformedData.date}`)
      } else {
        // Insert new record with generated ID
        // Use date as ID to ensure uniqueness (one record per date)
        const recordToInsert = {
          id: transformedData.date, // Use date as ID
          ...transformedData,
        }
        
        const { data: insertedData, error: insertError } = await supabase
          .from('analytics_data')
          .insert(recordToInsert as any)
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        const insertedDataTyped = insertedData as any
        recordId = insertedDataTyped.id
        console.log(`[Analytics Sync] Created new record for date ${transformedData.date}`)
      }

      // Update sync log
      const syncLogTyped = syncLog as any
      if (syncLogTyped?.id) {
        await supabase
          .from('sync_logs')
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
        .update({
          last_sync: new Date().toISOString(),
        } as any)
        .eq('integration', 'analytics')

      return NextResponse.json({
        success: true,
        message: 'Analytics data synced successfully',
        records_synced: 1,
        data: {
          id: recordId,
          ...transformedData,
        },
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
