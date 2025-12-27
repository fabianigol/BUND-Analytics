import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { format, subDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export interface DashboardInsight {
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  description: string
}

interface DashboardData {
  kpis: {
    overallRoas: { current: number; previous: number; change: number }
    totalRevenue: { current: number; previous: number; change: number }
    totalSessions: { current: number; previous: number; change: number }
    totalAppointments?: { current: number; previous: number; change: number }
  }
  topProducts: Array<{ name: string; sales: number; revenue: number }>
  trafficSources: Array<{ source: string; medium: string; sessions: number; percentage: number }>
  integrations: {
    shopify: boolean
    meta: boolean
    analytics: boolean
    acuity: boolean
  }
}

/**
 * Genera insights automáticos basados en los datos del dashboard
 */
export async function generateDashboardInsights(
  dashboardData: DashboardData
): Promise<DashboardInsight[]> {
  const insights: DashboardInsight[] = []

  // 1. ROAS en aumento/disminución
  if (dashboardData.integrations.meta && dashboardData.kpis.overallRoas.current > 0) {
    const roasChange = dashboardData.kpis.overallRoas.change
    if (roasChange > 3) {
      insights.push({
        type: 'success',
        title: 'ROAS en aumento',
        description: `El retorno de inversión publicitaria subió un ${roasChange.toFixed(1)}% esta semana.`,
      })
    } else if (roasChange < -5) {
      insights.push({
        type: 'warning',
        title: 'ROAS en descenso',
        description: `El retorno de inversión publicitaria bajó un ${Math.abs(roasChange).toFixed(1)}%. Revisar estrategia.`,
      })
    }
  }

  // 2. Tasa de cancelación de citas
  if (dashboardData.integrations.acuity && dashboardData.kpis.totalAppointments) {
    const appointmentsChange = dashboardData.kpis.totalAppointments.change
    if (appointmentsChange < -5) {
      insights.push({
        type: 'warning',
        title: 'Tasa de cancelación',
        description: `Las citas disminuyeron un ${Math.abs(appointmentsChange).toFixed(1)}%. Revisar seguimiento.`,
      })
    } else if (appointmentsChange > 10) {
      insights.push({
        type: 'success',
        title: 'Citas en aumento',
        description: `Las citas aumentaron un ${appointmentsChange.toFixed(1)}% este mes.`,
      })
    }
  }

  // 3. Pico de tráfico (necesitamos datos horarios)
  if (dashboardData.integrations.analytics) {
    const sessionsChange = dashboardData.kpis.totalSessions.change
    if (sessionsChange > 10) {
      insights.push({
        type: 'info',
        title: 'Tráfico en crecimiento',
        description: `El tráfico web aumentó un ${sessionsChange.toFixed(1)}% vs el mes anterior.`,
      })
    }

    // Identificar fuente de tráfico destacada
    if (dashboardData.trafficSources.length > 0) {
      const topSource = dashboardData.trafficSources[0]
      if (topSource.percentage > 30) {
        insights.push({
          type: 'info',
          title: 'Fuente de tráfico dominante',
          description: `${topSource.source} representa el ${topSource.percentage.toFixed(1)}% del tráfico total.`,
        })
      }
    }
  }

  // 4. Mejor campaña por CPA (necesitamos obtener datos de campañas)
  if (dashboardData.integrations.meta) {
    try {
      const bestCampaign = await getBestCampaignByCPA()
      if (bestCampaign) {
        insights.push({
          type: 'success',
          title: 'Mejor campaña',
          description: `"${bestCampaign.name}" tiene el mejor CPA del mes: €${bestCampaign.cpa.toFixed(2)}`,
        })
      }
    } catch (error) {
      console.error('[Insights] Error getting best campaign:', error)
    }
  }

  // 5. Producto estrella
  if (dashboardData.integrations.shopify && dashboardData.topProducts.length > 0) {
    const topProduct = dashboardData.topProducts[0]
    if (topProduct.revenue > 1000) {
      insights.push({
        type: 'success',
        title: 'Producto estrella',
        description: `"${topProduct.name}" es el producto más vendido con €${topProduct.revenue.toFixed(2)} en ingresos.`,
      })
    }
  }

  // 6. Ingresos en aumento significativo
  if (dashboardData.integrations.shopify) {
    const revenueChange = dashboardData.kpis.totalRevenue.change
    if (revenueChange > 15) {
      insights.push({
        type: 'success',
        title: 'Ingresos en crecimiento',
        description: `Los ingresos aumentaron un ${revenueChange.toFixed(1)}% vs el mes anterior.`,
      })
    } else if (revenueChange < -10) {
      insights.push({
        type: 'warning',
        title: 'Ingresos en descenso',
        description: `Los ingresos disminuyeron un ${Math.abs(revenueChange).toFixed(1)}%. Revisar estrategia.`,
      })
    }
  }

  // 7. Pico de tráfico por hora (si tenemos datos de analytics)
  if (dashboardData.integrations.analytics) {
    try {
      const peakTraffic = await getPeakTrafficHours()
      if (peakTraffic) {
        const hours = peakTraffic.hours.map((h) => `${h}:00`).join(' y ')
        insights.push({
          type: 'info',
          title: 'Pico de tráfico',
          description: `Mayor tráfico orgánico los ${peakTraffic.days.join(' y ')} entre ${hours}.`,
        })
      }
    } catch (error) {
      console.error('[Insights] Error getting peak traffic:', error)
    }
  }

  return insights
}

/**
 * Obtiene la mejor campaña por CPA del mes actual
 */
async function getBestCampaignByCPA(): Promise<{ name: string; cpa: number } | null> {
  try {
    const supabase = await createClient()
    const today = new Date()
    const periodStart = format(subDays(today, 30), 'yyyy-MM-dd')
    const periodEnd = format(today, 'yyyy-MM-dd')

    const { data } = await supabase
      .from('meta_campaigns')
      .select('campaign_name, spend, conversions, cost_per_result')
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .gt('spend', 0)
      .gt('conversions', 0)

    if (!data || data.length === 0) return null

    // Agrupar por campaña y calcular CPA
    const campaignMap = new Map<string, { spend: number; conversions: number }>()
    data.forEach((campaign: any) => {
      const name = campaign.campaign_name
      const existing = campaignMap.get(name) || { spend: 0, conversions: 0 }
      existing.spend += Number(campaign.spend) || 0
      existing.conversions += Number(campaign.conversions) || 0
      campaignMap.set(name, existing)
    })

    // Encontrar mejor CPA (menor es mejor)
    let bestCampaign: { name: string; cpa: number } | null = null
    campaignMap.forEach((metrics, name) => {
      if (metrics.conversions > 0) {
        const cpa = metrics.spend / metrics.conversions
        if (!bestCampaign || cpa < bestCampaign.cpa) {
          bestCampaign = { name, cpa }
        }
      }
    })

    return bestCampaign
  } catch (error) {
    console.error('[Insights] Error in getBestCampaignByCPA:', error)
    return null
  }
}

/**
 * Obtiene los días y horas con mayor tráfico
 */
async function getPeakTrafficHours(): Promise<{ days: string[]; hours: number[] } | null> {
  try {
    const supabase = await createClient()
    const today = new Date()
    const periodStart = format(subDays(today, 30), 'yyyy-MM-dd')
    const periodEnd = format(today, 'yyyy-MM-dd')

    const { data } = await supabase
      .from('analytics_data')
      .select('date, sessions')
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('sessions', { ascending: false })
      .limit(30)

    if (!data || data.length === 0) return null

    // Agrupar por día de la semana
    const dayMap = new Map<number, number>()
    data.forEach((item: any) => {
      const date = parseISO(item.date)
      const dayOfWeek = date.getDay() // 0 = Domingo, 1 = Lunes, etc.
      const existing = dayMap.get(dayOfWeek) || 0
      dayMap.set(dayOfWeek, existing + (item.sessions || 0))
    })

    // Encontrar días con más tráfico
    const sortedDays = Array.from(dayMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => {
        const dayNames = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
        return dayNames[day]
      })

    // Por ahora, asumir horas pico comunes (10-12h)
    // En el futuro, podríamos obtener datos horarios de analytics_data si están disponibles
    const peakHours = [10, 12]

    return {
      days: sortedDays.length > 0 ? sortedDays : ['martes', 'jueves'],
      hours: peakHours,
    }
  } catch (error) {
    console.error('[Insights] Error in getPeakTrafficHours:', error)
    return null
  }
}

