import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { subDays, format, parseISO } from 'date-fns'
import { calculatePercentageChange } from '@/lib/utils/format'
import { generateDashboardInsights } from '@/lib/utils/dashboard-insights'

interface DashboardKPIs {
  totalRevenue: { current: number; previous: number; change: number }
  overallRoas: { current: number; previous: number; change: number }
  totalSessions: { current: number; previous: number; change: number }
  totalOrders: { current: number; previous: number; change: number }
  totalAdSpend: { current: number; previous: number; change: number }
  totalClicks: { current: number; previous: number; change: number }
  totalImpressions: { current: number; previous: number; change: number }
  totalAppointments?: { current: number; previous: number; change: number }
}

interface DashboardResponse {
  kpis: DashboardKPIs
  charts: {
    revenue: Array<{ date: string; value: number }>
    comparative: Array<{ date: string; ventas: number; gasto_ads: number }>
  }
  topProducts: Array<{ name: string; sales: number; revenue: number }>
  trafficSources: Array<{ source: string; medium: string; sessions: number; percentage: number }>
  insights: Array<{ type: 'success' | 'warning' | 'info' | 'error'; title: string; description: string }>
  integrations: {
    shopify: boolean
    meta: boolean
    analytics: boolean
    acuity: boolean
  }
}

// Helper para verificar si una integración está conectada
async function checkIntegrationStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  integration: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('connected')
    .eq('integration', integration)
    .single()

  if (error || !data) return false
  return (data as any)?.connected || false
}

// Obtener métricas de Shopify
async function getShopifyMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  days: number = 30
) {
  const today = new Date()
  const periodEnd = today
  periodEnd.setHours(23, 59, 59, 999)
  const periodStart = subDays(periodEnd, days)
  periodStart.setHours(0, 0, 0, 0)
  const previousPeriodStart = subDays(periodStart, days)
  previousPeriodStart.setHours(0, 0, 0, 0)
  const previousPeriodEnd = new Date(periodStart)
  previousPeriodEnd.setHours(23, 59, 59, 999)

  // Período actual
  const { data: currentData } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, line_items, created_at')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  // Período anterior
  const { data: previousData } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, line_items')
    .gte('created_at', previousPeriodStart.toISOString())
    .lte('created_at', previousPeriodEnd.toISOString())

  const currentOrders = (currentData || []) as Database['public']['Tables']['shopify_orders']['Row'][]
  const previousOrders = (previousData || []) as Database['public']['Tables']['shopify_orders']['Row'][]

  const totalRevenue = currentOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
  const previousRevenue = previousOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
  const totalOrders = currentOrders.length
  const previousOrdersCount = previousOrders.length

  // Datos diarios para gráfico
  const revenueByDate = new Map<string, number>()
  currentOrders.forEach((order) => {
    const date = format(parseISO(order.created_at), 'yyyy-MM-dd')
    const existing = revenueByDate.get(date) || 0
    revenueByDate.set(date, existing + (Number(order.total_price) || 0))
  })

  const revenueChart = Array.from(revenueByDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Top productos
  const productMap = new Map<string, { name: string; sales: number; revenue: number }>()
  currentOrders.forEach((order) => {
    const lineItems = (order.line_items as any) || []
    lineItems.forEach((item: any) => {
      const key = item.product_id || item.title
      const existing = productMap.get(key) || {
        name: item.title || 'Producto sin nombre',
        sales: 0,
        revenue: 0,
      }
      existing.sales += item.quantity || 0
      existing.revenue += (item.price || 0) * (item.quantity || 0)
      productMap.set(key, existing)
    })
  })

  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  return {
    revenue: {
      current: totalRevenue,
      previous: previousRevenue,
      change: calculatePercentageChange(totalRevenue, previousRevenue),
    },
    orders: {
      current: totalOrders,
      previous: previousOrdersCount,
      change: calculatePercentageChange(totalOrders, previousOrdersCount),
    },
    revenueChart,
    topProducts,
  }
}

// Obtener métricas de Meta Ads
async function getMetaMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  days: number = 30
) {
  const today = new Date()
  const periodEnd = format(today, 'yyyy-MM-dd')
  const periodStart = format(subDays(today, days), 'yyyy-MM-dd')
  const previousPeriodEnd = format(subDays(today, days), 'yyyy-MM-dd')
  const previousPeriodStart = format(subDays(today, days * 2), 'yyyy-MM-dd')

  // Período actual
  const { data: currentData } = await supabase
    .from('meta_campaigns')
    .select('spend, impressions, clicks, conversions, date')
    .gte('date', periodStart)
    .lte('date', periodEnd)

  // Período anterior
  const { data: previousData } = await supabase
    .from('meta_campaigns')
    .select('spend, impressions, clicks, conversions')
    .gte('date', previousPeriodStart)
    .lte('date', previousPeriodEnd)

  const currentCampaigns = (currentData || []) as Database['public']['Tables']['meta_campaigns']['Row'][]
  const previousCampaigns = (previousData || []) as Database['public']['Tables']['meta_campaigns']['Row'][]

  const totalSpend = currentCampaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0)
  const previousSpend = previousCampaigns.reduce((sum, c) => sum + (Number(c.spend) || 0), 0)
  const totalClicks = currentCampaigns.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0)
  const previousClicks = previousCampaigns.reduce((sum, c) => sum + (Number(c.clicks) || 0), 0)
  const totalImpressions = currentCampaigns.reduce((sum, c) => sum + (Number(c.impressions) || 0), 0)
  const previousImpressions = previousCampaigns.reduce((sum, c) => sum + (Number(c.impressions) || 0), 0)

  // Calcular ROAS (Revenue / Ad Spend)
  // Necesitamos obtener ingresos del mismo período
  const periodStartDate = parseISO(periodStart)
  periodStartDate.setHours(0, 0, 0, 0)
  const periodEndDate = parseISO(periodEnd)
  periodEndDate.setHours(23, 59, 59, 999)

  const { data: revenueData } = await supabase
    .from('shopify_orders')
    .select('total_price')
    .gte('created_at', periodStartDate.toISOString())
    .lte('created_at', periodEndDate.toISOString())

  const currentRevenue = (revenueData || []).reduce((sum: number, order: any) => sum + (Number(order.total_price) || 0), 0)
  const currentRoas = totalSpend > 0 ? currentRevenue / totalSpend : 0

  // ROAS período anterior
  const prevPeriodStartDate = parseISO(previousPeriodStart)
  prevPeriodStartDate.setHours(0, 0, 0, 0)
  const prevPeriodEndDate = parseISO(previousPeriodEnd)
  prevPeriodEndDate.setHours(23, 59, 59, 999)

  const { data: prevRevenueData } = await supabase
    .from('shopify_orders')
    .select('total_price')
    .gte('created_at', prevPeriodStartDate.toISOString())
    .lte('created_at', prevPeriodEndDate.toISOString())

  const previousRevenue = (prevRevenueData || []).reduce((sum: number, order: any) => sum + (Number(order.total_price) || 0), 0)
  const previousRoas = previousSpend > 0 ? previousRevenue / previousSpend : 0

  // Datos diarios para gráfico comparativo
  const comparativeByDate = new Map<string, { ventas: number; gasto_ads: number }>()
  
  // Agregar ventas por fecha
  const { data: ordersData } = await supabase
    .from('shopify_orders')
    .select('total_price, created_at')
    .gte('created_at', periodStartDate.toISOString())
    .lte('created_at', periodEndDate.toISOString())

  ;(ordersData || []).forEach((order: any) => {
    const date = format(parseISO(order.created_at), 'yyyy-MM-dd')
    const existing = comparativeByDate.get(date) || { ventas: 0, gasto_ads: 0 }
    existing.ventas += Number(order.total_price) || 0
    comparativeByDate.set(date, existing)
  })

  // Agregar gasto en ads por fecha
  currentCampaigns.forEach((campaign) => {
    const date = campaign.date || format(parseISO(campaign.date as any), 'yyyy-MM-dd')
    const existing = comparativeByDate.get(date) || { ventas: 0, gasto_ads: 0 }
    existing.gasto_ads += Number(campaign.spend) || 0
    comparativeByDate.set(date, existing)
  })

  const comparativeChart = Array.from(comparativeByDate.entries())
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    roas: {
      current: currentRoas,
      previous: previousRoas,
      change: calculatePercentageChange(currentRoas, previousRoas),
    },
    adSpend: {
      current: totalSpend,
      previous: previousSpend,
      change: calculatePercentageChange(totalSpend, previousSpend),
    },
    clicks: {
      current: totalClicks,
      previous: previousClicks,
      change: calculatePercentageChange(totalClicks, previousClicks),
    },
    impressions: {
      current: totalImpressions,
      previous: previousImpressions,
      change: calculatePercentageChange(totalImpressions, previousImpressions),
    },
    comparativeChart,
  }
}

// Obtener métricas de Google Analytics
async function getAnalyticsMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  days: number = 30
) {
  const today = new Date()
  const periodEnd = format(today, 'yyyy-MM-dd')
  const periodStart = format(subDays(today, days), 'yyyy-MM-dd')
  const previousPeriodEnd = format(subDays(today, days), 'yyyy-MM-dd')
  const previousPeriodStart = format(subDays(today, days * 2), 'yyyy-MM-dd')

  // Período actual
  const { data: currentData } = await supabase
    .from('analytics_data')
    .select('sessions, users, traffic_sources')
    .gte('date', periodStart)
    .lte('date', periodEnd)

  // Período anterior
  const { data: previousData } = await supabase
    .from('analytics_data')
    .select('sessions, users')
    .gte('date', previousPeriodStart)
    .lte('date', previousPeriodEnd)

  const currentAnalytics = (currentData || []) as Database['public']['Tables']['analytics_data']['Row'][]
  const previousAnalytics = (previousData || []) as Database['public']['Tables']['analytics_data']['Row'][]

  const totalSessions = currentAnalytics.reduce((sum, a) => sum + (a.sessions || 0), 0)
  const previousSessions = previousAnalytics.reduce((sum, a) => sum + (a.sessions || 0), 0)

  // Agregar fuentes de tráfico
  const trafficSourcesMap = new Map<string, { source: string; medium: string; sessions: number }>()
  currentAnalytics.forEach((item) => {
    const sources = (item.traffic_sources as any) || []
    sources.forEach((source: any) => {
      const key = `${source.source}-${source.medium}`
      const existing = trafficSourcesMap.get(key)
      if (existing) {
        existing.sessions += source.sessions || 0
      } else {
        trafficSourcesMap.set(key, {
          source: source.source || 'unknown',
          medium: source.medium || 'unknown',
          sessions: source.sessions || 0,
        })
      }
    })
  })

  const totalTrafficSessions = Array.from(trafficSourcesMap.values()).reduce((sum, s) => sum + s.sessions, 0)
  const trafficSources = Array.from(trafficSourcesMap.values())
    .map((s) => ({
      ...s,
      percentage: totalTrafficSessions > 0 ? (s.sessions / totalTrafficSessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10)

  return {
    sessions: {
      current: totalSessions,
      previous: previousSessions,
      change: calculatePercentageChange(totalSessions, previousSessions),
    },
    trafficSources,
  }
}

// Obtener métricas de Acuity
async function getAcuityMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  days: number = 30
) {
  const today = new Date()
  const periodEnd = new Date(today)
  periodEnd.setHours(23, 59, 59, 999)
  const periodStart = subDays(periodEnd, days)
  periodStart.setHours(0, 0, 0, 0)
  const previousPeriodStart = subDays(periodStart, days)
  previousPeriodStart.setHours(0, 0, 0, 0)
  const previousPeriodEnd = new Date(periodStart)
  previousPeriodEnd.setHours(23, 59, 59, 999)

  // Período actual
  const { data: currentData } = await supabase
    .from('acuity_appointments')
    .select('datetime, status')
    .gte('datetime', periodStart.toISOString())
    .lte('datetime', periodEnd.toISOString())
    .neq('status', 'canceled')

  // Período anterior
  const { data: previousData } = await supabase
    .from('acuity_appointments')
    .select('datetime, status')
    .gte('datetime', previousPeriodStart.toISOString())
    .lte('datetime', previousPeriodEnd.toISOString())
    .neq('status', 'canceled')

  const currentAppointments = (currentData || []).length
  const previousAppointments = (previousData || []).length

  return {
    appointments: {
      current: currentAppointments,
      previous: previousAppointments,
      change: calculatePercentageChange(currentAppointments, previousAppointments),
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Verificar estado de integraciones
    const [shopifyConnected, metaConnected, analyticsConnected, acuityConnected] = await Promise.all([
      checkIntegrationStatus(supabase, 'shopify'),
      checkIntegrationStatus(supabase, 'meta'),
      checkIntegrationStatus(supabase, 'analytics'),
      checkIntegrationStatus(supabase, 'acuity'),
    ])

    const days = 30 // Últimos 30 días

    // Cargar datos de integraciones conectadas en paralelo
    const promises: Promise<any>[] = []

    if (shopifyConnected) {
      promises.push(getShopifyMetrics(supabase, days).catch((err) => {
        console.error('[Dashboard] Error fetching Shopify metrics:', err)
        return null
      }))
    } else {
      promises.push(Promise.resolve(null))
    }

    if (metaConnected) {
      promises.push(getMetaMetrics(supabase, days).catch((err) => {
        console.error('[Dashboard] Error fetching Meta metrics:', err)
        return null
      }))
    } else {
      promises.push(Promise.resolve(null))
    }

    if (analyticsConnected) {
      promises.push(getAnalyticsMetrics(supabase, days).catch((err) => {
        console.error('[Dashboard] Error fetching Analytics metrics:', err)
        return null
      }))
    } else {
      promises.push(Promise.resolve(null))
    }

    if (acuityConnected) {
      promises.push(getAcuityMetrics(supabase, days).catch((err) => {
        console.error('[Dashboard] Error fetching Acuity metrics:', err)
        return null
      }))
    } else {
      promises.push(Promise.resolve(null))
    }

    const [shopifyData, metaData, analyticsData, acuityData] = await Promise.all(promises)

    // Construir respuesta base
    const response: DashboardResponse = {
      kpis: {
        totalRevenue: shopifyData?.revenue || { current: 0, previous: 0, change: 0 },
        overallRoas: metaData?.roas || { current: 0, previous: 0, change: 0 },
        totalSessions: analyticsData?.sessions || { current: 0, previous: 0, change: 0 },
        totalOrders: shopifyData?.orders || { current: 0, previous: 0, change: 0 },
        totalAdSpend: metaData?.adSpend || { current: 0, previous: 0, change: 0 },
        totalClicks: metaData?.clicks || { current: 0, previous: 0, change: 0 },
        totalImpressions: metaData?.impressions || { current: 0, previous: 0, change: 0 },
        ...(acuityData?.appointments && {
          totalAppointments: acuityData.appointments,
        }),
      },
      charts: {
        revenue: shopifyData?.revenueChart || [],
        comparative: metaData?.comparativeChart || [],
      },
      topProducts: shopifyData?.topProducts || [],
      trafficSources: analyticsData?.trafficSources || [],
      insights: [],
      integrations: {
        shopify: shopifyConnected,
        meta: metaConnected,
        analytics: analyticsConnected,
        acuity: acuityConnected,
      },
    }

    // Generar insights automáticos
    try {
      const insights = await generateDashboardInsights({
        kpis: response.kpis,
        topProducts: response.topProducts,
        trafficSources: response.trafficSources,
        integrations: response.integrations,
      })
      response.insights = insights
    } catch (error) {
      console.error('[Dashboard] Error generating insights:', error)
      // Continuar sin insights si hay error
    }

    return NextResponse.json({
      success: true,
      data: response,
    })
  } catch (error: any) {
    console.error('[Dashboard] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard data',
        details: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

