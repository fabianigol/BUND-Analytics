import { NextRequest, NextResponse } from 'next/server'
import { MetaService } from '@/lib/integrations/meta'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener parámetros de fecha opcionales del body
    let dateRange: { since: string; until: string } | null = null
    try {
      const body = await request.json().catch(() => ({}))
      if (body.startDate && body.endDate) {
        // Validar y normalizar formato de fecha (YYYY-MM-DD)
        // La API de Meta usa timezone PST/PDT, pero acepta fechas en formato YYYY-MM-DD
        const startDateStr = body.startDate.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? body.startDate 
          : new Date(body.startDate).toISOString().split('T')[0]
        const endDateStr = body.endDate.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? body.endDate 
          : new Date(body.endDate).toISOString().split('T')[0]
        
        // Validar que las fechas sean válidas y que startDate <= endDate
        const startDate = new Date(startDateStr)
        const endDate = new Date(endDateStr)
        if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && startDate <= endDate) {
          dateRange = {
            since: startDateStr, // Formato YYYY-MM-DD
            until: endDateStr,   // Formato YYYY-MM-DD
          }
          console.log(`[Meta Sync] Using custom date range: ${dateRange.since} to ${dateRange.until} (timezone: PST/PDT)`)
        } else {
          console.warn(`[Meta Sync] Invalid date range provided: ${body.startDate} to ${body.endDate}`)
        }
      }
    } catch (e) {
      // Si no hay body o no es JSON, continuar sin filtro de fecha
      console.log('[Meta Sync] No date range provided, using default (last_30d)')
    }

    // Obtener credenciales desde Supabase
    const { data: settings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings, connected')
      .eq('integration', 'meta')
      .single()

    if (settingsError || !settings || !settings.connected) {
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

    // Crear servicio con credenciales de Supabase
    const metaService = new MetaService({
      accessToken: access_token,
      adAccountId: ad_account_id,
    })

    // Crear log de sincronización
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        integration: 'meta',
        status: 'running',
        records_synced: 0,
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    try {
      // Fetch campaigns (con paginación completa)
      const campaignsResponse = await metaService.getCampaigns()
      const totalCampaigns = campaignsResponse.data?.length || 0
      console.log(`[Meta Sync] Found ${totalCampaigns} campaigns to process (all pages retrieved)`)
      
      const transformedCampaigns = []
      const failedCampaigns: Array<{ id: string; name: string; error: string }> = []
      const skippedCampaigns: Array<{ id: string; name: string; reason: string }> = []

      // Process campaigns in batches for better performance
      const BATCH_SIZE = 10
      const campaigns = campaignsResponse.data || []
      let processedCount = 0

      // Process campaigns in batches
      for (let i = 0; i < campaigns.length; i += BATCH_SIZE) {
        const batch = campaigns.slice(i, i + BATCH_SIZE)
        console.log(`[Meta Sync] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(campaigns.length / BATCH_SIZE)} (campaigns ${i + 1}-${Math.min(i + BATCH_SIZE, campaigns.length)})`)

        // Process batch in parallel
        const batchPromises = batch.map(async (campaign) => {
          try {
            let insights = null
            
            // Si hay un rango de fechas personalizado, usarlo; si no, usar last_30d
            try {
              const insightsResponse = await metaService.getCampaignInsights(
                campaign.id,
                dateRange
                  ? { timeRange: dateRange }
                  : { datePreset: 'last_30d' }
              )
              insights = insightsResponse.data?.[0]
              
              // Log detallado
              if (insights) {
                console.log(`[Meta Sync] Campaign ${campaign.name} (${campaign.id}):`)
                console.log(`  - Spend: ${insights.spend}, Impressions: ${insights.impressions}, Clicks: ${insights.clicks}`)
                console.log(`  - Reach: ${insights.reach || 'N/A'}, Clicks: ${insights.clicks || 'N/A'}`)
                console.log(`  - Actions: ${insights.actions?.length || 0} types`)
                if (insights.actions && insights.actions.length > 0) {
                  console.log(`  - Action types:`, insights.actions.map(a => `${a.action_type}: ${a.value}`).slice(0, 5))
                }
                console.log(`  - Cost per action type: ${insights.cost_per_action_type?.length || 0} types`)
              }
              
              // Si no hay actions y no se usó un rango personalizado, intentar con rango más amplio
              if (insights && (!insights.actions || insights.actions.length === 0) && !dateRange) {
                console.log(`[Meta Sync] Campaign ${campaign.name}: No actions in last_30d, trying wider range`)
                const today = new Date()
                const ninetyDaysAgo = new Date()
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
                
                try {
                  const widerRangeResponse = await metaService.getCampaignInsights(campaign.id, {
                    timeRange: {
                      since: ninetyDaysAgo.toISOString().split('T')[0],
                      until: today.toISOString().split('T')[0],
                    },
                  })
                  const widerInsights = widerRangeResponse.data?.[0]
                  if (widerInsights && widerInsights.actions && widerInsights.actions.length > 0) {
                    insights = widerInsights
                    console.log(`[Meta Sync] Campaign ${campaign.name}: Found ${widerInsights.actions.length} action types in 90-day range`)
                  }
                } catch (rangeError) {
                  // Continuar con insights de last_30d aunque no tenga actions
                  console.log(`[Meta Sync] Campaign ${campaign.name}: 90-day range also failed, keeping last_30d data`)
                }
              }
            } catch (initialError) {
              // Log el error para debug
              const errorMsg = initialError instanceof Error ? initialError.message : String(initialError)
              console.log(`[Meta Sync] Campaign ${campaign.name}: Initial request failed: ${errorMsg}`)
              
              // Si se usó un rango personalizado y falla, no intentar otros rangos
              if (dateRange) {
                console.warn(`[Meta Sync] Campaign ${campaign.name}: Custom date range failed, skipping fallback attempts`)
                skippedCampaigns.push({
                  id: campaign.id,
                  name: campaign.name,
                  reason: `Failed to fetch insights for custom date range: ${dateRange.since} to ${dateRange.until}`,
                })
                insights = null
              } else {
                // Si last_30d falla y no hay rango personalizado, intentar con rango amplio (últimos 90 días)
                try {
                  const today = new Date()
                  const ninetyDaysAgo = new Date()
                  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
                  
                  const insightsResponse = await metaService.getCampaignInsights(campaign.id, {
                    timeRange: {
                      since: ninetyDaysAgo.toISOString().split('T')[0],
                      until: today.toISOString().split('T')[0],
                    },
                  })
                  insights = insightsResponse.data?.[0]
                  
                  if (insights && insights.actions && insights.actions.length > 0) {
                    console.log(`[Meta Sync] Campaign ${campaign.name}: Found ${insights.actions.length} action types in 90-day range`)
                  }
                } catch (rangeError) {
                  // Log el error para debug
                  const rangeErrorMsg = rangeError instanceof Error ? rangeError.message : String(rangeError)
                  console.log(`[Meta Sync] Campaign ${campaign.name}: 90-day range failed: ${rangeErrorMsg}`)
                  
                  // Si todo falla, intentar con lifetime como último recurso
                  try {
                    const lifetimeResponse = await metaService.getCampaignInsights(campaign.id, {
                      datePreset: 'lifetime',
                    })
                    insights = lifetimeResponse.data?.[0]
                    console.log(`[Meta Sync] Campaign ${campaign.name}: Using lifetime data`)
                  } catch (lifetimeError) {
                    // Si todo falla, guardar la campaña sin insights (con valores en 0)
                    // pero al menos tendremos la información básica de la campaña
                    console.warn(`[Meta Sync] Campaign ${campaign.name}: No insights available, saving with default values`)
                    skippedCampaigns.push({
                      id: campaign.id,
                      name: campaign.name,
                      reason: 'No insights data available after all attempts',
                    })
                    // Continuar para guardar la campaña básica
                    insights = null
                  }
                }
              }
            }

            // Transformar campaña (incluso si insights es null, para guardar la campaña básica)
            const transformedCampaign = metaService.transformCampaign(campaign, insights)

            // Log para debug: ver qué actions tenemos
            if (transformedCampaign.actions && transformedCampaign.actions.length > 0) {
              console.log(`[Meta Sync] Campaign ${campaign.name}: Transformed with ${transformedCampaign.actions.length} actions:`, 
                transformedCampaign.actions.slice(0, 3).map(a => `${a.action_type}: ${a.value}`).join(', '))
            } else if (insights) {
              console.log(`[Meta Sync] Campaign ${campaign.name}: Has insights but no actions. Spend: ${insights.spend}, Impressions: ${insights.impressions}`)
            } else {
              console.log(`[Meta Sync] Campaign ${campaign.name}: No insights available, saving with default values`)
            }

            // Asegurar que todos los campos numéricos tengan valores por defecto
            const safeCampaign = {
              id: `${campaign.id}_${transformedCampaign.date}`,
              campaign_id: transformedCampaign.campaign_id,
              campaign_name: transformedCampaign.campaign_name,
              status: transformedCampaign.status,
              objective: transformedCampaign.objective,
              spend: transformedCampaign.spend || 0,
              impressions: transformedCampaign.impressions || 0,
              clicks: transformedCampaign.clicks || 0,
              conversions: transformedCampaign.conversions || 0,
              cpm: transformedCampaign.cpm || 0,
              cpc: transformedCampaign.cpc || 0,
              ctr: transformedCampaign.ctr || 0,
              roas: transformedCampaign.roas || 0,
              reach: transformedCampaign.reach || 0,
              link_clicks: transformedCampaign.link_clicks || 0,
              actions: transformedCampaign.actions || [],
              cost_per_result: transformedCampaign.cost_per_result || 0,
              date: transformedCampaign.date,
              created_at: transformedCampaign.created_at,
            }

            processedCount++
            return safeCampaign
          } catch (campaignError) {
            const errorMessage = campaignError instanceof Error ? campaignError.message : String(campaignError)
            console.error(`[Meta Sync] Error processing campaign ${campaign.id} (${campaign.name}):`, errorMessage)
            failedCampaigns.push({
              id: campaign.id,
              name: campaign.name,
              error: errorMessage,
            })
            return null
          }
        })

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises)
        const validCampaigns = batchResults.filter((c): c is NonNullable<typeof c> => c !== null)
        transformedCampaigns.push(...validCampaigns)
      }

      console.log(`[Meta Sync] Processed: ${transformedCampaigns.length} successful, ${failedCampaigns.length} failed, ${skippedCampaigns.length} skipped`)
      console.log(`[Meta Sync] Summary: ${totalCampaigns} total campaigns found, ${transformedCampaigns.length} saved to database`)
      
      if (failedCampaigns.length > 0) {
        console.warn(`[Meta Sync] Failed campaigns (${failedCampaigns.length}):`, failedCampaigns.slice(0, 5)) // Mostrar solo las primeras 5
        if (failedCampaigns.length > 5) {
          console.warn(`[Meta Sync] ... and ${failedCampaigns.length - 5} more failed campaigns`)
        }
      }
      if (skippedCampaigns.length > 0) {
        console.warn(`[Meta Sync] Skipped campaigns (${skippedCampaigns.length}):`, skippedCampaigns.slice(0, 5)) // Mostrar solo las primeras 5
        if (skippedCampaigns.length > 5) {
          console.warn(`[Meta Sync] ... and ${skippedCampaigns.length - 5} more skipped campaigns`)
        }
      }

      // Guardar campañas en Supabase
      if (transformedCampaigns.length > 0) {
        // Asegurar que actions se guarde como JSONB
        const campaignsToSave = transformedCampaigns.map((campaign) => {
          // Log para ver qué estamos guardando
          if (campaign.actions && campaign.actions.length > 0) {
            console.log(`[Meta Sync] Saving campaign ${campaign.campaign_name} with ${campaign.actions.length} actions:`, 
              campaign.actions.slice(0, 3).map(a => `${a.action_type}: ${a.value}`))
          }
          
          return {
            ...campaign,
            actions: Array.isArray(campaign.actions) ? campaign.actions : [],
            reach: campaign.reach || 0,
            link_clicks: campaign.link_clicks || 0,
            cost_per_result: campaign.cost_per_result || 0,
          }
        })
        
        console.log(`[Meta Sync] Sample campaign to save:`, {
          name: campaignsToSave[0]?.campaign_name,
          spend: campaignsToSave[0]?.spend,
          impressions: campaignsToSave[0]?.impressions,
          reach: campaignsToSave[0]?.reach,
          link_clicks: campaignsToSave[0]?.link_clicks,
          actions_count: campaignsToSave[0]?.actions?.length || 0,
          cost_per_result: campaignsToSave[0]?.cost_per_result,
        })

        const { error: insertError } = await supabase
          .from('meta_campaigns')
          .upsert(campaignsToSave, {
            onConflict: 'id',
          })

        if (insertError) {
          throw new Error(`Error guardando campañas: ${insertError.message}`)
        }
      }

      // Actualizar log de sincronización
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'success',
            records_synced: transformedCampaigns.length,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      // Actualizar última sincronización
      await supabase
        .from('integration_settings')
        .update({
          last_sync: new Date().toISOString(),
        })
        .eq('integration', 'meta')

      // Calcular estadísticas
      const campaignsWithData = transformedCampaigns.filter(c => 
        c.spend > 0 || c.impressions > 0 || c.actions.length > 0
      ).length
      const campaignsWithoutData = transformedCampaigns.length - campaignsWithData

      return NextResponse.json({
        success: true,
        message: `Sincronizadas ${transformedCampaigns.length} de ${totalCampaigns} campañas de Meta`,
        records_synced: transformedCampaigns.length,
        total_campaigns: totalCampaigns,
        campaigns_with_data: campaignsWithData,
        campaigns_without_data: campaignsWithoutData,
        failed_count: failedCampaigns.length,
        skipped_count: skippedCampaigns.length,
        pages_processed: Math.ceil(totalCampaigns / 100), // Aproximación de páginas procesadas
        failed_campaigns: failedCampaigns,
        skipped_campaigns: skippedCampaigns,
        data: transformedCampaigns,
      })
    } catch (syncError) {
      // Actualizar log con error
      if (syncLog) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'error',
            error_message: String(syncError),
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id)
      }

      throw syncError
    }
  } catch (error) {
    console.error('Meta sync error:', error)
    
    // Extraer mensaje de error más detallado
    let errorMessage = 'Failed to sync Meta data'
    let errorDetails = String(error)
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack || error.message
    }
    
    // Si es un error de la API de Meta, extraer el mensaje
    if (errorDetails.includes('Meta API error')) {
      const match = errorDetails.match(/Meta API error: (.+)/)
      if (match) {
        errorMessage = match[1]
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        type: 'meta_sync_error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('connected, last_sync')
      .eq('integration', 'meta')
      .single()

    return NextResponse.json({ 
      message: 'Use POST to trigger Meta sync',
      configured: data?.connected || false,
      lastSync: data?.last_sync || null,
    })
  } catch (error) {
    return NextResponse.json({ 
      message: 'Use POST to trigger Meta sync',
      configured: false,
    })
  }
}
