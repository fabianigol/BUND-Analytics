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

  // Determinar el tipo de acción principal según el objetivo de la campaña
  private getPrimaryActionType(objective: string, actions: Array<{ action_type: string; value: string }>): {
    actionType: string | null
    value: number
  } {
    if (!actions || actions.length === 0) {
      return { actionType: null, value: 0 }
    }
    
    const objectiveUpper = objective.toUpperCase()
    
    // Para OUTCOME_LEADS: buscar CITA CONFIRMADA o Form1_Short_Completed o TypeformSubmit
    if (objectiveUpper.includes('OUTCOME_LEADS') || objectiveUpper.includes('LEAD')) {
      // Prioridad: CITA CONFIRMADA > Form1_Short_Completed > TypeformSubmit > otros leads
      const priorityPatterns = [
        /cita.?confirmada/i,
        /form1.?short.?completed/i,
        /typeform.?submit/i,
        /leads.*form/i,
      ]
      
      // Buscar por coincidencia exacta primero
      const exactMatches = [
        'CITA CONFIRMADA',
        'cita_confirmada',
        'onsite_conversion.cita_confirmada',
        'offsite_conversion.cita_confirmada',
        'Form1_Short_Completed',
        'form1_short_completed',
        'TypeformSubmit',
        'typeformsubmit',
        'Leads (Form)',
        'leads (form)',
      ]
      
      for (const exactMatch of exactMatches) {
        const action = actions.find(a => {
          const actionTypeLower = a.action_type.toLowerCase()
          const matchLower = exactMatch.toLowerCase()
          return a.action_type === exactMatch || actionTypeLower === matchLower
        })
        if (action && parseInt(action.value) > 0) {
          return {
            actionType: action.action_type,
            value: parseInt(action.value) || 0,
          }
        }
      }
      
      // Si no hay coincidencia exacta, buscar por patrón
      for (const pattern of priorityPatterns) {
        const matchingActions = actions
          .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
          .filter(a => a.valueNum > 0 && pattern.test(a.action_type))
          .sort((a, b) => b.valueNum - a.valueNum) // Ordenar por valor descendente
        
        if (matchingActions.length > 0) {
          console.log(`[Meta Transform] Found action by pattern for OUTCOME_LEADS: ${matchingActions[0].action_type} = ${matchingActions[0].valueNum}`)
          return {
            actionType: matchingActions[0].action_type,
            value: matchingActions[0].valueNum,
          }
        }
      }
      
      // Si aún no encontramos nada, buscar cualquier acción que contenga palabras clave de conversión
      const conversionKeywords = ['conversion', 'cita', 'form', 'lead', 'submit', 'complete']
      const keywordActions = actions
        .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
        .filter(a => {
          if (a.valueNum <= 0) return false
          const actionTypeLower = a.action_type.toLowerCase()
          return conversionKeywords.some(keyword => actionTypeLower.includes(keyword))
        })
        .sort((a, b) => b.valueNum - a.valueNum)
      
      if (keywordActions.length > 0) {
        console.log(`[Meta Transform] Found action by keyword for OUTCOME_LEADS: ${keywordActions[0].action_type} = ${keywordActions[0].valueNum}`)
        return {
          actionType: keywordActions[0].action_type,
          value: keywordActions[0].valueNum,
        }
      }
    }
    
    // Para OUTCOME_SALES: buscar primero CITA CONFIRMADA (si existe), luego Website purchases
    // Meta Ads Manager prioriza CITA CONFIRMADA sobre Website purchases cuando ambas están presentes
    if (objectiveUpper.includes('OUTCOME_SALES') || objectiveUpper.includes('SALES') || objectiveUpper.includes('PURCHASE')) {
      // Primero buscar CITA CONFIRMADA (prioridad para campañas de citas)
      const citaMatches = [
        'CITA CONFIRMADA',
        'cita_confirmada',
        'onsite_conversion.cita_confirmada',
        'offsite_conversion.cita_confirmada',
      ]
      
      for (const exactMatch of citaMatches) {
        const action = actions.find(a => {
          const actionTypeLower = a.action_type.toLowerCase()
          const matchLower = exactMatch.toLowerCase()
          return a.action_type === exactMatch || actionTypeLower === matchLower
        })
        if (action && parseInt(action.value) > 0) {
          console.log(`[Meta Transform] OUTCOME_SALES: Found CITA CONFIRMADA (priority): ${action.action_type} = ${action.value}`)
          return {
            actionType: action.action_type,
            value: parseInt(action.value) || 0,
          }
        }
      }
      
      // Si no hay CITA CONFIRMADA, buscar por patrón
      const citaPattern = /cita.?confirmada/i
      const citaAction = actions.find(a => {
        const value = parseInt(a.value) || 0
        return value > 0 && citaPattern.test(a.action_type)
      })
      if (citaAction) {
        console.log(`[Meta Transform] OUTCOME_SALES: Found CITA CONFIRMADA by pattern: ${citaAction.action_type} = ${citaAction.value}`)
        return {
          actionType: citaAction.action_type,
          value: parseInt(citaAction.value) || 0,
        }
      }
      
      // Si no hay CITA CONFIRMADA, buscar Website purchases
      const purchaseMatches = [
        'Website purchases',
        'website_purchase',
        'onsite_conversion.purchase',
        'offsite_conversion.purchase',
        'purchase',
      ]
      
      for (const exactMatch of purchaseMatches) {
        const action = actions.find(a => {
          const actionTypeLower = a.action_type.toLowerCase()
          const matchLower = exactMatch.toLowerCase()
          return a.action_type === exactMatch || actionTypeLower === matchLower
        })
        if (action && parseInt(action.value) > 0) {
          console.log(`[Meta Transform] OUTCOME_SALES: Found Website purchases: ${action.action_type} = ${action.value}`)
          return {
            actionType: action.action_type,
            value: parseInt(action.value) || 0,
          }
        }
      }
      
      // Buscar por patrón de purchase
      const purchasePattern = /purchase/i
      const purchaseAction = actions.find(a => {
        const value = parseInt(a.value) || 0
        return value > 0 && purchasePattern.test(a.action_type)
      })
      if (purchaseAction) {
        console.log(`[Meta Transform] OUTCOME_SALES: Found purchase by pattern: ${purchaseAction.action_type} = ${purchaseAction.value}`)
        return {
          actionType: purchaseAction.action_type,
          value: parseInt(purchaseAction.value) || 0,
        }
      }
    }
    
    // Si no encontramos una acción principal, buscar acciones de conversión (excluir engagement)
    // Excluir acciones de engagement comunes que no son conversiones reales
    const engagementActions = [
      'link_click',
      'landing_page_view',
      'post_engagement',
      'page_engagement',
      'post_reaction',
      'post_comment',
      'post_share',
      'video_view',
      'video_play',
      'photo_view',
      'onsite_conversion.web_site_visit',
      'offsite_conversion.web_site_visit',
    ]
    
    // Filtrar acciones de conversión (excluir engagement)
    const conversionActions = actions
      .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
      .filter(a => {
        if (a.valueNum <= 0) return false
        const actionTypeLower = a.action_type.toLowerCase()
        // Excluir acciones de engagement
        return !engagementActions.some(engagement => actionTypeLower.includes(engagement.toLowerCase()))
      })
      .sort((a, b) => b.valueNum - a.valueNum)
    
    // Si encontramos acciones de conversión, usar la de mayor valor
    if (conversionActions.length > 0) {
      console.log(`[Meta Transform] Using conversion action (fallback): ${conversionActions[0].action_type} = ${conversionActions[0].valueNum}`)
      return {
        actionType: conversionActions[0].action_type,
        value: conversionActions[0].valueNum,
      }
    }
    
    // Último recurso: usar cualquier acción con valor > 0 (pero loguear advertencia)
    const anyAction = actions
      .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
      .filter(a => a.valueNum > 0)
      .sort((a, b) => b.valueNum - a.valueNum)[0]
    
    if (anyAction) {
      console.warn(`[Meta Transform] Using non-conversion action as fallback: ${anyAction.action_type} = ${anyAction.valueNum}`)
      return {
        actionType: anyAction.action_type,
        value: anyAction.valueNum,
      }
    }
    
    return { actionType: null, value: 0 }
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
    
    // Determinar el objetivo real: si el nombre contiene "Thebundclub", es OUTCOME_SALES
    // Esto corrige casos donde el objective puede estar mal configurado
    const campaignNameUpper = campaign.name.toUpperCase()
    let effectiveObjective = campaign.objective
    
    if (campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('THE BUNDCLUB')) {
      effectiveObjective = 'OUTCOME_SALES'
      console.log(`[Meta Transform] Campaign "${campaign.name}" detected as OUTCOME_SALES based on name`)
    }
    
    // Log para debug
    if (actions.length > 0) {
      console.log(`[Meta Transform] Actions found for campaign:`, actions.map(a => `${a.action_type}: ${a.value}`).slice(0, 5))
    }
    
    // Determinar el resultado principal según el objetivo efectivo de la campaña
    const primaryResult = this.getPrimaryActionType(effectiveObjective, actions)
    
    // Log para debug
    if (actions.length > 0) {
      console.log(`[Meta Transform] Campaign: ${campaign.name}, Objective: ${campaign.objective}`)
      console.log(`[Meta Transform] Available actions:`, actions.map(a => `${a.action_type}: ${a.value}`).join(', '))
      console.log(`[Meta Transform] Primary result: ${primaryResult.actionType} = ${primaryResult.value}`)
    }
    
    // Calcular conversiones totales desde actions (para compatibilidad)
    const totalConversions = actions.reduce((sum, action) => {
      return sum + (parseInt(action.value) || 0)
    }, 0)
    
    // Usar el resultado principal como "conversions" (lo que Meta muestra como "Results")
    const primaryConversions = primaryResult.value
    
    const cpm = insights?.cpm ? parseFloat(insights.cpm) || 0 : 0
    const cpc = insights?.cpc ? parseFloat(insights.cpc) || 0 : 0
    const ctr = insights?.ctr ? parseFloat(insights.ctr) || 0 : 0
    
    // Calcular cost_per_result basado en el resultado principal
    // Si tenemos cost_per_action_type para la acción principal, usarlo
    // Si no, calcular como spend / primaryConversions
    let cost_per_result = 0
    if (primaryResult.actionType && insights?.cost_per_action_type) {
      const primaryActionLower = primaryResult.actionType.toLowerCase()
      
      // Buscar coincidencia exacta primero
      let primaryCostPerAction = insights.cost_per_action_type.find(cpa => 
        cpa.action_type === primaryResult.actionType
      )
      
      // Si no hay coincidencia exacta, buscar por coincidencia parcial (case-insensitive)
      if (!primaryCostPerAction) {
        primaryCostPerAction = insights.cost_per_action_type.find(cpa => {
          const cpaLower = cpa.action_type.toLowerCase()
          return cpaLower === primaryActionLower ||
            cpaLower.includes(primaryActionLower) ||
            primaryActionLower.includes(cpaLower) ||
            // Para acciones con formato "onsite_conversion.xxx" o "offsite_conversion.xxx"
            (primaryActionLower.includes('cita') && cpaLower.includes('cita')) ||
            (primaryActionLower.includes('form1') && cpaLower.includes('form1')) ||
            (primaryActionLower.includes('typeform') && cpaLower.includes('typeform'))
        })
      }
      
      if (primaryCostPerAction) {
        cost_per_result = parseFloat(primaryCostPerAction.value) || 0
        console.log(`[Meta Transform] Found cost_per_action_type for ${primaryResult.actionType}: ${cost_per_result}`)
      } else {
        console.log(`[Meta Transform] No cost_per_action_type found for ${primaryResult.actionType}`)
        console.log(`[Meta Transform] Available cost_per_action_type:`, insights.cost_per_action_type.map(cpa => cpa.action_type).join(', '))
      }
    }
    
    // Si no encontramos cost_per_action_type para la acción principal, calcular
    if (cost_per_result === 0 && primaryConversions > 0 && spend > 0) {
      cost_per_result = spend / primaryConversions
      console.log(`[Meta Transform] Calculated cost_per_result: ${spend} / ${primaryConversions} = ${cost_per_result}`)
    } else if (cost_per_result === 0) {
      console.warn(`[Meta Transform] Cannot calculate cost_per_result: primaryConversions=${primaryConversions}, spend=${spend}`)
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
      conversions: primaryConversions, // Usar el resultado principal, no la suma total
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

