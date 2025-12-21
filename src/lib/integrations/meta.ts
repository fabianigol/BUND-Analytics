import { MetaCampaign } from '@/types'

const META_API_URL = 'https://graph.facebook.com/v18.0'

// ID de conversión custom de CITA CONFIRMADA en Meta API
// Meta API devuelve conversiones custom con IDs numéricos, no nombres legibles
// Este ID es específico para la conversión "CITA CONFIRMADA"
const CITA_CONFIRMADA_CUSTOM_ID = '1605670663260269'
const CITA_CONFIRMADA_ACTION_TYPE = `offsite_conversion.custom.${CITA_CONFIRMADA_CUSTOM_ID}`

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
          // IMPORTANTE: NO filtrar por status - obtener TODAS las campañas (ACTIVE, PAUSED, ARCHIVED, etc.)
          // Esto permite mostrar campañas históricas cuando se filtra por fecha
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
    const fields = 'spend,impressions,clicks,actions,reach,cpm,cpc,ctr,cost_per_action_type,outbound_clicks'
    const insightParams: Record<string, string> = { 
      fields,
      // IMPORTANTE: Usar la ventana de atribución por defecto de la cuenta para que coincida con Ads Manager
      // Ads Manager usa la configuración de atribución de la cuenta por defecto
      // No especificar action_attribution_windows para usar los defaults de la cuenta
    }

    // IMPORTANTE: NO usar time_increment cuando hay timeRange
    // Cuando especificamos timeRange sin time_increment, la API devuelve datos agregados
    // directamente que coinciden con lo que muestra Ads Manager
    // Solo usar time_increment si realmente necesitamos datos diarios explícitos
    
    // NOTA: La API de Meta puede devolver múltiples variantes de la misma acción:
    // - onsite_conversion.cita_confirmada
    // - offsite_conversion.cita_confirmada  
    // - CITA CONFIRMADA (formato legible)
    // Ads Manager muestra la SUMA TOTAL de todas estas variantes
    // Por eso necesitamos sumar todas las variantes en lugar de seleccionar solo una

    if (params?.timeRange) {
      // Verificar formato de time_range: debe ser {"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
      // Asegurar que las fechas estén en formato correcto (YYYY-MM-DD)
      const since = params.timeRange.since.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? params.timeRange.since 
        : new Date(params.timeRange.since).toISOString().split('T')[0]
      const until = params.timeRange.until.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? params.timeRange.until 
        : new Date(params.timeRange.until).toISOString().split('T')[0]
      
      insightParams.time_range = JSON.stringify({ since, until })
      // NO agregar time_increment - la API devolverá datos agregados para el rango completo
      console.log(`[Meta API] Using time_range: ${insightParams.time_range} (timezone: PST/PDT, aggregated data)`)
    } else if (params?.datePreset) {
      insightParams.date_preset = params.datePreset
      // Para date_preset, tampoco usar time_increment por defecto
      // La API devolverá datos agregados que coinciden con Ads Manager
      console.log(`[Meta API] Using date_preset: ${params.datePreset} (aggregated data)`)
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
        outbound_clicks?: string
        date_start: string
        date_stop: string
      }>
      paging?: {
        cursors?: { before?: string; after?: string }
        next?: string
        previous?: string
      }
    }>(`/${campaignId}/insights`, insightParams)

    // Logging EXHAUSTIVO de TODOS los campos de la respuesta - para comparar con Ads Manager
    if (response.data && response.data.length > 0) {
      const firstInsight = response.data[0]
      const totalSpend = response.data.reduce((sum, d) => sum + parseFloat(d.spend || '0'), 0)
      const totalImpressions = response.data.reduce((sum, d) => sum + parseInt(d.impressions || '0'), 0)
      const totalClicks = response.data.reduce((sum, d) => sum + parseInt(d.clicks || '0'), 0)
      
      // Loggear TODOS los campos disponibles en la respuesta
      console.log(`[Meta API] ========== FULL INSIGHTS RESPONSE for campaign ${campaignId} ==========`)
      console.log(`[Meta API] Data points: ${response.data.length}`)
      console.log(`[Meta API] Date range: ${response.data[0].date_start} to ${response.data[response.data.length - 1].date_stop}`)
      console.log(`[Meta API] All available fields in response:`, Object.keys(firstInsight))
      console.log(`[Meta API] Basic metrics:`, {
        spend: firstInsight.spend,
        impressions: firstInsight.impressions,
        clicks: firstInsight.clicks,
        reach: firstInsight.reach,
        cpm: firstInsight.cpm,
        cpc: firstInsight.cpc,
        ctr: firstInsight.ctr,
      })
      
      // Verificar campos relacionados con link clicks
      console.log(`[Meta API] Link clicks related fields:`, {
        outbound_clicks: firstInsight.outbound_clicks || 'NOT PRESENT',
        clicks: firstInsight.clicks,
        // Buscar link_click en actions
        link_click_in_actions: firstInsight.actions?.find(a => 
          a.action_type.toLowerCase().includes('link_click') || 
          a.action_type.toLowerCase().includes('link click')
        ) || 'NOT FOUND',
      })
      
      // Loggear TODAS las acciones disponibles
      if (firstInsight.actions && firstInsight.actions.length > 0) {
        console.log(`[Meta API] ALL ACTIONS (${firstInsight.actions.length} total):`)
        firstInsight.actions.forEach((action, idx) => {
          console.log(`[Meta API]   Action ${idx + 1}: "${action.action_type}" = ${action.value}`)
        })
      } else {
        console.log(`[Meta API] No actions found in response`)
      }
      
      // Loggear TODOS los cost_per_action_type disponibles
      if (firstInsight.cost_per_action_type && firstInsight.cost_per_action_type.length > 0) {
        console.log(`[Meta API] ALL COST_PER_ACTION_TYPE (${firstInsight.cost_per_action_type.length} total):`)
        firstInsight.cost_per_action_type.forEach((cpa, idx) => {
          console.log(`[Meta API]   CPA ${idx + 1}: "${cpa.action_type}" = ${cpa.value}`)
        })
      } else {
        console.log(`[Meta API] No cost_per_action_type found in response`)
      }
      
      console.log(`[Meta API] ================================================================`)
    } else {
      console.warn(`[Meta API] No insights data returned for campaign ${campaignId}`)
    }

    // Si la API devuelve un solo registro, son datos agregados - devolver directamente
    // Esto es lo que ocurre cuando NO usamos time_increment con timeRange
    // La API devuelve datos agregados que coinciden exactamente con Ads Manager
    // IMPORTANTE: AGRUPAR VARIANTES antes de devolver para que transformCampaign pueda procesarlas correctamente
    if (response.data && response.data.length === 1) {
      const insight = response.data[0]
      
      // Loggear todas las acciones originales antes de agrupar
      if (insight.actions && insight.actions.length > 0) {
        console.log(`[Meta API] Aggregated data - ALL actions BEFORE grouping (${insight.actions.length}):`, 
          insight.actions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
      }
      
      // AGRUPAR VARIANTES de actions antes de devolver
      // Esto es CRÍTICO: la API puede devolver múltiples variantes de la misma acción
      // (onsite_conversion.cita_confirmada, offsite_conversion.cita_confirmada, CITA CONFIRMADA)
      // y Ads Manager muestra la SUMA TOTAL, por lo que debemos agruparlas
      if (insight.actions && insight.actions.length > 0) {
        const groupedActions = this.groupActionVariants(insight.actions)
        console.log(`[Meta API] Aggregated data - Actions AFTER grouping (${groupedActions.length}):`, 
          groupedActions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
        insight.actions = groupedActions
      }
      
      // AGRUPAR VARIANTES de cost_per_action_type también
      // Necesitamos agruparlas y calcular promedio ponderado para que coincida con Ads Manager
      if (insight.cost_per_action_type && insight.cost_per_action_type.length > 0) {
        const groupedCostPerAction = this.groupCostPerActionVariants(
          insight.cost_per_action_type,
          insight.actions || []
        )
        console.log(`[Meta API] Aggregated data - Cost per action type AFTER grouping (${groupedCostPerAction.length}):`, 
          groupedCostPerAction.map(cpa => `"${cpa.action_type}": ${cpa.value}`).join(', '))
        insight.cost_per_action_type = groupedCostPerAction
      }
      
      console.log(`[Meta API] Aggregated data returned for campaign ${campaignId}:`, {
        spend: insight.spend,
        impressions: insight.impressions,
        clicks: insight.clicks,
        outbound_clicks: insight.outbound_clicks || 'N/A',
        reach: insight.reach,
        actionsCount: insight.actions?.length || 0,
        dateRange: `${insight.date_start} to ${insight.date_stop}`,
      })
      return response
    }
    
    // Si hay múltiples registros (solo ocurre si usamos time_increment explícitamente),
    // consolidar en una sola entrada con totales
    // NOTA: Esto no debería ocurrir normalmente con timeRange sin time_increment
    if (response.data && response.data.length > 1) {
      // Consolidar datos diarios en un solo registro agregado
      const consolidated = response.data.reduce(
        (acc, day) => {
          // Consolidar actions (Results)
          // IMPORTANTE: Sumar por action_type exacto primero, luego agrupar variantes
          const accActions = acc.actions || []
          const dayActions = day.actions || []
          const actionsMap = new Map<string, number>()

          // Sumar acciones del acumulador por action_type exacto
          accActions.forEach((action) => {
            const current = parseInt(action.value) || 0
            actionsMap.set(action.action_type, (actionsMap.get(action.action_type) || 0) + current)
          })

          // Sumar acciones del día actual por action_type exacto
          dayActions.forEach((action) => {
            const current = parseInt(action.value) || 0
            actionsMap.set(action.action_type, (actionsMap.get(action.action_type) || 0) + current)
          })

          // Ahora agrupar variantes (onsite/offsite) en acciones base
          // Esto asegura que getPrimaryActionType pueda encontrar el total correcto
          const baseActionsMap = new Map<string, { totalValue: number; variants: Array<{ action_type: string; value: number }> }>()
          
          actionsMap.forEach((value, action_type) => {
            if (value > 0) {
              // Normalizar para encontrar la acción base
              const baseName = action_type
                .replace(/^(onsite_conversion|offsite_conversion)\./i, '')
                .replace(/[_\s]/g, '')
                .replace(/cita.?confirmada/i, 'citaconfirmada')
                .replace(/form1.?short.?completed/i, 'form1shortcompleted')
                .replace(/typeform.?submit/i, 'typeformsubmit')
                .replace(/purchase/i, 'purchase')
                .replace(/lead/i, 'lead')
                .toLowerCase()
              
              // Usar el nombre original más legible como clave base si no tiene prefijo
              const baseKey = action_type.includes('onsite_conversion') || action_type.includes('offsite_conversion')
                ? baseName
                : action_type.toLowerCase()
              
              if (!baseActionsMap.has(baseKey)) {
                baseActionsMap.set(baseKey, { totalValue: 0, variants: [] })
              }
              
              const baseAction = baseActionsMap.get(baseKey)!
              baseAction.totalValue += value
              baseAction.variants.push({ action_type, value })
            }
          })

          // Crear array de acciones consolidadas
          // Priorizar el nombre más legible (sin prefijos) si existe, sino usar el primero
          const consolidatedActions: Array<{ action_type: string; value: string }> = []
          
          baseActionsMap.forEach(({ totalValue, variants }, baseKey) => {
            // Buscar el nombre más legible (sin prefijos onsite/offsite)
            const readableVariant = variants.find(v => 
              !v.action_type.includes('onsite_conversion') && 
              !v.action_type.includes('offsite_conversion')
            )
            
            const actionType = readableVariant 
              ? readableVariant.action_type 
              : variants[0].action_type
            
            consolidatedActions.push({
              action_type: actionType,
              value: totalValue.toString(),
            })
          })

          // Consolidar cost_per_action_type también
          // IMPORTANTE: Agrupar variantes (onsite/offsite) para calcular promedio ponderado correcto
          const accCostPerAction = acc.cost_per_action_type || []
          const dayCostPerAction = day.cost_per_action_type || []
          const costPerActionMap = new Map<string, { totalCost: number; totalActions: number }>()

          // Procesar cost_per_action_type del acumulador
          accCostPerAction.forEach((cpa) => {
            const actionType = cpa.action_type
            const cost = parseFloat(cpa.value) || 0
            // Buscar el conteo de acciones correspondiente (puede ser variante)
            let actionCount = actionsMap.get(actionType) || 0
            // Si no encontramos por nombre exacto, buscar variantes
            if (actionCount === 0) {
              // Buscar en las acciones consolidadas por variante
              const baseName = actionType
                .replace(/^(onsite_conversion|offsite_conversion)\./i, '')
                .replace(/[_\s]/g, '')
                .toLowerCase()
              actionsMap.forEach((value, at) => {
                const atBase = at
                  .replace(/^(onsite_conversion|offsite_conversion)\./i, '')
                  .replace(/[_\s]/g, '')
                  .toLowerCase()
                if (atBase === baseName) {
                  actionCount += value
                }
              })
            }
            if (actionCount > 0) {
              const existing = costPerActionMap.get(actionType) || { totalCost: 0, totalActions: 0 }
              costPerActionMap.set(actionType, {
                totalCost: existing.totalCost + (cost * actionCount),
                totalActions: existing.totalActions + actionCount,
              })
            }
          })

          // Procesar cost_per_action_type del día actual
          dayCostPerAction.forEach((cpa) => {
            const actionType = cpa.action_type
            const cost = parseFloat(cpa.value) || 0
            // Buscar el conteo de acciones correspondiente
            let dayActionCount = parseInt(dayActions.find(a => a.action_type === actionType)?.value || '0') || 0
            // Si no encontramos por nombre exacto, buscar variantes
            if (dayActionCount === 0) {
              const baseName = actionType
                .replace(/^(onsite_conversion|offsite_conversion)\./i, '')
                .replace(/[_\s]/g, '')
                .toLowerCase()
              dayActions.forEach(a => {
                const aBase = a.action_type
                  .replace(/^(onsite_conversion|offsite_conversion)\./i, '')
                  .replace(/[_\s]/g, '')
                  .toLowerCase()
                if (aBase === baseName) {
                  dayActionCount += parseInt(a.value) || 0
                }
              })
            }
            if (dayActionCount > 0) {
              const existing = costPerActionMap.get(actionType) || { totalCost: 0, totalActions: 0 }
              costPerActionMap.set(actionType, {
                totalCost: existing.totalCost + (cost * dayActionCount),
                totalActions: existing.totalActions + dayActionCount,
              })
            }
          })

          // Agrupar cost_per_action_type por variantes base y calcular promedio ponderado
          const baseCostPerActionMap = new Map<string, { totalCost: number; totalActions: number; variants: Array<{ action_type: string; cost: number; actions: number }> }>()
          
          costPerActionMap.forEach(({ totalCost, totalActions }, actionType) => {
            const baseName = actionType
              .replace(/^(onsite_conversion|offsite_conversion)\./i, '')
              .replace(/[_\s]/g, '')
              .replace(/cita.?confirmada/i, 'citaconfirmada')
              .replace(/form1.?short.?completed/i, 'form1shortcompleted')
              .replace(/typeform.?submit/i, 'typeformsubmit')
              .replace(/purchase/i, 'purchase')
              .replace(/lead/i, 'lead')
              .toLowerCase()
            
            if (!baseCostPerActionMap.has(baseName)) {
              baseCostPerActionMap.set(baseName, { totalCost: 0, totalActions: 0, variants: [] })
            }
            
            const base = baseCostPerActionMap.get(baseName)!
            base.totalCost += totalCost
            base.totalActions += totalActions
            base.variants.push({ action_type: actionType, cost: totalCost / totalActions, actions: totalActions })
          })

          // Crear array de cost_per_action_type consolidadas
          const consolidatedCostPerAction: Array<{ action_type: string; value: string }> = []
          
          baseCostPerActionMap.forEach(({ totalCost, totalActions, variants }, baseName) => {
            // Calcular promedio ponderado
            const avgCost = totalActions > 0 ? totalCost / totalActions : 0
            
            // Usar el nombre más legible (sin prefijos) si existe
            const readableVariant = variants.find(v => 
              !v.action_type.includes('onsite_conversion') && 
              !v.action_type.includes('offsite_conversion')
            )
            
            const actionType = readableVariant 
              ? readableVariant.action_type 
              : variants[0].action_type
            
            consolidatedCostPerAction.push({
              action_type: actionType,
              value: avgCost.toFixed(4),
            })
          })

          // Calcular totales acumulados
          const totalSpend = parseFloat(acc.spend) + parseFloat(day.spend)
          const totalImpressions = parseInt(acc.impressions) + parseInt(day.impressions)
          const totalClicks = parseInt(acc.clicks) + parseInt(day.clicks)
          
          // Consolidar outbound_clicks o link_click de actions
          // Si outbound_clicks está disponible, usarlo; si no, SUMAR todas las variantes de link_click en actions
          let accOutboundClicks = parseInt(acc.outbound_clicks || '0')
          let dayOutboundClicks = parseInt(day.outbound_clicks || '0')
          
          // Si no hay outbound_clicks, buscar y SUMAR todas las variantes de link_click en actions
          if (accOutboundClicks === 0 && accActions.length > 0) {
            const accLinkClickSum = this.sumActionVariants(accActions, 'link_click')
            if (accLinkClickSum.totalValue > 0) {
              accOutboundClicks = accLinkClickSum.totalValue
            } else {
              // Buscar también otras variantes de link clicks
              const accLinkActions = accActions.filter(a => {
                const actionType = a.action_type.toLowerCase()
                return actionType.includes('link') && (actionType.includes('click') || actionType.includes('outbound'))
              })
              if (accLinkActions.length > 0) {
                accOutboundClicks = accLinkActions.reduce((sum, a) => sum + (parseInt(a.value) || 0), 0)
              }
            }
          }
          
          if (dayOutboundClicks === 0 && dayActions.length > 0) {
            const dayLinkClickSum = this.sumActionVariants(dayActions, 'link_click')
            if (dayLinkClickSum.totalValue > 0) {
              dayOutboundClicks = dayLinkClickSum.totalValue
            } else {
              // Buscar también otras variantes de link clicks
              const dayLinkActions = dayActions.filter(a => {
                const actionType = a.action_type.toLowerCase()
                return actionType.includes('link') && (actionType.includes('click') || actionType.includes('outbound'))
              })
              if (dayLinkActions.length > 0) {
                dayOutboundClicks = dayLinkActions.reduce((sum, a) => sum + (parseInt(a.value) || 0), 0)
              }
            }
          }
          
          const totalOutboundClicks = accOutboundClicks + dayOutboundClicks

          // Reach es único (no acumulativo) - usar el máximo o el último valor válido
          // En un período, el reach máximo representa el alcance único total
          const accReach = parseInt(acc.reach || '0')
          const dayReach = parseInt(day.reach || '0')
          const maxReach = Math.max(accReach, dayReach)

          return {
            spend: totalSpend.toString(),
            impressions: totalImpressions.toString(),
            clicks: totalClicks.toString(),
            actions: consolidatedActions,
            reach: maxReach.toString(),
            outbound_clicks: totalOutboundClicks.toString(),
            // Las métricas derivadas se recalcularán después desde los totales
            cpm: '0', // Se recalculará
            cpc: '0', // Se recalculará
            ctr: '0', // Se recalculará
            cost_per_action_type: consolidatedCostPerAction,
            date_start: acc.date_start,
            date_stop: day.date_stop,
          }
        },
        response.data[0]
      )

      // Recalcular todas las métricas derivadas desde los totales consolidados
      // Esto asegura precisión y coincide con cómo Ads Manager calcula estas métricas
      const totalSpend = parseFloat(consolidated.spend)
      const totalClicks = parseInt(consolidated.clicks)
      const totalImpressions = parseInt(consolidated.impressions)

      // CTR = (Clicks / Impressions) * 100
      if (totalImpressions > 0) {
        consolidated.ctr = ((totalClicks / totalImpressions) * 100).toFixed(4)
      } else {
        consolidated.ctr = '0'
      }

      // CPC = Spend / Clicks
      if (totalClicks > 0) {
        consolidated.cpc = (totalSpend / totalClicks).toFixed(4)
      } else {
        consolidated.cpc = '0'
      }

      // CPM = (Spend / Impressions) * 1000
      if (totalImpressions > 0) {
        consolidated.cpm = ((totalSpend / totalImpressions) * 1000).toFixed(4)
      } else {
        consolidated.cpm = '0'
      }

      console.log(`[Meta API] Consolidated metrics for campaign ${campaignId}:`, {
        spend: totalSpend.toFixed(2),
        impressions: totalImpressions,
        clicks: totalClicks,
        reach: consolidated.reach,
        ctr: consolidated.ctr,
        cpc: consolidated.cpc,
        cpm: consolidated.cpm,
        actionsCount: consolidated.actions?.length || 0,
        dateRange: `${consolidated.date_start} to ${consolidated.date_stop}`,
      })

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
      // NO usar time_increment por defecto - dejar que la API devuelva datos agregados
    }

    if (params?.timeRange) {
      // Verificar formato de time_range: debe ser {"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}
      const since = params.timeRange.since.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? params.timeRange.since 
        : new Date(params.timeRange.since).toISOString().split('T')[0]
      const until = params.timeRange.until.match(/^\d{4}-\d{2}-\d{2}$/) 
        ? params.timeRange.until 
        : new Date(params.timeRange.until).toISOString().split('T')[0]
      
      insightParams.time_range = JSON.stringify({ since, until })
      // NO agregar time_increment - la API devolverá datos agregados
      console.log(`[Meta API] Using time_range for account insights: ${insightParams.time_range} (timezone: PST/PDT, aggregated data)`)
    } else if (params?.datePreset) {
      insightParams.date_preset = params.datePreset
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

  // Normalizar nombres de acciones para agrupar variantes (onsite/offsite)
  // Esta función centraliza la lógica de normalización para que todas las funciones
  // usen la misma lógica al comparar nombres de acciones
  private normalizeActionName(name: string): string {
    return name
      .toLowerCase()
      .replace(/^(onsite_conversion|offsite_conversion)\./i, '') // Remover prefijos
      .replace(/[_\s\-\.]/g, '') // Remover guiones, espacios, puntos, guiones bajos
      .replace(/cita.?confirmada/i, 'citaconfirmada')
      .replace(/form1.?short.?completed/i, 'form1shortcompleted')
      .replace(/typeform.?submit/i, 'typeformsubmit')
      .replace(/website.?purchase/i, 'purchase')
      .replace(/link.?click/i, 'linkclick')
      .replace(/outbound.?click/i, 'linkclick')
  }

  // Agrupar variantes de acciones (onsite/offsite) en un solo registro con la suma total
  // Esta función es crítica: cuando la API devuelve datos agregados, puede incluir múltiples
  // variantes de la misma acción (ej: onsite_conversion.cita_confirmada, offsite_conversion.cita_confirmada, CITA CONFIRMADA)
  // Ads Manager muestra la SUMA TOTAL de todas estas variantes, por lo que debemos agruparlas
  private groupActionVariants(
    actions: Array<{ action_type: string; value: string }>
  ): Array<{ action_type: string; value: string }> {
    if (!actions || actions.length === 0) {
      return []
    }

    // Loggear todas las acciones ANTES de agrupar
    console.log(`[Meta API] groupActionVariants - INPUT (${actions.length} actions):`, 
      actions.map(a => `"${a.action_type}": ${a.value}`).join(', '))

    // Agrupar por nombre base normalizado
    const baseActionsMap = new Map<string, { totalValue: number; variants: Array<{ action_type: string; value: number }> }>()
    
    actions.forEach(action => {
      const value = parseInt(action.value) || 0
      if (value > 0) {
        // Normalizar para encontrar la acción base
        const baseName = this.normalizeActionName(action.action_type)
        
        console.log(`[Meta API] groupActionVariants - Processing: "${action.action_type}" (value: ${value}) -> normalized: "${baseName}"`)
        
        if (!baseActionsMap.has(baseName)) {
          baseActionsMap.set(baseName, { totalValue: 0, variants: [] })
        }
        
        const baseAction = baseActionsMap.get(baseName)!
        baseAction.totalValue += value
        baseAction.variants.push({ action_type: action.action_type, value })
        
        console.log(`[Meta API] groupActionVariants - Added to base "${baseName}": totalValue now = ${baseAction.totalValue}, variants count = ${baseAction.variants.length}`)
      }
    })
    
    // Crear array de acciones agrupadas
    const groupedActions: Array<{ action_type: string; value: string }> = []
    
    baseActionsMap.forEach(({ totalValue, variants }, baseName) => {
      // Logging detallado para diagnosticar el agrupamiento
      console.log(`[Meta API] groupActionVariants - Base "${baseName}": ${variants.length} variant(s), totalValue = ${totalValue}`)
      if (variants.length > 1) {
        console.log(`[Meta API] ⚠️ Grouped ${variants.length} variants for base "${baseName}":`, 
          variants.map(v => `"${v.action_type}"=${v.value}`).join(', '),
          `TOTAL: ${totalValue}`)
      }
      
      // Priorizar el nombre más legible (sin prefijos onsite/offsite)
      const readableVariant = variants.find(v => 
        !v.action_type.includes('onsite_conversion') && 
        !v.action_type.includes('offsite_conversion')
      )
      
      const actionType = readableVariant 
        ? readableVariant.action_type 
        : variants[0].action_type
      
      console.log(`[Meta API] groupActionVariants - Selected actionType for base "${baseName}": "${actionType}" (from ${variants.length} variants)`)
      
      groupedActions.push({
        action_type: actionType,
        value: totalValue.toString(),
      })
    })
    
    // Loggear todas las acciones DESPUÉS de agrupar
    console.log(`[Meta API] groupActionVariants - OUTPUT (${groupedActions.length} actions):`, 
      groupedActions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
    
    return groupedActions
  }

  // Agrupar variantes de cost_per_action_type y calcular promedio ponderado
  // Similar a groupActionVariants, pero para cost_per_action_type que necesita
  // calcular un promedio ponderado basado en el número de acciones de cada variante
  private groupCostPerActionVariants(
    costPerActionTypes: Array<{ action_type: string; value: string }>,
    actions: Array<{ action_type: string; value: string }>
  ): Array<{ action_type: string; value: string }> {
    if (!costPerActionTypes || costPerActionTypes.length === 0) {
      return []
    }

    // Crear mapa de acciones agrupadas para obtener conteos totales
    const actionsMap = new Map<string, number>()
    if (actions && actions.length > 0) {
      actions.forEach(a => {
        const normalized = this.normalizeActionName(a.action_type)
        const value = parseInt(a.value) || 0
        actionsMap.set(normalized, (actionsMap.get(normalized) || 0) + value)
      })
    }
    
    // Agrupar cost_per_action_type por variantes base
    const baseCostMap = new Map<string, { totalCost: number; totalActions: number; variants: Array<{ action_type: string; cost: number; actions: number }> }>()
    
    costPerActionTypes.forEach(cpa => {
      const cost = parseFloat(cpa.value) || 0
      const baseName = this.normalizeActionName(cpa.action_type)
      // Obtener el conteo de acciones correspondiente (ya agrupadas)
      const actionCount = actionsMap.get(baseName) || 0
      
      if (!baseCostMap.has(baseName)) {
        baseCostMap.set(baseName, { totalCost: 0, totalActions: 0, variants: [] })
      }
      
      const base = baseCostMap.get(baseName)!
      // Acumular costo total (costo * número de acciones)
      base.totalCost += cost * actionCount
      base.totalActions += actionCount
      base.variants.push({ action_type: cpa.action_type, cost, actions: actionCount })
    })
    
    // Calcular promedio ponderado y crear array agrupado
    const grouped: Array<{ action_type: string; value: string }> = []
    
    baseCostMap.forEach(({ totalCost, totalActions, variants }, baseName) => {
      // Calcular promedio ponderado: costo total / acciones totales
      const avgCost = totalActions > 0 ? totalCost / totalActions : 0
      
      // Usar el nombre más legible (sin prefijos onsite/offsite)
      const readableVariant = variants.find(v => 
        !v.action_type.includes('onsite_conversion') && 
        !v.action_type.includes('offsite_conversion')
      )
      
      const actionType = readableVariant 
        ? readableVariant.action_type 
        : variants[0].action_type
      
      grouped.push({
        action_type: actionType,
        value: avgCost.toFixed(4),
      })
    })
    
    return grouped
  }

  // Sumar todas las variantes de una acción base (onsite/offsite/CITA CONFIRMADA)
  // Meta puede devolver la misma acción con diferentes formatos, y Ads Manager muestra la suma total
  // IMPORTANTE: Esta función debe capturar TODAS las variantes posibles, incluyendo:
  // - onsite_conversion.cita_confirmada
  // - offsite_conversion.cita_confirmada
  // - CITA CONFIRMADA (formato legible)
  // - Cita Confirmada (variaciones de mayúsculas/minúsculas)
  private sumActionVariants(
    actions: Array<{ action_type: string; value: string }>,
    baseActionName: string
  ): { totalValue: number; variants: Array<{ action_type: string; value: number }> } {
    const variants: Array<{ action_type: string; value: number }> = []
    let totalValue = 0

    if (!actions || actions.length === 0) {
      return { totalValue: 0, variants: [] }
    }

    // Normalizar el nombre base usando el método centralizado
    const baseNormalized = this.normalizeActionName(baseActionName)
    
    // Crear patrones de búsqueda más amplios
    const searchPatterns: string[] = [baseNormalized]
    
    // Agregar variaciones específicas según el tipo de acción
    const baseLower = baseActionName.toLowerCase()
    if (baseLower.includes('cita') || baseLower.includes('confirmada')) {
      searchPatterns.push('citaconfirmada', 'cita', 'confirmada')
    }
    if (baseLower.includes('form1') || baseLower.includes('short') || baseLower.includes('completed')) {
      searchPatterns.push('form1shortcompleted', 'form1', 'shortcompleted')
    }
    if (baseLower.includes('typeform') || baseLower.includes('submit')) {
      searchPatterns.push('typeformsubmit', 'typeform')
    }
    if (baseLower.includes('purchase')) {
      searchPatterns.push('purchase', 'websitepurchase')
    }
    if (baseLower.includes('link') && baseLower.includes('click')) {
      searchPatterns.push('linkclick', 'outboundclick')
    }

    // Buscar todas las acciones que coincidan
    actions.forEach(action => {
      const actionNormalized = this.normalizeActionName(action.action_type)
      const actionLower = action.action_type.toLowerCase()

      // Verificar coincidencia con cualquiera de los patrones
      let matches = false
      for (const pattern of searchPatterns) {
        // Coincidencia exacta después de normalización
        if (actionNormalized === pattern) {
          matches = true
          break
        }
        // Coincidencia parcial (uno contiene al otro)
        if (actionNormalized.includes(pattern) || pattern.includes(actionNormalized)) {
          matches = true
          break
        }
        // Coincidencia en el nombre original (sin normalizar completamente)
        if (actionLower.includes(pattern) || pattern.includes(actionLower)) {
          matches = true
          break
        }
      }

      if (matches) {
        const value = parseInt(action.value) || 0
        if (value > 0) {
          variants.push({ action_type: action.action_type, value })
          totalValue += value
        }
      }
    })

    // Logging para debug
    if (variants.length > 1) {
      console.log(`[Meta Transform] sumActionVariants: Found ${variants.length} variants for "${baseActionName}":`, 
        variants.map(v => `"${v.action_type}"=${v.value}`).join(', '),
        `TOTAL: ${totalValue}`)
    }

    return { totalValue, variants }
  }

  // Determinar el tipo de acción principal según el objetivo de la campaña
  // AHORA SUMA TODAS LAS VARIANTES en lugar de seleccionar solo una
  // IMPORTANTE: Si las acciones ya están agrupadas (por groupActionVariants), buscar directamente
  // sin intentar sumar variantes que ya no existen
  private getPrimaryActionType(
    objective: string, 
    actions: Array<{ action_type: string; value: string }>,
    campaignName?: string
  ): {
    actionType: string | null
    value: number
    variants?: Array<{ action_type: string; value: number }>
  } {
    if (!actions || actions.length === 0) {
      return { actionType: null, value: 0 }
    }
    
    const objectiveUpper = objective.toUpperCase()
    
    // Función auxiliar para buscar acción directamente en acciones agrupadas
    // Si las acciones ya están agrupadas, no habrá variantes, así que buscamos directamente
    const findActionDirectly = (searchName: string): { action: { action_type: string; value: string } | null; normalized: string } => {
      const searchNormalized = this.normalizeActionName(searchName)
      
      // Buscar por coincidencia exacta primero
      let found = actions.find(a => {
        const aNormalized = this.normalizeActionName(a.action_type)
        return aNormalized === searchNormalized
      })
      
      // Si no encontramos, buscar por coincidencia parcial
      if (!found) {
        found = actions.find(a => {
          const aNormalized = this.normalizeActionName(a.action_type)
          return aNormalized.includes(searchNormalized) || searchNormalized.includes(aNormalized)
        })
      }
      
      return { action: found || null, normalized: searchNormalized }
    }
    
    // Para OUTCOME_LEADS: buscar y SUMAR todas las variantes de Form1_Short_Completed, TypeformSubmit, etc.
    // Prioridad: Form1_Short_Completed > TypeformSubmit > CITA CONFIRMADA (solo si es específicamente leads de citas) > otros leads
    if (objectiveUpper.includes('OUTCOME_LEADS') || objectiveUpper.includes('LEAD')) {
      console.log(`[Meta Transform] OUTCOME_LEADS: Searching for primary conversion event in ${actions.length} actions`)
      
      // 1. Form1_Short_Completed (PRIORIDAD MÁS ALTA para campañas de Leads)
      // Este es un evento del pixel de Shopify, puede aparecer con diferentes prefijos
      
      // Estrategia 1: Buscar directamente por nombre exacto (sin prefijos)
      const form1Direct = findActionDirectly('Form1_Short_Completed')
      if (form1Direct.action && parseInt(form1Direct.action.value) > 0) {
        const form1Value = parseInt(form1Direct.action.value) || 0
        console.log(`[Meta Transform] ✓ OUTCOME_LEADS: Found Form1_Short_Completed directly: "${form1Direct.action.action_type}" = ${form1Value}`)
        return {
          actionType: form1Direct.action.action_type,
          value: form1Value,
          variants: [{ action_type: form1Direct.action.action_type, value: form1Value }],
        }
      }
      
      // Estrategia 2: Buscar con prefijos del pixel de Shopify/Facebook
      // Los eventos del pixel pueden aparecer como:
      // - offsite_conversion.fb_pixel_form1_short_completed
      // - offsite_conversion.fb_pixel_Form1_Short_Completed
      // - onsite_conversion.form1_short_completed
      const form1PixelPrefixes = [
        'offsite_conversion.fb_pixel_form1_short_completed',
        'offsite_conversion.fb_pixel_Form1_Short_Completed',
        'onsite_conversion.form1_short_completed',
        'onsite_conversion.Form1_Short_Completed',
        'fb_pixel_form1_short_completed',
        'fb_pixel_Form1_Short_Completed'
      ]
      
      for (const pixelActionName of form1PixelPrefixes) {
        const pixelAction = actions.find(a => a.action_type === pixelActionName)
        if (pixelAction && parseInt(pixelAction.value) > 0) {
          const pixelValue = parseInt(pixelAction.value) || 0
          console.log(`[Meta Transform] ✓ OUTCOME_LEADS: Found Form1_Short_Completed with pixel prefix: "${pixelAction.action_type}" = ${pixelValue}`)
          return {
            actionType: pixelAction.action_type,
            value: pixelValue,
            variants: [{ action_type: pixelAction.action_type, value: pixelValue }],
          }
        }
      }
      
      // Estrategia 3: Sumar variantes usando sumActionVariants (busca variaciones de nombre)
      const form1Sum = this.sumActionVariants(actions, 'Form1_Short_Completed')
      if (form1Sum.totalValue > 0) {
        console.log(`[Meta Transform] ✓ OUTCOME_LEADS: Found Form1_Short_Completed variants (${form1Sum.variants.length}):`, 
          form1Sum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
          `TOTAL: ${form1Sum.totalValue}`)
        return {
          actionType: 'Form1_Short_Completed',
          value: form1Sum.totalValue,
          variants: form1Sum.variants,
        }
      }
      
      // Estrategia 4: Buscar variaciones comunes del nombre (con y sin prefijos del pixel)
      const form1Variations = [
        'form1_short_completed', 'form1shortcompleted', 'form1_short', 'form1short', 'form1.short.completed',
        'offsite_conversion.fb_pixel_form1_short_completed',
        'offsite_conversion.fb_pixel_form1shortcompleted',
        'offsite_conversion.fb_pixel_form1_short',
        'onsite_conversion.form1_short_completed'
      ]
      for (const variation of form1Variations) {
        const variationSum = this.sumActionVariants(actions, variation)
        if (variationSum.totalValue > 0) {
          console.log(`[Meta Transform] ✓ OUTCOME_LEADS: Found Form1 variation "${variation}" variants (${variationSum.variants.length}):`, 
            variationSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
            `TOTAL: ${variationSum.totalValue}`)
          return {
            actionType: 'Form1_Short_Completed',
            value: variationSum.totalValue,
            variants: variationSum.variants,
          }
        }
      }
      
      // Estrategia 5: Búsqueda manual exhaustiva - buscar acciones que contengan "form1" Y ("short" O "completed")
      // Esto incluye búsqueda con prefijos del pixel
      const form1Manual = actions
        .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
        .filter(a => {
          if (a.valueNum <= 0) return false
          const aLower = a.action_type.toLowerCase()
          // Buscar form1 con short o completed, incluyendo prefijos del pixel
          return (aLower.includes('form1') && (aLower.includes('short') || aLower.includes('completed')))
        })
      
      if (form1Manual.length > 0) {
        const form1ManualTotal = form1Manual.reduce((sum, a) => sum + a.valueNum, 0)
        const form1ManualVariants = form1Manual.map(a => ({ action_type: a.action_type, value: a.valueNum }))
        console.log(`[Meta Transform] ✓ OUTCOME_LEADS: Found Form1_Short_Completed by manual search (${form1Manual.length} actions):`, 
          form1ManualVariants.map(v => `"${v.action_type}"=${v.value}`).join(', '),
          `TOTAL: ${form1ManualTotal}`)
        return {
          actionType: form1Manual[0].action_type,
          value: form1ManualTotal,
          variants: form1ManualVariants,
        }
      }
      
      // Estrategia 6: Buscar en eventos custom del pixel (offsite_conversion.fb_pixel_custom)
      // A veces los eventos custom del pixel aparecen como "fb_pixel_custom" y necesitamos verificar
      // si hay algún evento que coincida con Form1_Short_Completed en los datos adicionales
      // Por ahora, solo logueamos para debug
      const fbPixelCustom = actions.find(a => 
        a.action_type === 'offsite_conversion.fb_pixel_custom' && parseInt(a.value) > 0
      )
      if (fbPixelCustom) {
        console.log(`[Meta Transform] ⚠️ OUTCOME_LEADS: Found offsite_conversion.fb_pixel_custom with value ${fbPixelCustom.value}`)
        console.log(`[Meta Transform] NOTE: Form1_Short_Completed might be inside this custom pixel event`)
        console.log(`[Meta Transform] NOTE: If this is the case, we might need the specific event name from Shopify pixel configuration`)
      }
      
      console.log(`[Meta Transform] ✗ OUTCOME_LEADS: Form1_Short_Completed not found by any method`)
      console.log(`[Meta Transform] Available actions for LEADS search (showing all with value > 0):`, 
        actions
          .filter(a => parseInt(a.value) > 0)
          .map(a => `"${a.action_type}": ${a.value}`)
          .join(', '))
      console.log(`[Meta Transform] Actions containing "form" or "lead" (for reference):`, 
        actions
          .filter(a => {
            const aLower = a.action_type.toLowerCase()
            return (aLower.includes('form') || aLower.includes('lead')) && parseInt(a.value) > 0
          })
          .map(a => `"${a.action_type}": ${a.value}`)
          .join(', '))
      
      // 2. CITA CONFIRMADA (solo si es específicamente una campaña de leads de citas)
      // Nota: Esto es raro, pero puede ocurrir si una campaña de leads también trackea citas
      const citaDirect = findActionDirectly('CITA CONFIRMADA')
      if (citaDirect.action && parseInt(citaDirect.action.value) > 0) {
        console.log(`[Meta Transform] OUTCOME_LEADS: Found CITA CONFIRMADA directly (unusual for leads): "${citaDirect.action.action_type}" = ${citaDirect.action.value}`)
        return {
          actionType: citaDirect.action.action_type,
          value: parseInt(citaDirect.action.value) || 0,
          variants: [{ action_type: citaDirect.action.action_type, value: parseInt(citaDirect.action.value) || 0 }],
        }
      }
      
      const citaSum = this.sumActionVariants(actions, 'CITA CONFIRMADA')
      if (citaSum.totalValue > 0) {
        console.log(`[Meta Transform] OUTCOME_LEADS: Found CITA CONFIRMADA variants (${citaSum.variants.length}):`, 
          citaSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
          `TOTAL: ${citaSum.totalValue}`)
        return {
          actionType: 'CITA CONFIRMADA',
          value: citaSum.totalValue,
          variants: citaSum.variants,
        }
      }
      
      // 3. TypeformSubmit
      const typeformDirect = findActionDirectly('TypeformSubmit')
      if (typeformDirect.action && parseInt(typeformDirect.action.value) > 0) {
        console.log(`[Meta Transform] OUTCOME_LEADS: Found TypeformSubmit directly: "${typeformDirect.action.action_type}" = ${typeformDirect.action.value}`)
        return {
          actionType: typeformDirect.action.action_type,
          value: parseInt(typeformDirect.action.value) || 0,
          variants: [{ action_type: typeformDirect.action.action_type, value: parseInt(typeformDirect.action.value) || 0 }],
        }
      }
      
      const typeformSum = this.sumActionVariants(actions, 'TypeformSubmit')
      if (typeformSum.totalValue > 0) {
        console.log(`[Meta Transform] OUTCOME_LEADS: Found TypeformSubmit variants (${typeformSum.variants.length}):`, 
          typeformSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
          `TOTAL: ${typeformSum.totalValue}`)
        return {
          actionType: 'TypeformSubmit',
          value: typeformSum.totalValue,
          variants: typeformSum.variants,
        }
      }
      
      // 4. Otras acciones de leads (solo si no se encontró Form1_Short_Completed ni TypeformSubmit)
      // IMPORTANTE: Excluir acciones de engagement/compras que no son conversiones reales de leads
      const excludedActionsForLeads = [
        'add_to_cart', 'purchase', 'web_in_store_purchase', 'omni_purchase',
        'onsite_web_purchase', 'offsite_conversion.fb_pixel_purchase',
        'link_click', 'landing_page_view', 'page_engagement', 'post_engagement',
        'view_content', 'video_view', 'post_reaction', 'post_comment', 'post_share',
        'like', 'comment', 'share', 'save', 'unsave',
        'omni_add_to_cart', 'onsite_web_app_add_to_cart', 'onsite_web_add_to_cart',
        'offsite_conversion.fb_pixel_add_to_cart', 'offsite_conversion.fb_pixel_view_content',
        'initiate_checkout', 'omni_initiated_checkout', 'onsite_web_initiate_checkout',
        'add_payment_info', 'offsite_conversion.fb_pixel_add_payment_info'
      ]
      
      // Buscar acciones de leads/conversiones de formularios, excluyendo engagement/compras
      const conversionKeywords = ['lead', 'form', 'submit']
      const keywordActions = actions
        .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
        .filter(a => {
          if (a.valueNum <= 0) return false
          const actionTypeLower = a.action_type.toLowerCase()
          
          // Excluir acciones de engagement/compras
          if (excludedActionsForLeads.some(excluded => actionTypeLower.includes(excluded.toLowerCase()))) {
            return false
          }
          
          // Buscar solo acciones que contengan keywords de leads/formularios
          // Y que NO sean de compras/engagement
          return conversionKeywords.some(keyword => actionTypeLower.includes(keyword)) &&
                 !actionTypeLower.includes('purchase') &&
                 !actionTypeLower.includes('cart') &&
                 !actionTypeLower.includes('checkout')
        })
        .sort((a, b) => b.valueNum - a.valueNum)
      
      if (keywordActions.length > 0) {
        // Intentar sumar variantes de la acción con mayor valor
        const topAction = keywordActions[0]
        const topActionSum = this.sumActionVariants(actions, topAction.action_type)
        if (topActionSum.totalValue > 0) {
          console.log(`[Meta Transform] ✓ OUTCOME_LEADS: Found lead action by keyword variants (${topActionSum.variants.length}):`, 
            topActionSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
            `TOTAL: ${topActionSum.totalValue}`)
          return {
            actionType: topAction.action_type,
            value: topActionSum.totalValue,
            variants: topActionSum.variants,
          }
        }
      } else {
        console.log(`[Meta Transform] ✗ OUTCOME_LEADS: No lead actions found by keywords (excluded engagement/purchase actions)`)
        console.log(`[Meta Transform] Available actions (excluding engagement/purchase):`, 
          actions
            .filter(a => {
              const aLower = a.action_type.toLowerCase()
              return !excludedActionsForLeads.some(excluded => aLower.includes(excluded.toLowerCase()))
            })
            .map(a => `"${a.action_type}": ${a.value}`)
            .join(', '))
      }
    }
    
    // Para OUTCOME_SALES: Diferenciar entre campañas de Citas y ECOM
    // - CITAS: nombre contiene "TheBundclub" o "BundClub" -> usar ID específico de CITA CONFIRMADA
    // - ECOM: resto de campañas OUTCOME_SALES -> usar "Website purchases" nativo
    if (objectiveUpper.includes('OUTCOME_SALES') || objectiveUpper.includes('SALES') || objectiveUpper.includes('PURCHASE')) {
      // Detectar si es campaña de Citas basándose en el nombre
      const campaignNameUpper = campaignName?.toUpperCase() || ''
      const isCitasCampaign = campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('BUNDCLUB')
      
      // Función auxiliar mejorada para buscar directamente con múltiples estrategias
      const findActionDirectly = (searchName: string): { action: { action_type: string; value: string } | null; normalized: string; searchMethods: string[] } => {
        const searchNormalized = this.normalizeActionName(searchName)
        const searchMethods: string[] = []
        let found: { action_type: string; value: string } | null = null
        
        // Estrategia 1: Coincidencia exacta después de normalización
        found = actions.find(a => {
          const aNormalized = this.normalizeActionName(a.action_type)
          return aNormalized === searchNormalized
        }) || null
        if (found) {
          searchMethods.push('exact-normalized')
          console.log(`[Meta Transform] findActionDirectly: Found "${searchName}" by exact normalized match: "${found.action_type}"`)
          return { action: found, normalized: searchNormalized, searchMethods }
        }
        
        // Estrategia 2: Coincidencia parcial (uno contiene al otro)
        found = actions.find(a => {
          const aNormalized = this.normalizeActionName(a.action_type)
          return aNormalized.includes(searchNormalized) || searchNormalized.includes(aNormalized)
        }) || null
        if (found) {
          searchMethods.push('partial-normalized')
          console.log(`[Meta Transform] findActionDirectly: Found "${searchName}" by partial normalized match: "${found.action_type}"`)
          return { action: found, normalized: searchNormalized, searchMethods }
        }
        
        // Estrategia 3: Búsqueda por palabras clave (para CITA CONFIRMADA)
        if (searchName.toLowerCase().includes('cita') && searchName.toLowerCase().includes('confirmada')) {
          found = actions.find(a => {
            const aLower = a.action_type.toLowerCase()
            return (aLower.includes('cita') && aLower.includes('confirmada'))
          }) || null
          if (found) {
            searchMethods.push('keyword-cita-confirmada')
            console.log(`[Meta Transform] findActionDirectly: Found "${searchName}" by keyword match (cita+confirmada): "${found.action_type}"`)
            return { action: found, normalized: searchNormalized, searchMethods }
          }
        }
        
        // Estrategia 4: Búsqueda por nombre exacto (case-insensitive)
        const searchLower = searchName.toLowerCase()
        found = actions.find(a => a.action_type.toLowerCase() === searchLower) || null
        if (found) {
          searchMethods.push('exact-case-insensitive')
          console.log(`[Meta Transform] findActionDirectly: Found "${searchName}" by exact case-insensitive match: "${found.action_type}"`)
          return { action: found, normalized: searchNormalized, searchMethods }
        }
        
        // Estrategia 5: Búsqueda por nombre parcial (case-insensitive)
        found = actions.find(a => {
          const aLower = a.action_type.toLowerCase()
          return aLower.includes(searchLower) || searchLower.includes(aLower)
        }) || null
        if (found) {
          searchMethods.push('partial-case-insensitive')
          console.log(`[Meta Transform] findActionDirectly: Found "${searchName}" by partial case-insensitive match: "${found.action_type}"`)
          return { action: found, normalized: searchNormalized, searchMethods }
        }
        
        console.log(`[Meta Transform] findActionDirectly: NOT FOUND "${searchName}" (normalized: "${searchNormalized}") after ${searchMethods.length} strategies`)
        console.log(`[Meta Transform] findActionDirectly: Available actions:`, actions.map(a => `"${a.action_type}" (normalized: "${this.normalizeActionName(a.action_type)}")`).join(', '))
        return { action: null, normalized: searchNormalized, searchMethods }
      }
      
      // Diferenciar lógica según tipo de campaña
      if (isCitasCampaign) {
        // ========== LÓGICA PARA CAMPAÑAS DE CITAS ==========
        console.log(`[Meta Transform] OUTCOME_SALES (CITAS): Searching for CITA CONFIRMADA in ${actions.length} actions`)
        
        // 1. Buscar directamente por nombre
        const citaDirect = findActionDirectly('CITA CONFIRMADA')
        if (citaDirect.action && parseInt(citaDirect.action.value) > 0) {
          console.log(`[Meta Transform] ✓ OUTCOME_SALES (CITAS): Found CITA CONFIRMADA directly: "${citaDirect.action.action_type}" = ${citaDirect.action.value}`)
          return {
            actionType: citaDirect.action.action_type,
            value: parseInt(citaDirect.action.value) || 0,
            variants: [{ action_type: citaDirect.action.action_type, value: parseInt(citaDirect.action.value) || 0 }],
          }
        }
        
        // 2. Sumar variantes por nombre
        const citaSum = this.sumActionVariants(actions, 'CITA CONFIRMADA')
        if (citaSum.totalValue > 0) {
          console.log(`[Meta Transform] ✓ OUTCOME_SALES (CITAS): Found CITA CONFIRMADA variants (${citaSum.variants.length}):`, 
            citaSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
            `TOTAL: ${citaSum.totalValue}`)
          return {
            actionType: 'CITA CONFIRMADA',
            value: citaSum.totalValue,
            variants: citaSum.variants,
          }
        }
        
        // 3. Buscar manualmente por palabras clave
        const citaRelatedActions = actions
          .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
          .filter(a => {
            if (a.valueNum <= 0) return false
            const aLower = a.action_type.toLowerCase()
            return (aLower.includes('cita') && aLower.includes('confirmada'))
          })
        
        if (citaRelatedActions.length > 0) {
          const totalCitaValue = citaRelatedActions.reduce((sum, a) => sum + a.valueNum, 0)
          const citaVariants = citaRelatedActions.map(a => ({ action_type: a.action_type, value: a.valueNum }))
          const readableAction = citaRelatedActions.find(a => 
            !a.action_type.includes('onsite_conversion') && 
            !a.action_type.includes('offsite_conversion')
          )
          const actionType = readableAction ? readableAction.action_type : citaRelatedActions[0].action_type
          
          console.log(`[Meta Transform] ✓ OUTCOME_SALES (CITAS): Found CITA CONFIRMADA by keyword (${citaRelatedActions.length} actions):`, 
            citaVariants.map(v => `"${v.action_type}"=${v.value}`).join(', '),
            `TOTAL: ${totalCitaValue}`)
          
          return {
            actionType: actionType,
            value: totalCitaValue,
            variants: citaVariants,
          }
        }
        
        // 4. Buscar por ID específico (PRIORIDAD para Citas)
        const citaById = actions.find(a => a.action_type === CITA_CONFIRMADA_ACTION_TYPE)
        if (citaById && parseInt(citaById.value) > 0) {
          const citaValue = parseInt(citaById.value) || 0
          console.log(`[Meta Transform] ✓ OUTCOME_SALES (CITAS): Found CITA CONFIRMADA by specific ID (${CITA_CONFIRMADA_CUSTOM_ID}): ${citaValue}`)
          return {
            actionType: CITA_CONFIRMADA_ACTION_TYPE,
            value: citaValue,
            variants: [{ action_type: citaById.action_type, value: citaValue }],
          }
        }
        
        console.log(`[Meta Transform] ✗ OUTCOME_SALES (CITAS): CITA CONFIRMADA not found by any method`)
      } else {
        // ========== LÓGICA PARA CAMPAÑAS ECOM ==========
        console.log(`[Meta Transform] OUTCOME_SALES (ECOM): Searching for Website purchases in ${actions.length} actions`)
        
        // Para ECOM, buscar directamente "Website purchases" / "purchase" (evento nativo)
        // NO buscar CITA CONFIRMADA
      }
      
      // Buscar y SUMAR todas las variantes de Website purchases (para ECOM o como fallback de Citas)
      const purchaseDirect = findActionDirectly('Website purchases')
      if (purchaseDirect.action && parseInt(purchaseDirect.action.value) > 0) {
        console.log(`[Meta Transform] OUTCOME_SALES: Found Website purchases directly: "${purchaseDirect.action.action_type}" = ${purchaseDirect.action.value}`)
        return {
          actionType: purchaseDirect.action.action_type,
          value: parseInt(purchaseDirect.action.value) || 0,
          variants: [{ action_type: purchaseDirect.action.action_type, value: parseInt(purchaseDirect.action.value) || 0 }],
        }
      }
      
      const purchaseSum = this.sumActionVariants(actions, 'Website purchases')
      if (purchaseSum.totalValue > 0) {
        console.log(`[Meta Transform] OUTCOME_SALES: Found Website purchases variants (${purchaseSum.variants.length}):`, 
          purchaseSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
          `TOTAL: ${purchaseSum.totalValue}`)
        return {
          actionType: 'Website purchases',
          value: purchaseSum.totalValue,
          variants: purchaseSum.variants,
        }
      }
      
      // Buscar por patrón de purchase como fallback
      const purchasePattern = /purchase/i
      const purchaseActions = actions
        .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
        .filter(a => a.valueNum > 0 && purchasePattern.test(a.action_type))
      
      if (purchaseActions.length > 0) {
        // Sumar todas las variantes de purchase
        const purchaseSumFallback = this.sumActionVariants(actions, purchaseActions[0].action_type)
        if (purchaseSumFallback.totalValue > 0) {
          console.log(`[Meta Transform] OUTCOME_SALES: Found purchase variants by pattern (${purchaseSumFallback.variants.length}):`, 
            purchaseSumFallback.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
            `TOTAL: ${purchaseSumFallback.totalValue}`)
          return {
            actionType: purchaseActions[0].action_type,
            value: purchaseSumFallback.totalValue,
            variants: purchaseSumFallback.variants,
          }
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
    
    // Si encontramos acciones de conversión, sumar variantes de la de mayor valor
    if (conversionActions.length > 0) {
      const topConversionAction = conversionActions[0]
      const conversionSum = this.sumActionVariants(actions, topConversionAction.action_type)
      if (conversionSum.totalValue > 0) {
        console.log(`[Meta Transform] Using conversion action variants (fallback) (${conversionSum.variants.length}):`, 
          conversionSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
          `TOTAL: ${conversionSum.totalValue}`)
        return {
          actionType: topConversionAction.action_type,
          value: conversionSum.totalValue,
          variants: conversionSum.variants,
        }
      }
    }
    
    // Último recurso: usar cualquier acción con valor > 0 (pero loguear advertencia)
    const anyAction = actions
      .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
      .filter(a => a.valueNum > 0)
      .sort((a, b) => b.valueNum - a.valueNum)[0]
    
    if (anyAction) {
      // Intentar sumar variantes incluso para acciones no-conversión
      const anyActionSum = this.sumActionVariants(actions, anyAction.action_type)
      console.warn(`[Meta Transform] Using non-conversion action as fallback (${anyActionSum.variants.length} variants):`, 
        anyActionSum.variants.map(v => `${v.action_type}=${v.value}`).join(', '),
        `TOTAL: ${anyActionSum.totalValue}`)
      return {
        actionType: anyAction.action_type,
        value: anyActionSum.totalValue,
        variants: anyActionSum.variants,
      }
    }
    
    return { actionType: null, value: 0, variants: [] }
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
      outbound_clicks?: string
      date_start?: string
    }
  ): Omit<MetaCampaign, 'id'> {
    // Asegurar que todos los valores numéricos tengan defaults seguros
    const spend = insights?.spend ? parseFloat(insights.spend) || 0 : 0
    const impressions = insights?.impressions ? parseInt(insights.impressions) || 0 : 0
    const clicks = insights?.clicks ? parseInt(insights.clicks) || 0 : 0
    const reach = insights?.reach ? parseInt(insights.reach) || 0 : 0
    
    // Link Clicks: Ads Manager muestra "Link Clicks" que corresponde a clics en enlaces
    // Estrategia de búsqueda mejorada:
    // 1. Buscar outbound_clicks (si existe y tiene valor > 0) - PRIORIDAD MÁS ALTA
    // 2. Buscar y SUMAR todas las variantes de link_click en actions (incluyendo outbound_click)
    // 3. Buscar específicamente outbound_click en actions si link_click no se encuentra
    // 4. Fallback a clicks (aunque incluye otros tipos de clics)
    let link_clicks = 0
    if (insights?.outbound_clicks && parseInt(insights.outbound_clicks) > 0) {
      link_clicks = parseInt(insights.outbound_clicks) || 0
      console.log(`[Meta Transform] ✓ Using outbound_clicks field for link_clicks: ${link_clicks}`)
    } else if (insights?.actions) {
      // Buscar y SUMAR todas las variantes de link_click en actions
      const linkClickSum = this.sumActionVariants(insights.actions, 'link_click')
      if (linkClickSum.totalValue > 0) {
        link_clicks = linkClickSum.totalValue
        console.log(`[Meta Transform] ✓ Found link_click variants in actions (${linkClickSum.variants.length}):`, 
          linkClickSum.variants.map(v => `"${v.action_type}"=${v.value}`).join(', '),
          `TOTAL: ${link_clicks}`)
      } else {
        // Buscar también "outbound_click" específicamente
        const outboundSum = this.sumActionVariants(insights.actions, 'outbound_click')
        if (outboundSum.totalValue > 0) {
          link_clicks = outboundSum.totalValue
          console.log(`[Meta Transform] ✓ Found outbound_click variants in actions (${outboundSum.variants.length}):`, 
            outboundSum.variants.map(v => `"${v.action_type}"=${v.value}`).join(', '),
            `TOTAL: ${link_clicks}`)
        } else {
          // Buscar también "link click" (con espacio) y otras variantes manualmente
          const linkClickActions = insights.actions.filter(a => {
            const actionType = a.action_type.toLowerCase()
            return (actionType.includes('link') && actionType.includes('click')) || 
                   actionType.includes('outbound')
          })
          
          if (linkClickActions.length > 0) {
            link_clicks = linkClickActions.reduce((sum, a) => sum + (parseInt(a.value) || 0), 0)
            console.log(`[Meta Transform] ✓ Found link-related actions manually:`, 
              linkClickActions.map(a => `"${a.action_type}"=${a.value}`).join(', '),
              `TOTAL: ${link_clicks}`)
          } else {
            // Fallback a clicks (no ideal pero mejor que 0)
            link_clicks = insights?.clicks ? parseInt(insights.clicks) || 0 : 0
            console.log(`[Meta Transform] ⚠️ No link_click found in actions, using clicks as fallback: ${link_clicks}`)
          }
        }
      }
    } else {
      // Último recurso: usar clicks
      link_clicks = insights?.clicks ? parseInt(insights.clicks) || 0 : 0
      console.log(`[Meta Transform] ⚠️ No actions available, using clicks as fallback: ${link_clicks}`)
    }
    
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
    
    // Determinar el resultado principal (Results) - Ads Manager muestra la acción principal de conversión
    // Estrategia mejorada: buscar la acción con mayor valor que sea de conversión
    // Primero intentar con getPrimaryActionType (lógica basada en objetivo)
    // Pasar el nombre de la campaña para diferenciar entre Citas y ECOM
    let primaryResult = this.getPrimaryActionType(effectiveObjective, actions, campaign.name)
    
    // Si getPrimaryActionType no encuentra nada o encuentra una acción con valor 0,
    // buscar la acción de conversión con mayor valor directamente en las acciones
    if (!primaryResult.actionType || primaryResult.value === 0) {
      console.log(`[Meta Transform] getPrimaryActionType didn't find valid result, searching for highest conversion action`)
      
      // Excluir acciones de engagement
      const engagementActions = [
        'link_click', 'landing_page_view', 'post_engagement', 'page_engagement',
        'post_reaction', 'post_comment', 'post_share', 'video_view', 'video_play',
        'photo_view', 'onsite_conversion.web_site_visit', 'offsite_conversion.web_site_visit',
        'clicks', 'impressions', 'outbound_click'
      ]
      
      // Filtrar acciones de conversión (excluir engagement) y ordenar por valor descendente
      const conversionActions = actions
        .map(a => ({ ...a, valueNum: parseInt(a.value) || 0 }))
        .filter(a => {
          if (a.valueNum <= 0) return false
          const actionTypeLower = a.action_type.toLowerCase()
          // Excluir acciones de engagement
          return !engagementActions.some(engagement => actionTypeLower.includes(engagement.toLowerCase()))
        })
        .sort((a, b) => b.valueNum - a.valueNum)
      
      if (conversionActions.length > 0) {
        // Usar el valor directamente de la acción encontrada
        const selectedAction = conversionActions[0]
        primaryResult = {
          actionType: selectedAction.action_type,
          value: selectedAction.valueNum, // Asegurar que usamos el valor numérico correcto
          variants: [{ action_type: selectedAction.action_type, value: selectedAction.valueNum }],
        }
        console.log(`[Meta Transform] ✓ Selected highest conversion action as Results: "${primaryResult.actionType}" = ${primaryResult.value}`)
      } else {
        // Si no encontramos ninguna acción de conversión, asegurar que value sea 0
        primaryResult = {
          actionType: null,
          value: 0,
          variants: [],
        }
        console.log(`[Meta Transform] ⚠️ No conversion actions found, Results will be 0`)
      }
    }
    
    // Asegurar que primaryResult.value siempre sea un número válido
    if (!primaryResult || typeof primaryResult.value !== 'number' || isNaN(primaryResult.value)) {
      console.warn(`[Meta Transform] ⚠️ Invalid primaryResult.value, setting to 0`)
      primaryResult = {
        actionType: primaryResult?.actionType || null,
        value: 0,
        variants: primaryResult?.variants || [],
      }
    }
    
    // Log detallado para debug y comparación con Ads Manager
    // Este logging es CRÍTICO para diagnosticar diferencias entre Madrid (que funciona) y otras campañas
    if (actions.length > 0) {
      console.log(`[Meta Transform] ========== RESULTS SELECTION for ${campaign.name} ==========`)
      console.log(`[Meta Transform] Campaign: ${campaign.name}`)
      console.log(`[Meta Transform] Objective: ${campaign.objective} (effective: ${effectiveObjective})`)
      console.log(`[Meta Transform] Total actions received: ${actions.length}`)
      console.log(`[Meta Transform] ALL Available actions (${actions.length}):`, actions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
      
      // Análisis específico para campañas de Citas (THEBUNDCLUB)
      if (campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('BUNDCLUB')) {
        console.log(`[Meta Transform] ========== CITAS CAMPAIGN ANALYSIS ==========`)
        
        // Buscar específicamente el ID de CITA CONFIRMADA
        const citaById = actions.find(a => a.action_type === CITA_CONFIRMADA_ACTION_TYPE)
        if (citaById) {
          const citaValue = parseInt(citaById.value) || 0
          console.log(`[Meta Transform] CITA CONFIRMADA by ID (${CITA_CONFIRMADA_CUSTOM_ID}): ${citaValue}`)
          console.log(`[Meta Transform] Primary result value: ${primaryResult.value}`)
          if (citaValue !== primaryResult.value) {
            console.log(`[Meta Transform] ⚠️⚠️⚠️ DISCREPANCY: CITA ID value (${citaValue}) != Primary result (${primaryResult.value}), difference: ${Math.abs(citaValue - primaryResult.value)}`)
          } else {
            console.log(`[Meta Transform] ✓ CITA ID value matches primary result`)
          }
        } else {
          console.log(`[Meta Transform] ⚠️ CITA CONFIRMADA ID (${CITA_CONFIRMADA_CUSTOM_ID}) not found in actions!`)
        }
        
        // También buscar por nombre para logging adicional
        const citaActions = actions.filter(a => {
          const aLower = a.action_type.toLowerCase()
          return (aLower.includes('cita') || aLower.includes('confirmada')) && a.action_type !== CITA_CONFIRMADA_ACTION_TYPE
        })
        if (citaActions.length > 0) {
          console.log(`[Meta Transform] Other CITA-related actions found (${citaActions.length}):`, citaActions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
        }
        
        console.log(`[Meta Transform] ==============================================`)
      }
      
      // Análisis específico para campañas de LEADS
      if (effectiveObjective.includes('OUTCOME_LEADS') || effectiveObjective.includes('LEAD') || campaignNameUpper.includes('LEADS')) {
        console.log(`[Meta Transform] ========== LEADS CAMPAIGN ANALYSIS ==========`)
        
        // Buscar Form1_Short_Completed
        const form1Actions = actions.filter(a => {
          const aLower = a.action_type.toLowerCase()
          return (aLower.includes('form1') && (aLower.includes('short') || aLower.includes('completed')))
        })
        if (form1Actions.length > 0) {
          const form1Total = form1Actions.reduce((sum, a) => sum + (parseInt(a.value) || 0), 0)
          console.log(`[Meta Transform] Form1_Short_Completed actions found (${form1Actions.length}):`, form1Actions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
          console.log(`[Meta Transform] Form1_Short_Completed TOTAL (manual sum): ${form1Total}`)
          console.log(`[Meta Transform] Primary result value: ${primaryResult.value}`)
          if (form1Total !== primaryResult.value) {
            console.log(`[Meta Transform] ⚠️⚠️⚠️ DISCREPANCY: Form1 sum (${form1Total}) != Primary result (${primaryResult.value}), difference: ${Math.abs(form1Total - primaryResult.value)}`)
          } else {
            console.log(`[Meta Transform] ✓ Form1 sum matches primary result`)
          }
        } else {
          console.log(`[Meta Transform] ⚠️ Form1_Short_Completed not found in actions!`)
        }
        
        // Buscar TypeformSubmit
        const typeformActions = actions.filter(a => {
          const aLower = a.action_type.toLowerCase()
          return aLower.includes('typeform') || aLower.includes('typeformsubmit')
        })
        if (typeformActions.length > 0) {
          console.log(`[Meta Transform] TypeformSubmit actions found (${typeformActions.length}):`, typeformActions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
        }
        
        // Buscar acciones custom que podrían ser Form1_Short_Completed
        const customActions = actions.filter(a => {
          return a.action_type.includes('custom.') && 
                 (a.action_type.includes('offsite_conversion.custom.') || 
                  a.action_type.includes('onsite_conversion.custom.'))
        })
        if (customActions.length > 0) {
          console.log(`[Meta Transform] Custom conversion actions found (${customActions.length}):`, customActions.map(a => `"${a.action_type}": ${a.value}`).join(', '))
          console.log(`[Meta Transform] NOTE: Form1_Short_Completed might be in one of these custom conversions`)
        }
        
        // Mostrar acciones excluidas (engagement/compras) para referencia
        const excludedActions = [
          'add_to_cart', 'purchase', 'web_in_store_purchase', 'omni_purchase',
          'link_click', 'landing_page_view', 'page_engagement'
        ]
        const excludedFound = actions.filter(a => {
          const aLower = a.action_type.toLowerCase()
          return excludedActions.some(excluded => aLower.includes(excluded.toLowerCase())) && parseInt(a.value) > 0
        })
        if (excludedFound.length > 0) {
          console.log(`[Meta Transform] Excluded actions (engagement/purchase) found (${excludedFound.length}):`, excludedFound.map(a => `"${a.action_type}": ${a.value}`).join(', '))
          console.log(`[Meta Transform] NOTE: These actions are excluded from LEADS search to avoid false matches`)
        }
        
        console.log(`[Meta Transform] ==============================================`)
      }
      
      console.log(`[Meta Transform] Selected Primary result (Results): "${primaryResult.actionType}" = ${primaryResult.value}`)
      if (primaryResult.variants && primaryResult.variants.length > 0) {
        console.log(`[Meta Transform] Variants summed (${primaryResult.variants.length}):`, primaryResult.variants.map(v => `"${v.action_type}": ${v.value}`).join(', '))
        const variantsTotal = primaryResult.variants.reduce((sum, v) => sum + v.value, 0)
        console.log(`[Meta Transform] Variants total: ${variantsTotal}, Primary result value: ${primaryResult.value}`)
        if (variantsTotal !== primaryResult.value) {
          console.log(`[Meta Transform] ⚠️ Variants total (${variantsTotal}) != Primary result (${primaryResult.value})`)
        }
      } else {
        console.log(`[Meta Transform] No variants found for primary result`)
      }
      
      if (insights?.cost_per_action_type && insights.cost_per_action_type.length > 0) {
        console.log(`[Meta Transform] ALL Available cost_per_action_type (${insights.cost_per_action_type.length}):`, insights.cost_per_action_type.map(cpa => `"${cpa.action_type}": ${cpa.value}`).join(', '))
      } else {
        console.log(`[Meta Transform] No cost_per_action_type available`)
      }
      console.log(`[Meta Transform] =========================================================`)
    }
    
    // Calcular conversiones totales desde actions (para compatibilidad)
    const totalConversions = actions.reduce((sum, action) => {
      return sum + (parseInt(action.value) || 0)
    }, 0)
    
    // Usar el resultado principal como "conversions" (lo que Meta muestra como "Results")
    // Asegurar que siempre sea un número válido y no negativo
    const primaryConversions = Math.max(0, primaryResult.value || 0)
    
    // Log final para verificar que el valor es correcto
    if (primaryConversions !== primaryResult.value) {
      console.warn(`[Meta Transform] ⚠️ primaryConversions adjusted from ${primaryResult.value} to ${primaryConversions}`)
    }
    
    // Logging comparativo específico para campañas de Citas
    if (campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('BUNDCLUB')) {
      console.log(`[Meta Transform] ========== FINAL RESULTS CHECK for ${campaign.name} ==========`)
      console.log(`[Meta Transform] Primary Action Type: "${primaryResult.actionType}"`)
      console.log(`[Meta Transform] Primary Conversions (Results): ${primaryConversions}`)
      console.log(`[Meta Transform] Spend: ${spend.toFixed(2)}`)
      if (primaryConversions > 0) {
        const expectedCostPerResult = spend / primaryConversions
        console.log(`[Meta Transform] Expected Cost per Result (spend/results): ${expectedCostPerResult.toFixed(2)}`)
      }
      console.log(`[Meta Transform] =========================================================`)
    }
    
    const cpm = insights?.cpm ? parseFloat(insights.cpm) || 0 : 0
    const cpc = insights?.cpc ? parseFloat(insights.cpc) || 0 : 0
    const ctr = insights?.ctr ? parseFloat(insights.ctr) || 0 : 0
    
    // Calcular cost_per_result basado en el resultado principal
    // IMPORTANTE: Ads Manager muestra "Cost per Result = Spend / Results"
    // Por lo tanto, SIEMPRE priorizamos el cálculo manual sobre cost_per_action_type
    // Solo usamos cost_per_action_type si el cálculo manual no es posible
    
    let cost_per_result = 0
    
    // PRIORIDAD 1: Calcular manualmente (spend / results) - esto es lo que Ads Manager muestra
    if (primaryConversions > 0 && spend > 0) {
      cost_per_result = spend / primaryConversions
      console.log(`[Meta Transform] ✓ Calculated cost_per_result manually (PRIORITY): ${spend.toFixed(2)} / ${primaryConversions} = ${cost_per_result.toFixed(2)}`)
    } else if (primaryConversions === 0) {
      cost_per_result = 0
      console.log(`[Meta Transform] No cost_per_result: primaryConversions=${primaryConversions}, spend=${spend.toFixed(2)}`)
    }
    
    // PRIORIDAD 2: Intentar encontrar en cost_per_action_type usando normalización (solo para validación/logging)
    // Esto nos ayuda a verificar si hay discrepancias, pero NO lo usamos como valor principal
    if (primaryResult.actionType && insights?.cost_per_action_type && insights.cost_per_action_type.length > 0) {
      const primaryActionType = primaryResult.actionType
      
      // Si el primaryActionType es el ID específico de CITA CONFIRMADA, buscar directamente por ID
      // antes de intentar normalización (más preciso y consistente)
      let matchingCostPerAction = null
      if (primaryActionType === CITA_CONFIRMADA_ACTION_TYPE) {
        matchingCostPerAction = insights.cost_per_action_type.find(cpa => cpa.action_type === CITA_CONFIRMADA_ACTION_TYPE)
        if (matchingCostPerAction) {
          console.log(`[Meta Transform] Found cost_per_action_type for CITA CONFIRMADA by exact ID match`)
        }
      }
      
      // Si no encontramos por ID exacto, intentar normalización
      if (!matchingCostPerAction) {
        const primaryActionNormalized = this.normalizeActionName(primaryActionType)
        matchingCostPerAction = insights.cost_per_action_type.find(cpa => {
          const cpaNormalized = this.normalizeActionName(cpa.action_type)
          return cpaNormalized === primaryActionNormalized
        })
      }
      
      if (matchingCostPerAction) {
        const cpaValue = parseFloat(matchingCostPerAction.value) || 0
        if (cpaValue > 0) {
          // Comparar con el cálculo manual para logging
          if (cost_per_result > 0) {
            const diff = Math.abs(cost_per_result - cpaValue)
            const diffPercent = (diff / cost_per_result) * 100
            console.log(`[Meta Transform] Found cost_per_action_type for "${primaryActionType}": ${cpaValue.toFixed(2)} (matched: "${matchingCostPerAction.action_type}")`)
            console.log(`[Meta Transform] Manual calculation: ${cost_per_result.toFixed(2)}, cost_per_action_type: ${cpaValue.toFixed(2)} (diff: ${diff.toFixed(2)}, ${diffPercent.toFixed(1)}%) - using manual calculation`)
          } else {
            // Si no pudimos calcular manualmente, usar cost_per_action_type como fallback
            cost_per_result = cpaValue
            console.log(`[Meta Transform] ✓ Using cost_per_action_type as fallback: ${cost_per_result.toFixed(2)}`)
          }
        }
      } else {
        const primaryActionNormalized = this.normalizeActionName(primaryActionType)
        console.log(`[Meta Transform] ✗ No cost_per_action_type found for "${primaryActionType}" (normalized: "${primaryActionNormalized}")`)
        console.log(`[Meta Transform] Available cost_per_action_type:`, insights.cost_per_action_type.map(cpa => `"${cpa.action_type}" (normalized: "${this.normalizeActionName(cpa.action_type)}"): ${cpa.value}`).join(', '))
      }
    }
    
    // Log final resumen de métricas clave
    console.log(`[Meta Transform] ========== FINAL METRICS for ${campaign.name} ==========`)
    console.log(`[Meta Transform] Results: ${primaryConversions} (${primaryResult.actionType || 'N/A'})`)
    console.log(`[Meta Transform] Cost per Result: ${cost_per_result.toFixed(2)}`)
    console.log(`[Meta Transform] Link Clicks: ${link_clicks}`)
    console.log(`[Meta Transform] Spend: ${spend.toFixed(2)}`)
    console.log(`[Meta Transform] =========================================================`)
    
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

  if (error || !data || !(data as any).connected) {
    return null
  }

  const { access_token, ad_account_id } = (data as any).settings as {
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

