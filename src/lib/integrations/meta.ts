import { MetaCampaign } from '@/types'

const META_API_URL = 'https://graph.facebook.com/v18.0'

interface MetaConfig {
  accessToken: string
  adAccountId: string
}

export class MetaService {
  private accessToken: string
  private adAccountId: string

  constructor(config: MetaConfig) {
    this.accessToken = config.accessToken
    // Normalizar Ad Account ID: asegurar que tenga el prefijo "act_"
    this.adAccountId = config.adAccountId.startsWith('act_')
      ? config.adAccountId
      : `act_${config.adAccountId}`
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const searchParams = new URLSearchParams({
      access_token: this.accessToken,
      ...params,
    })

    const url = `${META_API_URL}${endpoint}?${searchParams}`
    console.log(`[Meta API] Requesting: ${endpoint}`)

    const response = await fetch(url)

    if (!response.ok) {
      let errorMessage = response.statusText
      try {
        const error = await response.json()
        errorMessage = error.error?.message || error.error?.error_user_msg || error.error?.error_subcode || JSON.stringify(error)
        console.error(`[Meta API] Error response:`, error)
      } catch (e) {
        const text = await response.text()
        errorMessage = text || response.statusText
        console.error(`[Meta API] Error text:`, text)
      }
      throw new Error(`Meta API error: ${errorMessage} (Status: ${response.status})`)
    }

    return response.json()
  }

  async getCampaigns() {
    const allCampaigns: Array<{
      id: string
      name: string
      status: string
      objective: string
      created_time: string
      updated_time: string
    }> = []
    let nextUrl: string | null = null
    let pageCount = 0
    const failedPages: number[] = []

    do {
      pageCount++
      try {
        const params: Record<string, string> = {
          fields: 'id,name,status,objective,created_time,updated_time',
          limit: '100', // Máximo por página según API de Meta (109 campañas = 2 páginas)
        }

        if (nextUrl) {
          // Extraer cursor 'after' de la URL de paginación
          try {
            const url = new URL(nextUrl)
            const after = url.searchParams.get('after')
            if (after) {
              params.after = after
            }
          } catch (e) {
            // Si nextUrl no es una URL válida, puede ser solo el cursor
            params.after = nextUrl
          }
        }

        const response = await this.request<{
          data: Array<{
            id: string
            name: string
            status: string
            objective: string
            created_time: string
            updated_time: string
          }>
          paging?: {
            cursors?: { before?: string; after?: string }
            next?: string
            previous?: string
          }
        }>(`/${this.adAccountId}/campaigns`, params)

        console.log(`[Meta API] Page ${pageCount}: Retrieved ${response.data.length} campaigns`)
        allCampaigns.push(...response.data)
        nextUrl = response.paging?.next || null
      } catch (pageError) {
        console.error(`[Meta API] Error fetching page ${pageCount}:`, pageError)
        failedPages.push(pageCount)
        // Intentar continuar con la siguiente página si tenemos el cursor
        // Si no podemos continuar, salir del bucle
        if (!nextUrl) {
          break
        }
        // Si hay un error pero tenemos nextUrl, intentar continuar
        // Nota: Esto puede causar un bucle infinito si el error persiste
        // Por seguridad, limitamos a 10 intentos
        if (pageCount > 10) {
          console.error(`[Meta API] Too many page errors, stopping pagination`)
          break
        }
      }
    } while (nextUrl)

    if (failedPages.length > 0) {
      console.warn(`[Meta API] Failed to retrieve ${failedPages.length} page(s): ${failedPages.join(', ')}`)
    }

    console.log(`[Meta API] Total campaigns retrieved: ${allCampaigns.length} across ${pageCount} pages`)
    return { data: allCampaigns }
  }

  async getCampaignInsights(
    campaignId: string,
    params?: {
      datePreset?: string
      timeRange?: { since: string; until: string }
    }
  ) {
    // Campos válidos de Meta API Insights según documentación oficial
    // Referencia: https://developers.facebook.com/docs/marketing-api/reference/ads-insights/
    // Campos básicos: spend, impressions, clicks, reach, cpm, cpc, ctr
    // Campos de conversiones: actions (devuelve array con action_type y value)
    // Campos de costo: cost_per_action_type (devuelve array con action_type y value)
    // NOTA: link_clicks NO existe en insights, usar clicks o outbound_clicks si está disponible
    // NOTA: outbound_clicks puede no estar disponible en todas las versiones
    const fields = 'spend,impressions,clicks,actions,reach,cpm,cpc,ctr,cost_per_action_type'
    const insightParams: Record<string, string> = { 
      fields
    }

    if (params?.datePreset) {
      insightParams.date_preset = params.datePreset
    } else if (params?.timeRange) {
      insightParams.time_range = JSON.stringify(params.timeRange)
    }

    const response = await this.request<{
      data: Array<{
        spend: string
        impressions: string
        clicks: string
        actions?: Array<{ action_type: string; value: string }>
        reach?: string
        cpm: string
        cpc: string
        ctr: string
        cost_per_action_type?: Array<{ action_type: string; value: string }>
        date_start: string
        date_stop: string
      }>
      paging?: {
        cursors?: { before?: string; after?: string }
        next?: string
        previous?: string
      }
    }>(`/${campaignId}/insights`, insightParams)

    // Log detallado de la respuesta para debug
    if (response.data && response.data.length > 0) {
      const firstInsight = response.data[0]
      console.log(`[Meta API] Insights response for campaign ${campaignId}:`, {
        hasActions: !!firstInsight.actions,
        actionsCount: firstInsight.actions?.length || 0,
        actions: firstInsight.actions?.slice(0, 3) || [],
        hasReach: !!firstInsight.reach,
        reach: firstInsight.reach,
        // link_clicks no está disponible en insights, usar clicks
        clicks: firstInsight.clicks,
        hasCostPerActionType: !!firstInsight.cost_per_action_type,
        costPerActionTypeCount: firstInsight.cost_per_action_type?.length || 0,
        spend: firstInsight.spend,
        impressions: firstInsight.impressions,
      })
    } else {
      console.warn(`[Meta API] No insights data returned for campaign ${campaignId}`)
    }

    // Si hay múltiples fechas, consolidar en una sola entrada con totales
    if (response.data && response.data.length > 1) {
      const consolidated = response.data.reduce(
        (acc, day) => {
          // Consolidar actions (Results)
          const accActions = acc.actions || []
          const dayActions = day.actions || []
          const actionsMap = new Map<string, number>()

          // Sumar acciones del acumulador
          accActions.forEach((action) => {
            const current = parseInt(action.value) || 0
            actionsMap.set(action.action_type, (actionsMap.get(action.action_type) || 0) + current)
          })

          // Sumar acciones del día actual
          dayActions.forEach((action) => {
            const current = parseInt(action.value) || 0
            actionsMap.set(action.action_type, (actionsMap.get(action.action_type) || 0) + current)
          })

          const consolidatedActions = Array.from(actionsMap.entries()).map(([action_type, value]) => ({
            action_type,
            value: value.toString(),
          }))

          return {
            spend: (parseFloat(acc.spend) + parseFloat(day.spend)).toString(),
            impressions: (parseInt(acc.impressions) + parseInt(day.impressions)).toString(),
            clicks: (parseInt(acc.clicks) + parseInt(day.clicks)).toString(),
            actions: consolidatedActions,
            reach: day.reach || acc.reach || '0',
            cpm: acc.cpm,
            cpc: acc.cpc,
            ctr: acc.ctr,
            date_start: acc.date_start,
            date_stop: day.date_stop,
          }
        },
        response.data[0]
      )

      // Calcular métricas consolidadas
      const totalSpend = parseFloat(consolidated.spend)
      const totalClicks = parseInt(consolidated.clicks)
      const totalImpressions = parseInt(consolidated.impressions)

      if (totalImpressions > 0) {
        consolidated.ctr = ((totalClicks / totalImpressions) * 100).toFixed(4)
      }
      if (totalClicks > 0) {
        consolidated.cpc = (totalSpend / totalClicks).toFixed(4)
      }
      if (totalImpressions > 0) {
        consolidated.cpm = ((totalSpend / totalImpressions) * 1000).toFixed(4)
      }

      return { data: [consolidated] }
    }

    return response
  }

  async getAdAccountInsights(params?: {
    datePreset?: string
    timeRange?: { since: string; until: string }
    level?: 'account' | 'campaign' | 'adset' | 'ad'
  }) {
    const fields = 'spend,impressions,clicks,actions,cpm,cpc,ctr,reach,frequency'
    const insightParams: Record<string, string> = {
      fields,
      level: params?.level || 'account',
    }

    if (params?.datePreset) {
      insightParams.date_preset = params.datePreset
    } else if (params?.timeRange) {
      insightParams.time_range = JSON.stringify(params.timeRange)
    }

    return this.request<{
      data: Array<{
        spend: string
        impressions: string
        clicks: string
        actions?: Array<{ action_type: string; value: string }>
        cpm: string
        cpc: string
        ctr: string
        reach: string
        frequency: string
        date_start: string
        date_stop: string
      }>
    }>(`/${this.adAccountId}/insights`, insightParams)
  }

  async getAdSets(campaignId?: string) {
    const endpoint = campaignId
      ? `/${campaignId}/adsets`
      : `/${this.adAccountId}/adsets`

    return this.request<{
      data: Array<{
        id: string
        name: string
        status: string
        daily_budget?: string
        lifetime_budget?: string
        campaign_id: string
      }>
    }>(endpoint, {
      fields: 'id,name,status,daily_budget,lifetime_budget,campaign_id',
    })
  }

  // Transform Meta API data to our internal format
  transformCampaign(
    campaign: { id: string; name: string; status: string; objective: string; created_time: string },
    insights?: {
      spend?: string
      impressions?: string
      clicks?: string
      actions?: Array<{ action_type: string; value: string }>
      reach?: string
      cpm?: string
      cpc?: string
      ctr?: string
      cost_per_action_type?: Array<{ action_type: string; value: string }>
      date_start?: string
    }
  ): Omit<MetaCampaign, 'id'> {
    // Asegurar que todos los valores numéricos tengan defaults seguros
    const spend = insights?.spend ? parseFloat(insights.spend) || 0 : 0
    const impressions = insights?.impressions ? parseInt(insights.impressions) || 0 : 0
    const clicks = insights?.clicks ? parseInt(insights.clicks) || 0 : 0
    const reach = insights?.reach ? parseInt(insights.reach) || 0 : 0
    // link_clicks no está disponible en insights de Meta API
    // Usar clicks como alternativa (clicks incluye todos los tipos de clics)
    const link_clicks = insights?.clicks ? parseInt(insights.clicks) || 0 : 0
    
    // Calcular conversiones totales desde actions
    const actions = insights?.actions || []
    
    // Log para debug
    if (actions.length > 0) {
      console.log(`[Meta Transform] Actions found for campaign:`, actions.map(a => `${a.action_type}: ${a.value}`).slice(0, 5))
    }
    
    const totalConversions = actions.reduce((sum, action) => {
      return sum + (parseInt(action.value) || 0)
    }, 0)
    
    const cpm = insights?.cpm ? parseFloat(insights.cpm) || 0 : 0
    const cpc = insights?.cpc ? parseFloat(insights.cpc) || 0 : 0
    const ctr = insights?.ctr ? parseFloat(insights.ctr) || 0 : 0
    
    // Calcular cost_per_result (promedio de cost_per_action_type)
    let cost_per_result = 0
    if (insights?.cost_per_action_type && insights.cost_per_action_type.length > 0) {
      const totalCost = insights.cost_per_action_type.reduce((sum, cpa) => {
        return sum + (parseFloat(cpa.value) || 0)
      }, 0)
      cost_per_result = totalCost / insights.cost_per_action_type.length
    } else if (totalConversions > 0) {
      cost_per_result = spend / totalConversions
    }
    
    const roas = spend > 0 && totalConversions > 0 ? (totalConversions * 50) / spend : 0 // Approximate ROAS

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status as 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
      objective: campaign.objective || 'UNKNOWN',
      spend,
      impressions,
      clicks,
      conversions: totalConversions,
      cpm,
      cpc,
      ctr,
      roas,
      reach,
      link_clicks,
      actions,
      cost_per_result,
      date: insights?.date_start || new Date().toISOString().split('T')[0],
      created_at: campaign.created_time || new Date().toISOString(),
    }
  }
}

// Factory function to create service instance from environment variables (legacy)
export function createMetaService(): MetaService | null {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  if (!accessToken || !adAccountId) return null
  return new MetaService({ accessToken, adAccountId })
}

// Factory function to create service instance from Supabase settings
export async function createMetaServiceFromSupabase(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<MetaService | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings, connected')
    .eq('integration', 'meta')
    .single()

  if (error || !data || !data.connected) {
    return null
  }

  const { access_token, ad_account_id } = data.settings as {
    access_token?: string
    ad_account_id?: string
  }

  if (!access_token || !ad_account_id) {
    return null
  }

  return new MetaService({
    accessToken: access_token,
    adAccountId: ad_account_id,
  })
}

