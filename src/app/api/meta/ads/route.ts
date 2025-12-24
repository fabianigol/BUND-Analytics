import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MetaAd } from '@/types'

// Función helper para categorizar anuncios (igual que campañas)
function categorizeAd(ad: MetaAd): 'citas' | 'leads' | 'ecom' {
  const campaignNameUpper = ad.campaign_name.toUpperCase()
  
  if (campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('BUNDCLUB')) {
    return 'citas'
  }
  if (campaignNameUpper.includes('ECOM') || campaignNameUpper.includes('SALES')) {
    return 'ecom'
  }
  return 'leads'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Obtener parámetros de filtro
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const category = searchParams.get('category') as 'citas' | 'leads' | 'ecom' | null

    // Construir query base
    let query = supabase
      .from('meta_ads')
      .select('*')
      .order('date', { ascending: false })

    // Filtrar por fecha si se proporciona
    if (startDate && endDate) {
      query = query
        .gte('date', startDate)
        .lte('date', endDate)
    }

    const { data: allAds, error } = await query

    if (error) {
      console.error('[Meta Ads API] Error fetching ads:', error)
      return NextResponse.json(
        { error: 'Error al obtener anuncios', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[Meta Ads API] Found ${allAds?.length || 0} ads in database`)
    
    if (!allAds || allAds.length === 0) {
      console.log('[Meta Ads API] No ads found in database. Returning empty structure.')
      return NextResponse.json({
        top3General: [],
        byCategory: {
          citas: { top3PerCampaign: [], bottom3PerCampaign: [] },
          leads: { top3PerCampaign: [], bottom3PerCampaign: [] },
          ecom: { top3PerCampaign: [], bottom3PerCampaign: [] },
        },
      })
    }

    // Convertir a MetaAd y filtrar por categoría si se especifica
    let ads: MetaAd[] = allAds.map((ad: any) => ({
      id: ad.id,
      ad_id: ad.ad_id,
      ad_name: ad.ad_name,
      campaign_id: ad.campaign_id,
      campaign_name: ad.campaign_name,
      adset_id: ad.adset_id,
      status: ad.status,
      spend: parseFloat(ad.spend) || 0,
      impressions: parseInt(ad.impressions) || 0,
      clicks: parseInt(ad.clicks) || 0,
      conversions: parseInt(ad.conversions) || 0,
      cpm: parseFloat(ad.cpm) || 0,
      cpc: parseFloat(ad.cpc) || 0,
      ctr: parseFloat(ad.ctr) || 0,
      roas: parseFloat(ad.roas) || 0,
      date: ad.date,
      created_at: ad.created_at,
      reach: ad.reach ? parseInt(ad.reach) : undefined,
      link_clicks: ad.link_clicks ? parseInt(ad.link_clicks) : undefined,
      actions: ad.actions || [],
      cost_per_result: ad.cost_per_result ? parseFloat(ad.cost_per_result) : undefined,
      thumbnail_url: ad.thumbnail_url || undefined,
    }))

    // Filtrar por categoría si se especifica
    if (category) {
      ads = ads.filter(ad => categorizeAd(ad) === category)
    }

    // Filtrar solo anuncios con datos válidos (spend > 0 o impressions > 0)
    const beforeFilter = ads.length
    ads = ads.filter(ad => ad.spend > 0 || ad.impressions > 0)
    console.log(`[Meta Ads API] After filtering valid ads: ${ads.length} (from ${beforeFilter})`)

    // Función para obtener Top 3 General (mejores globalmente)
    const getTop3General = (adsList: MetaAd[]): MetaAd[] => {
      return [...adsList]
        .sort((a, b) => {
          // Ordenar por CTR descendente, luego por conversiones descendente
          if (b.ctr !== a.ctr) {
            return b.ctr - a.ctr
          }
          return b.conversions - a.conversions
        })
        .slice(0, 3)
    }

    // Función para obtener Top 3 por cada campaña
    const getTop3PerCampaign = (adsList: MetaAd[]): MetaAd[] => {
      const campaignMap = new Map<string, MetaAd[]>()
      
      // Agrupar anuncios por campaña
      adsList.forEach(ad => {
        if (!campaignMap.has(ad.campaign_id)) {
          campaignMap.set(ad.campaign_id, [])
        }
        campaignMap.get(ad.campaign_id)!.push(ad)
      })
      
      // Para cada campaña, obtener los top 3
      const result: MetaAd[] = []
      campaignMap.forEach((campaignAds) => {
        const top3 = [...campaignAds]
          .sort((a, b) => {
            // Ordenar por CTR descendente, luego por conversiones descendente
            if (b.ctr !== a.ctr) {
              return b.ctr - a.ctr
            }
            return b.conversions - a.conversions
          })
          .slice(0, 3)
        result.push(...top3)
      })
      
      return result
    }

    // Función para obtener Bottom 3 por cada campaña
    const getBottom3PerCampaign = (adsList: MetaAd[]): MetaAd[] => {
      const campaignMap = new Map<string, MetaAd[]>()
      
      // Agrupar anuncios por campaña
      adsList.forEach(ad => {
        if (!campaignMap.has(ad.campaign_id)) {
          campaignMap.set(ad.campaign_id, [])
        }
        campaignMap.get(ad.campaign_id)!.push(ad)
      })
      
      // Para cada campaña, obtener los bottom 3
      const result: MetaAd[] = []
      campaignMap.forEach((campaignAds) => {
        const bottom3 = [...campaignAds]
          .filter(ad => ad.ctr > 0) // Solo anuncios con CTR > 0
          .sort((a, b) => {
            // Ordenar por CTR ascendente, luego por cost_per_result descendente
            if (a.ctr !== b.ctr) {
              return a.ctr - b.ctr
            }
            const aCpr = a.cost_per_result || Infinity
            const bCpr = b.cost_per_result || Infinity
            return bCpr - aCpr
          })
          .slice(0, 3)
        result.push(...bottom3)
      })
      
      return result
    }

    // Calcular para todas las categorías
    const citasAds = ads.filter(ad => categorizeAd(ad) === 'citas')
    const leadsAds = ads.filter(ad => categorizeAd(ad) === 'leads')
    const ecomAds = ads.filter(ad => categorizeAd(ad) === 'ecom')

    // Si se especifica una categoría, solo retornar esa categoría
    if (category) {
      const categoryAds = category === 'citas' ? citasAds : category === 'leads' ? leadsAds : ecomAds
      return NextResponse.json({
        top3General: getTop3General(categoryAds),
        top3PerCampaign: getTop3PerCampaign(categoryAds),
        bottom3PerCampaign: getBottom3PerCampaign(categoryAds),
      })
    }

    // Calcular métricas agregadas de todos los anuncios
    const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0)
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.impressions, 0)
    const totalClicks = ads.reduce((sum, ad) => sum + ad.clicks, 0)
    const totalLinkClicks = ads.reduce((sum, ad) => sum + (ad.link_clicks || 0), 0)
    const totalConversions = ads.reduce((sum, ad) => sum + ad.conversions, 0)
    const totalReach = ads.reduce((sum, ad) => sum + (ad.reach || 0), 0)
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0
    const avgCPR = totalConversions > 0 ? totalSpend / totalConversions : 0
    const avgROAS = ads.length > 0 ? ads.reduce((sum, ad) => sum + ad.roas, 0) / ads.length : 0

    // Calcular conversiones por tipo
    const conversionsByType = {
      citas: citasAds.reduce((sum, ad) => sum + ad.conversions, 0),
      leads: leadsAds.reduce((sum, ad) => sum + ad.conversions, 0),
      ecom: ecomAds.reduce((sum, ad) => sum + ad.conversions, 0),
    }

    // Retornar todas las categorías con métricas agregadas
    return NextResponse.json({
      top3General: getTop3General(ads),
      byCategory: {
        citas: {
          top3PerCampaign: getTop3PerCampaign(citasAds),
          bottom3PerCampaign: getBottom3PerCampaign(citasAds),
        },
        leads: {
          top3PerCampaign: getTop3PerCampaign(leadsAds),
          bottom3PerCampaign: getBottom3PerCampaign(leadsAds),
        },
        ecom: {
          top3PerCampaign: getTop3PerCampaign(ecomAds),
          bottom3PerCampaign: getBottom3PerCampaign(ecomAds),
        },
      },
      metrics: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalLinkClicks,
        totalConversions,
        totalReach,
        avgCTR,
        avgCPC,
        avgCPM,
        avgCPR,
        avgROAS,
        conversionsByType,
      },
    })
  } catch (error: any) {
    console.error('[Meta Ads API] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener anuncios', details: error.message },
      { status: 500 }
    )
  }
}

