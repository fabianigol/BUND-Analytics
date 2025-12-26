import { NextRequest, NextResponse } from 'next/server'
import { MetaService } from '@/lib/integrations/meta'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { calculatePreviousMonthPeriod, calculatePreviousYearPeriod } from '@/lib/utils/date-comparison'

// Tipo para datos de campaña con insights
interface CampaignWithInsights {
  id: string
  name: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cost_per_result: number
  results: number
  reach?: number
  link_clicks?: number
}

// Tipo para comparación de campaña
interface CampaignComparison {
  campaign_id: string
  campaign_name: string
  current: {
    spend: number
    impressions: number
    clicks: number
    ctr: number
    cost_per_result: number
    results: number
  }
  comparative: {
    spend: number
    impressions: number
    clicks: number
    ctr: number
    cost_per_result: number
    results: number
  }
  change: {
    spend: { value: number; percent: number; isBetter: boolean }
    ctr: { value: number; percent: number; isBetter: boolean }
    cost_per_result: { value: number; percent: number; isBetter: boolean }
    results: { value: number; percent: number; isBetter: boolean }
  }
  hasData: boolean
}

// Función helper para categorizar campañas (igual que en ads/page.tsx)
function categorizeCampaign(campaignName: string, objective: string): 'citas' | 'leads' | 'ecom' {
  const campaignNameUpper = campaignName.toUpperCase()
  
  // Citas: campañas con "Thebundclub" o "BundClub" en el nombre
  if (campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('THE BUNDCLUB') || campaignNameUpper.includes('BUNDCLUB')) {
    return 'citas'
  }
  // Ecom: campañas con "Ecom" o "Sales" en el nombre, o OUTCOME_SALES
  if (campaignNameUpper.includes('ECOM') || campaignNameUpper.includes('SALES') || objective.includes('SALES')) {
    return 'ecom'
  }
  // Leads: todas las demás
  return 'leads'
}

// Función helper para calcular si una métrica mejoró o empeoró
function calculateIsBetter(metric: 'spend' | 'ctr' | 'cost_per_result' | 'results', current: number, comparative: number): boolean {
  const change = current - comparative
  
  switch (metric) {
    case 'ctr':
    case 'results':
      // Mejor si aumentó
      return change > 0
    case 'cost_per_result':
      // Mejor si disminuyó
      return change < 0
    case 'spend':
      // Mejor si disminuyó (asumiendo mismo o mejor resultado)
      // Para simplificar, mejor si disminuyó
      return change < 0
    default:
      return false
  }
}

// Función helper para calcular cambio porcentual
function calculatePercentChange(current: number, comparative: number): number {
  if (comparative === 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - comparative) / comparative) * 100
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Obtener parámetros de fecha
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate y endDate son requeridos' },
        { status: 400 }
      )
    }
    
    // Validar formato de fechas
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return NextResponse.json(
        { error: 'Las fechas deben estar en formato YYYY-MM-DD' },
        { status: 400 }
      )
    }
    
    console.log(`[Meta Comparatives API] Calculating comparatives for period: ${startDate} to ${endDate}`)
    
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
    
    // Calcular períodos comparativos
    const previousMonthPeriod = calculatePreviousMonthPeriod(startDate, endDate)
    const previousYearPeriod = calculatePreviousYearPeriod(startDate, endDate)
    
    console.log(`[Meta Comparatives API] Previous month: ${previousMonthPeriod.start} to ${previousMonthPeriod.end}`)
    console.log(`[Meta Comparatives API] Previous year: ${previousYearPeriod.start} to ${previousYearPeriod.end}`)
    
    // Paso 1: Obtener todas las campañas
    const campaignsResponse = await metaService.getCampaigns()
    const allCampaigns = campaignsResponse.data || []
    console.log(`[Meta Comparatives API] Found ${allCampaigns.length} total campaigns`)
    
    // Paso 2: Obtener insights del período actual y filtrar por spend > 0
    const currentPeriodCampaigns: CampaignWithInsights[] = []
    const currentPeriodMap = new Map<string, CampaignWithInsights>()
    
    console.log(`[Meta Comparatives API] Fetching current period insights for ${allCampaigns.length} campaigns...`)
    
    // Procesar campañas en lotes para evitar rate limiting
    const BATCH_SIZE = 10
    for (let i = 0; i < allCampaigns.length; i += BATCH_SIZE) {
      const batch = allCampaigns.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map(async (campaign) => {
        try {
          const insightsResponse = await metaService.getCampaignInsights(campaign.id, {
            timeRange: { since: startDate, until: endDate }
          })
          
          const insights = insightsResponse.data?.[0]
          if (!insights) return null
          
          const spend = parseFloat(insights.spend || '0')
          
          // FILTRAR: Solo incluir campañas con spend > 0
          if (spend <= 0) return null
          
          // Transformar usando transformCampaign para obtener métricas correctas
          const transformed = metaService.transformCampaign(campaign, insights)
          
          const campaignData: CampaignWithInsights = {
            id: campaign.id,
            name: campaign.name,
            spend: transformed.spend,
            impressions: transformed.impressions,
            clicks: transformed.clicks,
            ctr: transformed.ctr,
            cost_per_result: transformed.cost_per_result || 0,
            results: transformed.conversions,
            reach: transformed.reach,
            link_clicks: transformed.link_clicks,
          }
          
          return campaignData
        } catch (error: any) {
          console.warn(`[Meta Comparatives API] Error getting insights for campaign ${campaign.id}:`, error.message)
          return null
        }
      })
      
      const results = await Promise.all(batchPromises)
      results.forEach((data) => {
        if (data) {
          currentPeriodCampaigns.push(data)
          currentPeriodMap.set(data.name, data)
        }
      })
      
      // Pequeña pausa entre lotes
      if (i + BATCH_SIZE < allCampaigns.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    console.log(`[Meta Comparatives API] Found ${currentPeriodCampaigns.length} campaigns with spend > 0 in current period`)
    
    // Paso 3: Obtener datos comparativos (mes anterior y año anterior)
    const getComparativeData = async (period: { start: string; end: string }, periodName: string): Promise<CampaignComparison[]> => {
      const comparativeMap = new Map<string, CampaignWithInsights>()
      
      console.log(`[Meta Comparatives API] Fetching ${periodName} insights...`)
      
      // Obtener insights de todas las campañas en el período comparativo
      for (let i = 0; i < allCampaigns.length; i += BATCH_SIZE) {
        const batch = allCampaigns.slice(i, i + BATCH_SIZE)
        const batchPromises = batch.map(async (campaign) => {
          try {
            const insightsResponse = await metaService.getCampaignInsights(campaign.id, {
              timeRange: { since: period.start, until: period.end }
            })
            
            const insights = insightsResponse.data?.[0]
            if (!insights) return null
            
            const spend = parseFloat(insights.spend || '0')
            if (spend <= 0) return null
            
            const transformed = metaService.transformCampaign(campaign, insights)
            
            const campaignData: CampaignWithInsights = {
              id: campaign.id,
              name: campaign.name,
              spend: transformed.spend,
              impressions: transformed.impressions,
              clicks: transformed.clicks,
              ctr: transformed.ctr,
              cost_per_result: transformed.cost_per_result || 0,
              results: transformed.conversions,
              reach: transformed.reach,
              link_clicks: transformed.link_clicks,
            }
            
            return campaignData
          } catch (error: any) {
            return null
          }
        })
        
        const results = await Promise.all(batchPromises)
        results.forEach((data) => {
          if (data) {
            // Usar nombre de campaña como key para búsqueda por nombre exacto
            comparativeMap.set(data.name, data)
          }
        })
        
        if (i + BATCH_SIZE < allCampaigns.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
      console.log(`[Meta Comparatives API] Found ${comparativeMap.size} campaigns with spend > 0 in ${periodName}`)
      
      // Paso 4: Comparar campañas por nombre exacto
      const comparisons: CampaignComparison[] = []
      
      currentPeriodCampaigns.forEach((currentCampaign) => {
        const comparativeCampaign = comparativeMap.get(currentCampaign.name)
        
        if (!comparativeCampaign) {
          // No hay datos comparativos (no existe campaña con mismo nombre)
          comparisons.push({
            campaign_id: currentCampaign.id,
            campaign_name: currentCampaign.name,
            current: {
              spend: currentCampaign.spend,
              impressions: currentCampaign.impressions,
              clicks: currentCampaign.clicks,
              ctr: currentCampaign.ctr,
              cost_per_result: currentCampaign.cost_per_result,
              results: currentCampaign.results,
            },
            comparative: {
              spend: 0,
              impressions: 0,
              clicks: 0,
              ctr: 0,
              cost_per_result: 0,
              results: 0,
            },
            change: {
              spend: { value: 0, percent: 0, isBetter: false },
              ctr: { value: 0, percent: 0, isBetter: false },
              cost_per_result: { value: 0, percent: 0, isBetter: false },
              results: { value: 0, percent: 0, isBetter: false },
            },
            hasData: false,
          })
          return
        }
        
        // Calcular cambios
        const spendChange = currentCampaign.spend - comparativeCampaign.spend
        const ctrChange = currentCampaign.ctr - comparativeCampaign.ctr
        const costPerResultChange = currentCampaign.cost_per_result - comparativeCampaign.cost_per_result
        const resultsChange = currentCampaign.results - comparativeCampaign.results
        
        comparisons.push({
          campaign_id: currentCampaign.id,
          campaign_name: currentCampaign.name,
          current: {
            spend: currentCampaign.spend,
            impressions: currentCampaign.impressions,
            clicks: currentCampaign.clicks,
            ctr: currentCampaign.ctr,
            cost_per_result: currentCampaign.cost_per_result,
            results: currentCampaign.results,
          },
          comparative: {
            spend: comparativeCampaign.spend,
            impressions: comparativeCampaign.impressions,
            clicks: comparativeCampaign.clicks,
            ctr: comparativeCampaign.ctr,
            cost_per_result: comparativeCampaign.cost_per_result,
            results: comparativeCampaign.results,
          },
          change: {
            spend: {
              value: spendChange,
              percent: calculatePercentChange(currentCampaign.spend, comparativeCampaign.spend),
              isBetter: calculateIsBetter('spend', currentCampaign.spend, comparativeCampaign.spend),
            },
            ctr: {
              value: ctrChange,
              percent: calculatePercentChange(currentCampaign.ctr, comparativeCampaign.ctr),
              isBetter: calculateIsBetter('ctr', currentCampaign.ctr, comparativeCampaign.ctr),
            },
            cost_per_result: {
              value: costPerResultChange,
              percent: calculatePercentChange(currentCampaign.cost_per_result, comparativeCampaign.cost_per_result),
              isBetter: calculateIsBetter('cost_per_result', currentCampaign.cost_per_result, comparativeCampaign.cost_per_result),
            },
            results: {
              value: resultsChange,
              percent: calculatePercentChange(currentCampaign.results, comparativeCampaign.results),
              isBetter: calculateIsBetter('results', currentCampaign.results, comparativeCampaign.results),
            },
          },
          hasData: true,
        })
      })
      
      return comparisons
    }
    
    // Obtener comparativas para mes anterior y año anterior
    const [previousMonthComparisons, previousYearComparisons] = await Promise.all([
      getComparativeData(previousMonthPeriod, 'previous month'),
      getComparativeData(previousYearPeriod, 'previous year'),
    ])
    
    // Categorizar comparaciones
    const categorizeComparisons = (comparisons: CampaignComparison[]) => {
      const citas: CampaignComparison[] = []
      const leads: CampaignComparison[] = []
      const ecom: CampaignComparison[] = []
      
      comparisons.forEach((comparison) => {
        // Necesitamos obtener el objective de la campaña para categorizar correctamente
        const campaign = allCampaigns.find(c => c.id === comparison.campaign_id)
        const category = categorizeCampaign(comparison.campaign_name, campaign?.objective || '')
        
        if (category === 'citas') {
          citas.push(comparison)
        } else if (category === 'ecom') {
          ecom.push(comparison)
        } else {
          leads.push(comparison)
        }
      })
      
      return { citas, leads, ecom }
    }
    
    const previousMonthByCategory = categorizeComparisons(previousMonthComparisons)
    const previousYearByCategory = categorizeComparisons(previousYearComparisons)
    
    console.log(`[Meta Comparatives API] Comparisons completed:`)
    console.log(`  - Previous month: ${previousMonthComparisons.length} total (${previousMonthByCategory.citas.length} citas, ${previousMonthByCategory.leads.length} leads, ${previousMonthByCategory.ecom.length} ecom)`)
    console.log(`  - Previous year: ${previousYearComparisons.length} total (${previousYearByCategory.citas.length} citas, ${previousYearByCategory.leads.length} leads, ${previousYearByCategory.ecom.length} ecom)`)
    
    return NextResponse.json({
      currentPeriod: { start: startDate, end: endDate },
      previousMonth: {
        start: previousMonthPeriod.start,
        end: previousMonthPeriod.end,
        data: previousMonthComparisons,
      },
      previousYear: {
        start: previousYearPeriod.start,
        end: previousYearPeriod.end,
        data: previousYearComparisons,
      },
      byCategory: {
        citas: {
          previousMonth: previousMonthByCategory.citas,
          previousYear: previousYearByCategory.citas,
        },
        leads: {
          previousMonth: previousMonthByCategory.leads,
          previousYear: previousYearByCategory.leads,
        },
        ecom: {
          previousMonth: previousMonthByCategory.ecom,
          previousYear: previousYearByCategory.ecom,
        },
      },
    })
  } catch (error: any) {
    console.error('[Meta Comparatives API] Error:', error)
    return NextResponse.json(
      { 
        error: 'Error al obtener comparativas',
        details: error.message 
      },
      { status: 500 }
    )
  }
}


