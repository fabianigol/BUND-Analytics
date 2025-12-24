import { NextRequest, NextResponse } from 'next/server'
import { MetaService } from '@/lib/integrations/meta'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { MetaAd } from '@/types'

const BATCH_SIZE = 25 // Procesar anuncios en lotes de 25 (aumentado para mejor rendimiento)
const DELAY_BETWEEN_BATCHES = 200 // Reducido de 500ms a 200ms para acelerar

// Configurar timeout más largo para sincronización de anuncios (puede tardar varios minutos)
export const maxDuration = 300 // 5 minutos
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener parámetros de fecha opcionales del body
    let dateRange: { since: string; until: string } | null = null
    let campaignId: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      if (body.startDate && body.endDate) {
        const startDateStr = body.startDate.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? body.startDate 
          : new Date(body.startDate).toISOString().split('T')[0]
        const endDateStr = body.endDate.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? body.endDate 
          : new Date(body.endDate).toISOString().split('T')[0]
        
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
          dateRange = {
            since: startDateStr,
            until: endDateStr,
          }
          console.log(`[Meta Ads Sync] Using custom date range: ${dateRange.since} to ${dateRange.until} (timezone: PST/PDT)`)
        }
      }
      if (body.campaignId) {
        campaignId = body.campaignId
        console.log(`[Meta Ads Sync] Syncing ads for campaign: ${campaignId}`)
      }
    } catch (e) {
      console.log('[Meta Ads Sync] No date range or campaign ID provided')
    }

    // Obtener credenciales desde Supabase
    const { data, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings, connected')
      .eq('integration', 'meta')
      .single()
    const settings = data as Database['public']['Tables']['integration_settings']['Row'] | null

    if (settingsError || !settings || !(settings as any).connected) {
      return NextResponse.json(
        { error: 'Meta no está conectado. Por favor, configura las credenciales primero.' },
        { status: 400 }
      )
    }

    const { access_token, ad_account_id } = settings.settings as {
      access_token?: string
      ad_account_id?: string
    }

    if (!access_token || !ad_account_id) {
      return NextResponse.json(
        { error: 'Credenciales de Meta incompletas. Por favor, reconecta la integración.' },
        { status: 400 }
      )
    }

    const metaService = new MetaService({
      accessToken: access_token,
      adAccountId: ad_account_id,
    })

    // Obtener lista de campañas y anuncios en paralelo para ahorrar tiempo
    const fetchStartTime = Date.now()
    console.log(`[Meta Ads Sync] Fetching campaigns and ads in parallel...`)
    
    const [campaignsResponse, adsResponse] = await Promise.all([
      metaService.getCampaigns(),
      metaService.getAds(campaignId || undefined)
    ])
    
    const campaignsMap = new Map<string, string>()
    campaignsResponse.data?.forEach(campaign => {
      campaignsMap.set(campaign.id, campaign.name)
    })
    
    let ads = adsResponse.data || []
    const fetchTime = Date.now() - fetchStartTime
    console.log(`[Meta Ads Sync] Found ${ads.length} total ads and ${campaignsMap.size} campaigns (took ${fetchTime}ms)`)
    
    // Filtrar solo anuncios activos si no hay filtro de fecha
    // Si hay filtro de fecha, procesaremos todos y filtraremos por datos después
    if (!dateRange) {
      ads = ads.filter(ad => ad.status === 'ACTIVE')
      console.log(`[Meta Ads Sync] Filtered to ${ads.length} active ads`)
    }
    
    if (ads.length === 0) {
      console.log(`[Meta Ads Sync] No ads found. This could mean:`)
      console.log(`  - No ads exist in the account/campaign`)
      console.log(`  - API permissions issue`)
      console.log(`  - Campaign ID is incorrect`)
      return NextResponse.json({
        success: true,
        records_synced: 0,
        total_ads: 0,
        message: 'No se encontraron anuncios para sincronizar. Verifica que haya anuncios activos en las campañas.',
      })
    }

    // Procesar anuncios en lotes
    let recordsSynced = 0
    let failedCount = 0
    const failedAds: Array<{ id: string; name: string; error: string }> = []

    // Si hay filtro de fecha, solo procesar anuncios que tengan datos en ese rango
    // Esto se hace procesando todos y filtrando por insights después
    console.log(`[Meta Ads Sync] Processing ${ads.length} ads in batches of ${BATCH_SIZE}`)
    const processStartTime = Date.now()

    for (let i = 0; i < ads.length; i += BATCH_SIZE) {
      const batch = ads.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(ads.length / BATCH_SIZE)
      console.log(`[Meta Ads Sync] Processing batch ${batchNumber}/${totalBatches} (ads ${i + 1}-${Math.min(i + BATCH_SIZE, ads.length)})`)

      const batchStartTime = Date.now()
      const batchPromises = batch.map(async (ad) => {
        try {
          let insights = null
          
          try {
            const insightsResponse = await metaService.getAdInsights(
              ad.id,
              dateRange
                ? { timeRange: dateRange }
                : { datePreset: 'last_30d' }
            )
            insights = insightsResponse.data?.[0]
            
            // Solo loggear si hay datos significativos o errores
            // if (insights && (parseFloat(insights.spend || '0') > 0 || parseFloat(insights.impressions || '0') > 0)) {
            //   console.log(`[Meta Ads Sync] Ad ${ad.name}: ${insights.spend}€, ${insights.impressions} imp`)
            // }
          } catch (error: any) {
            // Solo loggear errores críticos, no warnings para cada anuncio sin datos
            if (!error.message?.includes('No data') && !error.message?.includes('insufficient')) {
              console.warn(`[Meta Ads Sync] Error getting insights for ad ${ad.id}:`, error.message)
            }
            // Continuar sin insights si hay error
          }

          // Si hay filtro de fecha y no hay insights (no hay datos en el rango), saltar este anuncio
          if (dateRange && !insights) {
            // No loggear cada skip individual para reducir ruido
            return { success: false, adId: ad.id, adName: ad.name, error: 'No data in date range', skipped: true }
          }

          // Obtener nombre de campaña
          const campaignName = campaignsMap.get(ad.campaign_id) || ad.campaign_id

          // Transformar usando transformAd (reutiliza toda la lógica de transformCampaign)
          // insights puede ser null, pero transformAd acepta undefined
          const transformedAd = metaService.transformAd(ad, insights || undefined, campaignName)

          // Generar ID único para el registro
          const recordId = `${ad.id}_${transformedAd.date}`

          // Guardar en Supabase
          const { error: insertError } = await supabase
            .from('meta_ads')
            .upsert({
              id: recordId,
              ad_id: transformedAd.ad_id,
              ad_name: transformedAd.ad_name,
              campaign_id: transformedAd.campaign_id,
              campaign_name: transformedAd.campaign_name,
              adset_id: transformedAd.adset_id,
              status: transformedAd.status,
              spend: transformedAd.spend,
              impressions: transformedAd.impressions,
              clicks: transformedAd.clicks,
              conversions: transformedAd.conversions,
              cpm: transformedAd.cpm,
              cpc: transformedAd.cpc,
              ctr: transformedAd.ctr,
              roas: transformedAd.roas,
              reach: transformedAd.reach || 0,
              link_clicks: transformedAd.link_clicks || 0,
              actions: transformedAd.actions || [],
              cost_per_result: transformedAd.cost_per_result || 0,
              thumbnail_url: transformedAd.thumbnail_url || null,
              date: transformedAd.date,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any)

          if (insertError) {
            throw new Error(`Database error: ${insertError.message}`)
          }

          return { success: true, adId: ad.id, adName: ad.name }
        } catch (error: any) {
          console.error(`[Meta Ads Sync] Error processing ad ${ad.id}:`, error)
          failedAds.push({
            id: ad.id,
            name: ad.name,
            error: error.message || 'Unknown error',
          })
          return { success: false, adId: ad.id, adName: ad.name, error: error.message }
        }
      })

      const results = await Promise.all(batchPromises)
      const successful = results.filter(r => r.success)
      const failed = results.filter(r => !r.success && !(r as any).skipped)
      const skipped = results.filter(r => (r as any).skipped)
      
      recordsSynced += successful.length
      failedCount += failed.length
      
      const batchTime = Date.now() - batchStartTime
      const avgTimePerAd = batchTime / batch.length
      
      // Loggear progreso cada lote con métricas de tiempo
      console.log(`[Meta Ads Sync] Batch ${batchNumber}/${totalBatches}: ${successful.length} synced, ${failed.length} failed, ${skipped.length} skipped (${batchTime}ms total, ~${avgTimePerAd.toFixed(0)}ms/ad)`)

      // Pausa reducida entre lotes para evitar rate limiting pero acelerar proceso
      if (i + BATCH_SIZE < ads.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }

    const skippedCount = ads.length - recordsSynced - failedCount
    const processTime = Date.now() - processStartTime
    const totalTime = Date.now() - fetchStartTime
    const avgTimePerAd = ads.length > 0 ? processTime / ads.length : 0
    
    console.log(`[Meta Ads Sync] ✅ Sync completed:`)
    console.log(`  - Total time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`)
    console.log(`  - Processing time: ${processTime}ms (${(processTime/1000).toFixed(1)}s)`)
    console.log(`  - Average per ad: ${avgTimePerAd.toFixed(0)}ms`)
    console.log(`  - Results: ${recordsSynced} synced, ${failedCount} failed, ${skippedCount} skipped`)

    return NextResponse.json({
      success: true,
      records_synced: recordsSynced,
      total_ads: ads.length,
      failed_count: failedCount,
      skipped_count: skippedCount,
      failed_ads: failedAds,
      processing_time_ms: processTime,
      total_time_ms: totalTime,
      avg_time_per_ad_ms: avgTimePerAd,
    })
  } catch (error: any) {
    console.error('[Meta Ads Sync] Error:', error)
    return NextResponse.json(
      { 
        error: 'Error al sincronizar anuncios',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

