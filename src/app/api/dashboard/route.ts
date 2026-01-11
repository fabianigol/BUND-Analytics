import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { format, subDays, parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { calculatePercentageChange, MXN_TO_EUR_RATE } from '@/lib/utils/format'
import { generateDashboardInsights } from '@/lib/utils/dashboard-insights'

interface DashboardResponse {
  kpis: {
    salesYesterday: number
    salesMonth: number
    adsSpendYesterday: number
    adsSpendMonth: number
    appointmentsYesterday: number
    appointmentsMonth: number
    roasAccumulated: number
  }
  dailyRevenue: Array<{ date: string; value: number }>
  salesVsInvestment: Array<{ date: string; ventas: number; inversion: number }>
  storeOccupation: Array<{
    storeName: string
    medicion: { booked: number; total: number; percentage: number }
    fitting: { booked: number; total: number; percentage: number }
  }>
  topVIPCustomers: Array<{
    email: string
    name: string
    city: string | null
    ltv: number
    currency: string
    orderCount: number
    hasNextAppointment: boolean
    nextAppointmentDate?: string
  }>
  alerts: Array<{ type: 'success' | 'warning' | 'info' | 'error'; message: string }>
  period: 'daily' | 'weekly' | 'monthly'
  ctrByCitasCampaigns: Array<{
    campaignName: string
    ctr: number
    impressions: number
    clicks: number
  }>
  ordersBreakdown: {
    totalOrders: number
    ordersOnline: number
    ordersFromMedicion: number
    ordersFromFitting: number
    ordersWithoutAppointment: number
  }
}

interface CustomerData {
  email: string
  name: string
  ltv: number
  orderCount: number
  city: string | null
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

// Obtener ventas ayer y mes desde Shopify (España + México convertido a EUR)
async function getShopifySales(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const yesterday = subDays(today, 1)
  const yesterdayStart = startOfDay(yesterday)
  const yesterdayEnd = endOfDay(yesterday)
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  // Ventas ayer (España + México)
  const { data: yesterdayOrders } = await supabase
    .from('shopify_orders')
    .select('total_price, country')
    .gte('created_at', yesterdayStart.toISOString())
    .lte('created_at', yesterdayEnd.toISOString())

  // Ventas mes (España + México)
  const { data: monthOrders } = await supabase
    .from('shopify_orders')
    .select('total_price, country')
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())

  // Calcular ventas ayer: España (EUR) + México (MXN → EUR)
  const salesYesterday = ((yesterdayOrders || []) as Array<{ total_price: string | number | null; country: string }>).reduce((sum, order) => {
    const price = Number(order.total_price) || 0
    // Si es México, convertir MXN a EUR
    const priceInEUR = order.country === 'MX' ? price * MXN_TO_EUR_RATE : price
    return sum + priceInEUR
  }, 0)

  // Calcular ventas mes: España (EUR) + México (MXN → EUR)
  const salesMonth = ((monthOrders || []) as Array<{ total_price: string | number | null; country: string }>).reduce((sum, order) => {
    const price = Number(order.total_price) || 0
    // Si es México, convertir MXN a EUR
    const priceInEUR = order.country === 'MX' ? price * MXN_TO_EUR_RATE : price
    return sum + priceInEUR
  }, 0)

  return { salesYesterday, salesMonth }
}

// Obtener coste en ads ayer y mes desde Meta
async function getMetaAdsSpend(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const yesterday = subDays(today, 1)
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd')
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const monthStartStr = format(monthStart, 'yyyy-MM-dd')
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

  // Ads ayer
  const { data: yesterdayAds } = await supabase
    .from('meta_campaigns')
    .select('spend')
    .eq('date', yesterdayStr)

  // Ads mes
  const { data: monthAds } = await supabase
    .from('meta_campaigns')
    .select('spend')
    .gte('date', monthStartStr)
    .lte('date', monthEndStr)

  const adsSpendYesterday = ((yesterdayAds || []) as Array<{ spend: string | number | null }>).reduce((sum, ad) => sum + (Number(ad.spend) || 0), 0)
  const adsSpendMonth = ((monthAds || []) as Array<{ spend: string | number | null }>).reduce((sum, ad) => sum + (Number(ad.spend) || 0), 0)

  return { adsSpendYesterday, adsSpendMonth }
}

// Obtener citas ayer y mes desde Acuity
async function getAcuityAppointments(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const yesterday = subDays(today, 1)
  const yesterdayStart = startOfDay(yesterday)
  const yesterdayEnd = endOfDay(yesterday)
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  // Citas ayer
  const { data: yesterdayAppointments } = await supabase
    .from('acuity_appointments')
    .select('datetime, status')
    .gte('datetime', yesterdayStart.toISOString())
    .lte('datetime', yesterdayEnd.toISOString())
    .neq('status', 'canceled')

  // Citas mes
  const { data: monthAppointments } = await supabase
    .from('acuity_appointments')
    .select('datetime, status')
    .gte('datetime', monthStart.toISOString())
    .lte('datetime', monthEnd.toISOString())
    .neq('status', 'canceled')

  const appointmentsYesterday = (yesterdayAppointments || []).length
  const appointmentsMonth = (monthAppointments || []).length

  return { appointmentsYesterday, appointmentsMonth }
}

// Calcular ROAS acumulado (Meta + Shopify)
async function getAccumulatedROAS(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const monthStartStr = format(monthStart, 'yyyy-MM-dd')
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

  // Obtener ventas del mes
  const { data: monthOrders } = await supabase
    .from('shopify_orders')
    .select('total_price')
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())

  // Obtener gasto en ads del mes
  const { data: monthAds } = await supabase
    .from('meta_campaigns')
    .select('spend')
    .gte('date', monthStartStr)
    .lte('date', monthEndStr)

  const totalRevenue = ((monthOrders || []) as Array<{ total_price: string | number | null }>).reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
  const totalSpend = ((monthAds || []) as Array<{ spend: string | number | null }>).reduce((sum, ad) => sum + (Number(ad.spend) || 0), 0)

  const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  return roas
}

// Obtener ingresos diarios del mes en curso (España + México convertido a EUR)
async function getDailyRevenueThisMonth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  monthEnd.setHours(23, 59, 59, 999)

  // Obtener todos los pedidos del mes (España + México)
  const { data: ordersData } = await supabase
    .from('shopify_orders')
    .select('total_price, created_at, country')
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())
    .order('created_at', { ascending: true })

  // Agrupar por fecha con conversión MXN → EUR
  const dailyRevenue = new Map<string, number>()

  ;((ordersData || []) as Array<{ created_at: string; total_price: string | number | null; country: string }>).forEach((order) => {
    const date = format(parseISO(order.created_at), 'yyyy-MM-dd')
    const revenue = Number(order.total_price) || 0
    // Si es México, convertir MXN a EUR
    const revenueInEUR = order.country === 'MX' ? revenue * MXN_TO_EUR_RATE : revenue
    const existing = dailyRevenue.get(date) || 0
    dailyRevenue.set(date, existing + revenueInEUR)
  })

  // Generar todas las fechas del mes para tener datos completos
  const chartData: Array<{ date: string; value: number }> = []
  let currentDate = new Date(monthStart)
  
  while (currentDate <= today && currentDate <= monthEnd) {
    const dateStr = format(currentDate, 'yyyy-MM-dd')
    chartData.push({
      date: dateStr,
      value: Math.round((dailyRevenue.get(dateStr) || 0) * 100) / 100,
    })
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  }

  return chartData.sort((a, b) => a.date.localeCompare(b.date))
}

// Generar datos para funnel Sankey (DEPRECATED - ya no se usa)
async function getFunnelData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  period: 'daily' | 'weekly' | 'monthly'
) {
  const today = new Date()
  let periodStart: Date
  let periodEnd: Date = today

  switch (period) {
    case 'daily':
      periodStart = startOfDay(today)
      periodEnd = endOfDay(today)
      break
    case 'weekly':
      periodStart = startOfWeek(today, { weekStartsOn: 1 })
      periodEnd = endOfWeek(today, { weekStartsOn: 1 })
      break
    case 'monthly':
      periodStart = startOfMonth(today)
      periodEnd = endOfMonth(today)
      break
  }

  const periodStartStr = format(periodStart, 'yyyy-MM-dd')
  const periodEndStr = format(periodEnd, 'yyyy-MM-dd')

  // 1. Impresiones (Meta)
  const { data: metaData } = await supabase
    .from('meta_campaigns')
    .select('impressions, clicks, date')
    .gte('date', periodStartStr)
    .lte('date', periodEndStr)

  const totalImpressions = ((metaData || []) as Array<{ impressions: string | number | null; clicks: string | number | null }>).reduce((sum, ad) => sum + (Number(ad.impressions) || 0), 0)
  
  // 2. Link Clicks de Meta (filtrar solo clicks de Meta)
  const { data: metaAdsData } = await supabase
    .from('meta_ads')
    .select('link_clicks, date')
    .gte('date', periodStartStr)
    .lte('date', periodEndStr)

  const totalLinkClicks = ((metaAdsData || []) as Array<{ link_clicks: string | number | null }>).reduce((sum, ad) => sum + (Number(ad.link_clicks) || 0), 0)
  // Si no hay link_clicks, usar clicks de meta_campaigns como fallback
  const totalClicks = totalLinkClicks > 0 ? totalLinkClicks : ((metaData || []) as Array<{ impressions: string | number | null; clicks: string | number | null }>).reduce((sum, ad) => sum + (Number(ad.clicks) || 0), 0)

  // 3. Sesiones web de Meta (Analytics - filtrar por tráfico de Meta)
  const { data: analyticsData } = await supabase
    .from('analytics_data')
    .select('sessions, traffic_sources')
    .gte('date', periodStartStr)
    .lte('date', periodEndStr)

  // Calcular sesiones totales y sesiones de Meta
  let totalSessions = 0
  let metaSessions = 0
  let totalSessionsForPercentage = 0

  ;((analyticsData || []) as Array<{ sessions: number | null; traffic_sources: any }>).forEach((item) => {
    const sessions = item.sessions || 0
    totalSessionsForPercentage += sessions
    
    const trafficSources = (item.traffic_sources as any) || []
    trafficSources.forEach((source: any) => {
      const sourceName = (source.source || '').toLowerCase()
      const medium = (source.medium || '').toLowerCase()
      
      // Identificar tráfico de Meta (facebook, instagram, meta, etc.)
      if (
        sourceName.includes('facebook') ||
        sourceName.includes('instagram') ||
        sourceName.includes('meta') ||
        medium === 'paid' && (sourceName.includes('fb') || sourceName.includes('ig'))
      ) {
        metaSessions += source.sessions || 0
      }
    })
  })

  // Si no podemos identificar sesiones de Meta directamente, usar regla de tres
  // basado en el porcentaje de tráfico de Meta
  let sessionsFromMeta = metaSessions
  
  if (metaSessions === 0 && totalSessionsForPercentage > 0) {
    // Buscar el porcentaje de Meta en traffic_sources
    let totalMetaPercentage = 0
    let count = 0
    
    ;((analyticsData || []) as Array<{ sessions: number | null; traffic_sources: any }>).forEach((item) => {
      const trafficSources = (item.traffic_sources as any) || []
      const totalItemSessions = item.sessions || 0
      
      if (totalItemSessions > 0) {
        trafficSources.forEach((source: any) => {
          const sourceName = (source.source || '').toLowerCase()
          const medium = (source.medium || '').toLowerCase()
          
          if (
            sourceName.includes('facebook') ||
            sourceName.includes('instagram') ||
            sourceName.includes('meta') ||
            (medium === 'paid' && (sourceName.includes('fb') || sourceName.includes('ig')))
          ) {
            // Calcular porcentaje de este source respecto al total de sesiones del día
            const sourcePercentage = (source.sessions || 0) / totalItemSessions * 100
            totalMetaPercentage += sourcePercentage
            count++
          }
        })
      }
    })

    // Calcular promedio del porcentaje de Meta
    const avgMetaPercentage = count > 0 ? totalMetaPercentage / count : 0

    // Aplicar regla de tres: si Meta representa X% del tráfico, calcular sesiones
    if (avgMetaPercentage > 0) {
      sessionsFromMeta = Math.round((totalSessionsForPercentage * avgMetaPercentage) / 100)
    }
  }

  // 4. Citas agendadas (Acuity)
  const { data: appointmentsData } = await supabase
    .from('acuity_appointments')
    .select('datetime, status')
    .gte('datetime', periodStart.toISOString())
    .lte('datetime', periodEnd.toISOString())
    .neq('status', 'canceled')

  const totalAppointments = (appointmentsData || []).length

  // 5. Compras (Shopify)
  const { data: ordersData } = await supabase
    .from('shopify_orders')
    .select('total_price')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  const totalOrders = (ordersData || []).length

  // Crear nodos
  const nodes = [
    { id: 'impressions', name: 'Impresiones', value: totalImpressions, level: 0, color: '#3b82f6' },
    { id: 'clicks', name: 'Clicks', value: totalClicks, level: 1, color: '#60a5fa' },
    { id: 'sessions', name: 'Sesiones Web', value: sessionsFromMeta, level: 2, color: '#10b981' },
    { id: 'appointments', name: 'Citas Agendadas', value: totalAppointments, level: 3, color: '#f59e0b' },
    { id: 'purchases', name: 'Compras', value: totalOrders, level: 4, color: '#ef4444' },
  ]

  // Crear links
  const links = [
    { source: 'impressions', target: 'clicks', value: totalClicks },
    { source: 'clicks', target: 'sessions', value: sessionsFromMeta },
    { source: 'sessions', target: 'appointments', value: totalAppointments },
    { source: 'appointments', target: 'purchases', value: totalOrders },
  ]

  return { nodes, links }
}

// Obtener evolución ventas vs inversión últimos 30 días
async function getSalesVsInvestment(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const periodStart = subDays(today, 30)
  const periodStartStr = format(periodStart, 'yyyy-MM-dd')
  const periodEndStr = format(today, 'yyyy-MM-dd')

  // Obtener ventas por día
  const { data: ordersData } = await supabase
    .from('shopify_orders')
    .select('total_price, created_at')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', today.toISOString())

  // Obtener inversión por día desde meta_campaigns (agrupado por fecha)
  const { data: adsData } = await supabase
    .from('meta_campaigns')
    .select('spend, date')
    .gte('date', periodStartStr)
    .lte('date', periodEndStr)

  // Agrupar ventas por fecha
  const salesByDate = new Map<string, number>()
  ;((ordersData || []) as Array<{ created_at: string; total_price: string | number | null }>).forEach((order) => {
    const date = format(parseISO(order.created_at), 'yyyy-MM-dd')
    const existing = salesByDate.get(date) || 0
    salesByDate.set(date, existing + (Number(order.total_price) || 0))
  })

  // Agrupar inversión por fecha (sumar todos los registros del mismo día)
  const investmentByDate = new Map<string, number>()
  ;(adsData || []).forEach((ad: any) => {
    let date: string
    if (ad.date) {
      // Si es string, usarlo directamente
      if (typeof ad.date === 'string') {
        date = ad.date
      } else {
        // Si es Date object, formatearlo
        date = format(new Date(ad.date), 'yyyy-MM-dd')
      }
    } else {
      date = format(new Date(), 'yyyy-MM-dd')
    }
    const existing = investmentByDate.get(date) || 0
    investmentByDate.set(date, existing + (Number(ad.spend) || 0))
  })
  
  console.log('[Dashboard] Investment data:', {
    totalAdsRecords: adsData?.length || 0,
    uniqueDates: investmentByDate.size,
    sampleDates: Array.from(investmentByDate.entries()).slice(0, 5),
  })

  // Generar todas las fechas del período para tener datos completos
  const allDates: string[] = []
  let currentDate = new Date(periodStart)
  while (currentDate <= today) {
    allDates.push(format(currentDate, 'yyyy-MM-dd'))
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
  }

  // Combinar datos
  const chartData = allDates
    .map((date) => ({
      date,
      ventas: salesByDate.get(date) || 0,
      inversion: investmentByDate.get(date) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return chartData
}

// Función helper para normalizar nombres de tienda (copiada de acuity/stats)
function normalizeStoreName(storeName: string): string {
  if (!storeName) return 'Unknown'
  
  let normalized = storeName.trim()
  
  // Eliminar variaciones comunes
  normalized = normalized.replace(/^The\s+/i, '')
  normalized = normalized.replace(/^BundClub\s+/i, '')
  normalized = normalized.replace(/^BUND\s+/i, '')
  normalized = normalized.replace(/\s*-\s*.*$/i, '') // Eliminar todo después de "-"
  normalized = normalized.replace(/\s*\(.*\)$/i, '') // Eliminar paréntesis y contenido
  
  // Normalizar nombres de ciudades - mapeo más completo
  const cityMap: { [key: string]: string } = {
    'málaga': 'Málaga',
    'malaga': 'Málaga',
    'madrid': 'Madrid',
    'barcelona': 'Barcelona',
    'sevilla': 'Sevilla',
    'seville': 'Sevilla',
    'valencia': 'Valencia',
    'murcia': 'Murcia',
    'bilbao': 'Bilbao',
    'zaragoza': 'Zaragoza',
    'cdmx': 'Cdmx',
    'mexico': 'Cdmx',
    'méxico': 'Cdmx',
    'ciudad de méxico': 'Cdmx',
    'ciudad de mexico': 'Cdmx',
  }
  
  const lowerName = normalized.toLowerCase()
  
  // Buscar coincidencias exactas primero
  if (cityMap[lowerName]) {
    return cityMap[lowerName]
  }
  
  // Buscar coincidencias parciales
  for (const [key, value] of Object.entries(cityMap)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return value
    }
  }
  
  // Si no coincide, intentar capitalizar correctamente
  // Mantener nombres especiales como "Cdmx" en mayúsculas
  if (lowerName.includes('cdmx') || lowerName.includes('mexico')) {
    return 'Cdmx'
  }
  
  // Capitalizar primera letra para otros casos
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

// Obtener ocupación por tienda HOY
async function getStoreOccupationToday(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  // Orden fijo de las tiendas según layout especificado
  // Primera fila: Madrid, Sevilla, Málaga, Barcelona, Murcia
  // Segunda fila: CDMX, Bilbao, Zaragoza, Valencia, Próximamente
  const orderedStores = [
    'Madrid',
    'Sevilla',
    'Málaga',
    'Barcelona',
    'Murcia',
    'Cdmx',
    'Bilbao',
    'Zaragoza',
    'Valencia',
  ]

  // Obtener datos del snapshot diario para HOY
  // Este snapshot captura el total del día COMPLETO al inicio del día
  // Usamos acuity_availability_history con period_type='daily'
  const { data: dailySnapshot } = await supabase
    .from('acuity_availability_history')
    .select('store_name, appointment_category, booked_slots, total_slots, available_slots')
    .eq('snapshot_date', todayStr)
    .eq('period_type', 'daily')
  
  // Si no hay snapshot diario (ej: el cron no se ha ejecutado hoy), 
  // usar datos de acuity_availability_by_store como fallback
  const { data: availabilityByStore } = !dailySnapshot || dailySnapshot.length === 0
    ? await supabase
        .from('acuity_availability_by_store')
        .select('store_name, appointment_category, booked_slots, total_slots, available_slots')
        .eq('date', todayStr)
    : { data: null }

  // Agrupar por tienda y categoría
  const storeMap = new Map<
    string,
    {
      medicion: { booked: number; total: number }
      fitting: { booked: number; total: number }
    }
  >()

  // Usar datos del snapshot diario si está disponible (preferido)
  const dataToProcess = dailySnapshot && dailySnapshot.length > 0 ? dailySnapshot : availabilityByStore
  const dataSource = dailySnapshot && dailySnapshot.length > 0 ? 'daily_snapshot' : 'availability_by_store'

  if (dataToProcess && dataToProcess.length > 0) {
    console.log('[Dashboard] Raw occupation data:', {
      source: dataSource,
      count: dataToProcess.length,
      sample: dataToProcess.slice(0, 5).map((item: any) => ({
        store_name: item.store_name,
        normalized: normalizeStoreName(item.store_name || 'Unknown'),
        category: item.appointment_category,
        booked: item.booked_slots,
        total: item.total_slots_day || item.total_slots,
        available: item.available_slots,
      })),
    })

    dataToProcess.forEach((item: any) => {
      const storeName = normalizeStoreName(item.store_name || 'Unknown')
      const category = item.appointment_category
      const booked = item.booked_slots || 0
      // total_slots viene de acuity_availability_history o acuity_availability_by_store
      const total = item.total_slots || 0

      if (!storeMap.has(storeName)) {
        storeMap.set(storeName, {
          medicion: { booked: 0, total: 0 },
          fitting: { booked: 0, total: 0 },
        })
      }

      const store = storeMap.get(storeName)!
      if (category === 'medición') {
        store.medicion.booked += booked
        store.medicion.total += total
      } else if (category === 'fitting') {
        store.fitting.booked += booked
        store.fitting.total += total
      }
    })

    console.log('[Dashboard] Store map after processing:', {
      dataSource: dataSource,
      storesInMap: Array.from(storeMap.keys()),
      orderedStores: orderedStores,
    })
  } else {
    console.log('[Dashboard] No availability data found for today:', todayStr)
  }

  // Crear resultado con todas las tiendas en el orden especificado
  const result = orderedStores.map((storeName) => {
    const data = storeMap.get(storeName) || {
      medicion: { booked: 0, total: 0 },
      fitting: { booked: 0, total: 0 },
    }

    // El total ya viene del snapshot (es el total del día completo)
    const medicionTotal = data.medicion.total
    const fittingTotal = data.fitting.total

    return {
      storeName,
      medicion: {
        booked: data.medicion.booked,
        total: medicionTotal,
        percentage: medicionTotal > 0 
          ? Math.min(100, Math.round((data.medicion.booked / medicionTotal) * 100)) 
          : 0,
      },
      fitting: {
        booked: data.fitting.booked,
        total: fittingTotal,
        percentage: fittingTotal > 0 
          ? Math.min(100, Math.round((data.fitting.booked / fittingTotal) * 100)) 
          : 0,
      },
    }
  })

  console.log('[Dashboard] Store occupation data:', {
    today: todayStr,
    storesFound: result.length,
    stores: result.map((s) => ({
      name: s.storeName,
      hasData: s.medicion.total > 0 || s.fitting.total > 0,
      medicion: s.medicion,
      fitting: s.fitting,
    })),
  })

  // Asegurar que siempre devolvemos exactamente 9 tiendas
  if (result.length !== 9) {
    console.warn('[Dashboard] Warning: Expected 9 stores but got', result.length)
  }

  return result
}

// Obtener top 10 clientes VIP (mostrar en moneda original, ordenar por EUR)
async function getTopVIPCustomers(supabase: Awaited<ReturnType<typeof createClient>>) {
  // Obtener todos los clientes con su información de país
  const { data: ordersData } = await supabase
    .from('shopify_orders')
    .select('customer_email, customer_name, total_price, tags, country')
    .order('created_at', { ascending: false })

  if (!ordersData) return []

  // Agrupar por cliente
  const customerMap = new Map<string, { 
    email: string
    name: string
    ltv: number
    ltvInEUR: number
    orderCount: number
    city: string | null
    currency: string
    country: string
  }>()

  ;(ordersData as Array<{ 
    customer_email: string
    customer_name: string | null
    total_price: string | number | null
    tags: string[] | null
    country: string 
  }>).forEach((order) => {
    const email = order.customer_email
    const price = Number(order.total_price) || 0
    const country = order.country || 'ES'
    const currency = country === 'MX' ? 'MXN' : 'EUR'
    
    const existing = customerMap.get(email) || {
      email,
      name: order.customer_name || email,
      ltv: 0,
      ltvInEUR: 0,
      orderCount: 0,
      city: null,
      currency,
      country,
    }

    // Acumular LTV en moneda original
    existing.ltv += price
    
    // Acumular LTV convertido a EUR para ordenamiento
    const priceInEUR = country === 'MX' ? price * MXN_TO_EUR_RATE : price
    existing.ltvInEUR += priceInEUR
    
    existing.orderCount += 1

    // Extraer ciudad de tags si no la tenemos
    if (!existing.city) {
      const tags = (order.tags as string[]) || []
      const locationTag = tags.find((tag) => {
        const normalized = tag.toLowerCase()
        return ['madrid', 'barcelona', 'sevilla', 'málaga', 'malaga', 'valencia', 'murcia', 'bilbao', 'zaragoza', 'cdmx', 'mexico'].some(
          (city) => normalized.includes(city)
        )
      })
      if (locationTag) {
        existing.city = locationTag
      }
    }

    customerMap.set(email, existing)
  })

  // Filtrar VIP (LTV >= 2000 EUR equivalente) y ordenar por LTV en EUR
  const vipCustomers = Array.from(customerMap.values())
    .filter((c) => c.ltvInEUR >= 2000)
    .sort((a, b) => b.ltvInEUR - a.ltvInEUR)
    .slice(0, 10)

  // Obtener próximas citas para estos clientes
  const emails = vipCustomers.map((c) => c.email)
  const today = new Date()

  const { data: appointmentsData } = await supabase
    .from('acuity_appointments')
    .select('email, datetime')
    .in('email', emails)
    .gte('datetime', today.toISOString())
    .neq('status', 'canceled')
    .order('datetime', { ascending: true })
    .limit(100)

  // Mapear citas por email
  const appointmentsByEmail = new Map<string, string>()
  ;(appointmentsData || []).forEach((apt: any) => {
    const email = apt.email
    if (!appointmentsByEmail.has(email)) {
      appointmentsByEmail.set(email, apt.datetime)
    }
  })

  // Combinar datos (mostrar LTV en moneda original)
  return vipCustomers.map((customer) => ({
    email: customer.email,
    name: customer.name,
    city: customer.city,
    ltv: Math.round(customer.ltv * 100) / 100, // LTV en moneda original
    currency: customer.currency, // EUR o MXN
    orderCount: customer.orderCount,
    hasNextAppointment: appointmentsByEmail.has(customer.email),
    nextAppointmentDate: appointmentsByEmail.get(customer.email),
  }))
}

// Generar alertas inteligentes
async function generateIntelligentAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kpis: DashboardResponse['kpis']
): Promise<Array<{ type: 'success' | 'warning' | 'info' | 'error'; message: string }>> {
  const alerts: Array<{ type: 'success' | 'warning' | 'info' | 'error'; message: string }> = []
  const today = new Date()
  const weekAgo = subDays(today, 7)
  const monthStart = startOfMonth(today)

  // 1. ROAS bajo
  if (kpis.roasAccumulated > 0 && kpis.roasAccumulated < 1) {
    alerts.push({
      type: 'warning',
      message: `ROAS acumulado está en ${kpis.roasAccumulated.toFixed(2)}x (por debajo de 1). Revisa tus campañas.`,
    })
  }

  // 2. Citas bajando vs semana pasada
  const weekAgoStart = startOfDay(weekAgo)
  const weekAgoEnd = endOfDay(weekAgo)
  const { data: weekAgoAppointments } = await supabase
    .from('acuity_appointments')
    .select('datetime, status')
    .gte('datetime', weekAgoStart.toISOString())
    .lte('datetime', weekAgoEnd.toISOString())
    .neq('status', 'canceled')

  const weekAgoCount = (weekAgoAppointments || []).length
  if (weekAgoCount > 0 && kpis.appointmentsYesterday < weekAgoCount * 0.65) {
    const decrease = Math.round(((weekAgoCount - kpis.appointmentsYesterday) / weekAgoCount) * 100)
    alerts.push({
      type: 'warning',
      message: `Tus citas han bajado un ${decrease}% respecto a la semana pasada.`,
    })
  }

  // 3. Producto más vendido con stock bajo (si tenemos datos de productos)
  const { data: topProducts } = await supabase
    .from('shopify_orders')
    .select('line_items, created_at')
    .gte('created_at', monthStart.toISOString())

  if (topProducts && topProducts.length > 0) {
    const productMap = new Map<string, number>()
    ;(topProducts as Array<{ line_items: any }>).forEach((order) => {
      const items = (order.line_items as any) || []
      items.forEach((item: any) => {
        const productName = item.title || 'Producto'
        const existing = productMap.get(productName) || 0
        productMap.set(productName, existing + (item.quantity || 0))
      })
    })

    const topProduct = Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])[0]

    if (topProduct) {
      // Nota: No tenemos datos de stock real, pero podemos simular una alerta
      alerts.push({
        type: 'info',
        message: `"${topProduct[0]}" es el producto más vendido esta semana. Verifica stock.`,
      })
    }
  }

  // 4. Mejora en tasa de conversión (si tenemos datos)
  if (kpis.salesMonth > 0 && kpis.adsSpendMonth > 0) {
    const currentROAS = kpis.salesMonth / kpis.adsSpendMonth
    const lastMonthStart = startOfMonth(subDays(monthStart, 1))
    const lastMonthEnd = endOfMonth(subDays(monthStart, 1))

    const { data: lastMonthOrders } = await supabase
      .from('shopify_orders')
      .select('total_price')
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString())

    const { data: lastMonthAds } = await supabase
      .from('meta_campaigns')
      .select('spend')
      .gte('date', format(lastMonthStart, 'yyyy-MM-dd'))
      .lte('date', format(lastMonthEnd, 'yyyy-MM-dd'))

    const lastMonthSales = ((lastMonthOrders || []) as Array<{ total_price: string | number | null }>).reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
    const lastMonthSpend = ((lastMonthAds || []) as Array<{ spend: string | number | null }>).reduce((sum, a) => sum + (Number(a.spend) || 0), 0)

    if (lastMonthSpend > 0) {
      const lastMonthROAS = lastMonthSales / lastMonthSpend
      if (currentROAS > lastMonthROAS * 1.15) {
        const improvement = Math.round(((currentROAS - lastMonthROAS) / lastMonthROAS) * 100)
        alerts.push({
          type: 'success',
          message: `La tasa de conversión ha mejorado un ${improvement}% desde el mes pasado.`,
        })
      }
    }
  }

  // 5. Desbalance de citas entre ciudades
  const { data: todayAppointments } = await supabase
    .from('acuity_appointments')
    .select('calendar_name, datetime')
    .gte('datetime', startOfDay(today).toISOString())
    .lte('datetime', endOfDay(today).toISOString())
    .neq('status', 'canceled')

  if (todayAppointments && todayAppointments.length > 0) {
    const cityMap = new Map<string, number>()
    ;(todayAppointments || []).forEach((apt: any) => {
      const calendar = apt.calendar_name || ''
      const city = calendar.split(' ')[0] // Asumir que el nombre de la ciudad está al inicio
      const existing = cityMap.get(city) || 0
      cityMap.set(city, existing + 1)
    })

    const cities = Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1])
    if (cities.length >= 2) {
      const [topCity, secondCity] = cities
      if (topCity[1] > secondCity[1] * 3) {
        alerts.push({
          type: 'info',
          message: `Hoy tienes ${topCity[1]} citas en ${topCity[0]} y solo ${secondCity[1]} en ${secondCity[0]}. ¿Subir ads allí?`,
        })
      }
    }
  }

  // 6. Ventas del mes vs mes anterior
  const lastMonthStart = startOfMonth(subDays(monthStart, 1))
  const lastMonthEnd = endOfMonth(subDays(monthStart, 1))
  const { data: lastMonthSalesData } = await supabase
    .from('shopify_orders')
    .select('total_price')
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString())

  const lastMonthSales = ((lastMonthSalesData || []) as Array<{ total_price: string | number | null }>).reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)
  if (lastMonthSales > 0 && kpis.salesMonth > 0) {
    const salesChange = ((kpis.salesMonth - lastMonthSales) / lastMonthSales) * 100
    if (salesChange > 20) {
      alerts.push({
        type: 'success',
        message: `Las ventas del mes han aumentado un ${Math.round(salesChange)}% respecto al mes anterior.`,
      })
    } else if (salesChange < -15) {
      alerts.push({
        type: 'warning',
        message: `Las ventas del mes han disminuido un ${Math.round(Math.abs(salesChange))}% respecto al mes anterior.`,
      })
    }
  }

  // 7. Campaña con mejor rendimiento este mes
  const { data: topCampaigns } = await supabase
    .from('meta_campaigns')
    .select('campaign_name, spend, conversions, roas')
    .gte('date', format(monthStart, 'yyyy-MM-dd'))
    .lte('date', format(endOfMonth(today), 'yyyy-MM-dd'))
    .gt('spend', 0)
    .gt('conversions', 0)

  if (topCampaigns && topCampaigns.length > 0) {
    const campaignMap = new Map<string, { spend: number; conversions: number; roas: number }>()
    topCampaigns.forEach((campaign: any) => {
      const name = campaign.campaign_name || 'Sin nombre'
      const existing = campaignMap.get(name) || { spend: 0, conversions: 0, roas: 0 }
      existing.spend += Number(campaign.spend) || 0
      existing.conversions += Number(campaign.conversions) || 0
      existing.roas = Math.max(existing.roas, Number(campaign.roas) || 0)
      campaignMap.set(name, existing)
    })

    const bestCampaign = Array.from(campaignMap.entries())
      .filter(([, data]) => data.conversions > 0 && data.roas > 2)
      .sort((a, b) => b[1].roas - a[1].roas)[0]

    if (bestCampaign) {
      alerts.push({
        type: 'success',
        message: `"${bestCampaign[0]}" es tu mejor campaña este mes con ROAS de ${bestCampaign[1].roas.toFixed(2)}x.`,
      })
    }
  }

  // Asegurar que siempre haya al menos 4 alertas (tomar las primeras 4)
  return alerts.slice(0, 4)
}

// Obtener CTR por campañas (todas las campañas con spend > 0 del mes actual)
async function getCTRByCitasCampaigns(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const monthStartStr = format(monthStart, 'yyyy-MM-dd')
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd')

  // Obtener todas las campañas de Meta del mes actual
  const { data: campaignsData } = await supabase
    .from('meta_campaigns')
    .select('campaign_id, campaign_name, spend, impressions, clicks, date')
    .gte('date', monthStartStr)
    .lte('date', monthEndStr)

  if (!campaignsData || campaignsData.length === 0) {
    return []
  }

  // Agrupar por campaign_id y sumar métricas
  const campaignMap = new Map<
    string,
    {
      campaignId: string
      campaignName: string
      totalSpend: number
      totalImpressions: number
      totalClicks: number
    }
  >()

  campaignsData.forEach((campaign: any) => {
    const campaignId = campaign.campaign_id || 'unknown'
    const campaignName = campaign.campaign_name || 'Sin nombre'
    const spend = Number(campaign.spend) || 0
    const impressions = Number(campaign.impressions) || 0
    const clicks = Number(campaign.clicks) || 0

    const existing = campaignMap.get(campaignId) || {
      campaignId,
      campaignName,
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
    }

    existing.totalSpend += spend
    existing.totalImpressions += impressions
    existing.totalClicks += clicks

    campaignMap.set(campaignId, existing)
  })

  // Filtrar solo campañas con spend > 0 y calcular CTR
  const result = Array.from(campaignMap.values())
    .filter((campaign) => campaign.totalSpend > 0) // Solo campañas con spend > 0
    .map((campaign) => {
      // Calcular CTR: (clicks / impressions) * 100
      const ctr =
        campaign.totalImpressions > 0
          ? (campaign.totalClicks / campaign.totalImpressions) * 100
          : 0

      return {
        campaignName: campaign.campaignName,
        ctr: Math.round(ctr * 100) / 100, // 2 decimales
        impressions: campaign.totalImpressions,
        clicks: campaign.totalClicks,
        spend: campaign.totalSpend,
      }
    })
    .sort((a, b) => b.ctr - a.ctr) // Ordenar por CTR descendente
    .slice(0, 10) // Top 10

  return result
}

// Obtener desglose de pedidos por tipo de cita (mes actual)
async function getOrdersBreakdown(supabase: Awaited<ReturnType<typeof createClient>>) {
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  // Obtener pedidos del mes actual (incluyendo tags para identificar pedidos online)
  const { data: currentOrdersData } = await supabase
    .from('shopify_orders')
    .select('customer_email, created_at, tags')
    .gte('created_at', monthStart.toISOString())
    .lte('created_at', monthEnd.toISOString())

  if (!currentOrdersData || currentOrdersData.length === 0) {
    return {
      totalOrders: 0,
      ordersOnline: 0,
      ordersFromMedicion: 0,
      ordersFromFitting: 0,
      ordersWithoutAppointment: 0,
    }
  }

  const currentOrders = (currentOrdersData as Array<Database['public']['Tables']['shopify_orders']['Row'] & { tags?: string[] | null }>)

  // Separar pedidos online (sin etiquetas) de pedidos en tienda (con etiquetas)
  const onlineOrders: typeof currentOrders = []
  const storeOrders: typeof currentOrders = []

  currentOrders.forEach(order => {
    const tags = (order.tags as string[] | null) || []
    // Si no tiene tags o el array está vacío, es un pedido online
    if (!tags || tags.length === 0) {
      onlineOrders.push(order)
    } else {
      storeOrders.push(order)
    }
  })

  // Para pedidos en tienda, relacionarlos con citas de Acuity
  let ordersFromMedicion = 0
  let ordersFromFitting = 0
  let ordersWithoutAppointment = 0

  if (storeOrders.length > 0) {
    // Obtener emails únicos de clientes que compraron en tienda
    const customerEmails = [...new Set(storeOrders.map(o => o.customer_email).filter(Boolean))]

    if (customerEmails.length > 0) {
      // Obtener todas las citas relevantes (90 días antes del inicio del mes hasta 7 días después del final)
      // Ampliar ventana para capturar más citas (medición puede ser varios meses antes de la compra)
      const appointmentsSearchStart = subDays(monthStart, 90)
      const appointmentsSearchEnd = new Date(monthEnd)
      appointmentsSearchEnd.setDate(appointmentsSearchEnd.getDate() + 7)

      const { data: allAppointments } = await supabase
        .from('acuity_appointments')
        .select('customer_email, appointment_category, datetime')
        .in('customer_email', customerEmails)
        .gte('datetime', appointmentsSearchStart.toISOString())
        .lte('datetime', appointmentsSearchEnd.toISOString())
        .neq('status', 'canceled')
        .order('datetime', { ascending: false })

      // Crear un mapa de email -> cita más reciente antes del pedido
      const appointmentsByEmail = new Map<string, { category: 'medición' | 'fitting'; datetime: string }>()

      if (allAppointments && allAppointments.length > 0) {
        storeOrders.forEach(order => {
          if (!order.customer_email) return

          const orderDate = parseISO(order.created_at)
          // Ampliar ventana de búsqueda: buscar citas hasta 90 días antes del pedido
          const relevantAppointments = (allAppointments as any[])
            .filter((apt: any) =>
              apt.customer_email === order.customer_email &&
              parseISO(apt.datetime) <= orderDate &&
              parseISO(apt.datetime) >= subDays(orderDate, 90)
            )
            .sort((a: any, b: any) => parseISO(b.datetime).getTime() - parseISO(a.datetime).getTime())

          if (relevantAppointments.length > 0) {
            const latestAppointment = relevantAppointments[0]
            // Solo guardar si no existe o si esta cita es más reciente
            const existing = appointmentsByEmail.get(order.customer_email)
            if (!existing || parseISO(latestAppointment.datetime) > parseISO(existing.datetime)) {
              appointmentsByEmail.set(order.customer_email, {
                category: latestAppointment.appointment_category as 'medición' | 'fitting',
                datetime: latestAppointment.datetime,
              })
            }
          }
        })
      }

      // Función para inferir tipo de cita desde los tags de Shopify
      const inferAppointmentTypeFromTags = (tags: string[] | null): 'medición' | 'fitting' => {
        if (!tags || tags.length === 0) {
          return 'medición' // Default si no hay tags
        }

        const tagsLower = tags.map(t => t.toLowerCase())
        
        // INDICADORES DE MEDICIÓN (primera visita)
        // 1. Cliente nuevo → definitivamente medición
        if (tagsLower.some(t => t.includes('nuevo cliente'))) {
          return 'medición'
        }

        // 2. Motivos que sugieren primera compra
        const firstTimePurchaseMotives = [
          'su propia boda',
          'laboral',
          'boda o celebración ajena'
        ]
        const hasFirstTimeMotive = tagsLower.some(t => 
          firstTimePurchaseMotives.some(motive => t.includes(motive))
        )

        // INDICADORES DE FITTING (segunda visita, ajustes)
        // 1. Cliente recurrente → más probable fitting
        const isRecurrent = tagsLower.some(t => t.includes('recurrente'))
        
        // 2. Motivos que sugieren compra recurrente
        const recurrentMotives = [
          'diario por gusto',
          'ocasional para ocio'
        ]
        const hasRecurrentMotive = tagsLower.some(t => 
          recurrentMotives.some(motive => t.includes(motive))
        )

        // LÓGICA DE DECISIÓN:
        // Si es recurrente Y tiene motivo recurrente → FITTING
        if (isRecurrent && hasRecurrentMotive) {
          return 'fitting'
        }
        
        // Si es recurrente pero con motivo de primera compra → MEDICIÓN (nuevo traje)
        if (isRecurrent && hasFirstTimeMotive) {
          return 'medición'
        }

        // Si es recurrente sin más info → FITTING (probablemente ajuste)
        if (isRecurrent) {
          return 'fitting'
        }

        // Por defecto: MEDICIÓN (es el 74% de las citas y el primer paso)
        return 'medición'
      }

      // Contar pedidos en tienda por tipo de cita
      storeOrders.forEach(order => {
        const appointment = appointmentsByEmail.get(order.customer_email)
        
        if (!appointment) {
          // Sin cita encontrada en BD: inferir desde tags
          const inferredType = inferAppointmentTypeFromTags(order.tags as string[] | null)
          if (inferredType === 'medición') {
            ordersFromMedicion++
          } else {
            ordersFromFitting++
          }
        } else if (appointment.category === 'medición') {
          ordersFromMedicion++
        } else if (appointment.category === 'fitting') {
          ordersFromFitting++
        } else {
          // Categoría desconocida: inferir desde tags
          const inferredType = inferAppointmentTypeFromTags(order.tags as string[] | null)
          if (inferredType === 'medición') {
            ordersFromMedicion++
          } else {
            ordersFromFitting++
          }
        }
      })
    } else {
      // Si no hay emails, todos los pedidos en tienda son sin cita
      ordersWithoutAppointment = storeOrders.length
    }
  }

  return {
    totalOrders: currentOrders.length,
    ordersOnline: onlineOrders.length,
    ordersFromMedicion,
    ordersFromFitting,
    ordersWithoutAppointment,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verificar integraciones
    const [shopifyConnected, metaConnected, analyticsConnected, acuityConnected] = await Promise.all([
      checkIntegrationStatus(supabase, 'shopify'),
      checkIntegrationStatus(supabase, 'meta'),
      checkIntegrationStatus(supabase, 'analytics'),
      checkIntegrationStatus(supabase, 'acuity'),
    ])

    // Obtener período del query string (default: daily)
    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') as 'daily' | 'weekly' | 'monthly') || 'daily'

    // Cargar datos en paralelo
    const promises: Promise<any>[] = []

    if (shopifyConnected) {
      promises.push(getShopifySales(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching Shopify sales:', err)
        return { salesYesterday: 0, salesMonth: 0 }
      }))
    } else {
      promises.push(Promise.resolve({ salesYesterday: 0, salesMonth: 0 }))
    }

    if (metaConnected) {
      promises.push(getMetaAdsSpend(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching Meta ads spend:', err)
        return { adsSpendYesterday: 0, adsSpendMonth: 0 }
      }))
    } else {
      promises.push(Promise.resolve({ adsSpendYesterday: 0, adsSpendMonth: 0 }))
    }

    if (acuityConnected) {
      promises.push(getAcuityAppointments(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching Acuity appointments:', err)
        return { appointmentsYesterday: 0, appointmentsMonth: 0 }
      }))
    } else {
      promises.push(Promise.resolve({ appointmentsYesterday: 0, appointmentsMonth: 0 }))
    }

    if (shopifyConnected && metaConnected) {
      promises.push(getAccumulatedROAS(supabase).catch((err) => {
        console.error('[Dashboard] Error calculating ROAS:', err)
        return 0
      }))
    } else {
      promises.push(Promise.resolve(0))
    }

    const [shopifyData, metaData, acuityData, roas] = await Promise.all(promises)

    // Construir KPIs
    const kpis = {
      salesYesterday: shopifyData.salesYesterday,
      salesMonth: shopifyData.salesMonth,
      adsSpendYesterday: metaData.adsSpendYesterday,
      adsSpendMonth: metaData.adsSpendMonth,
      appointmentsYesterday: acuityData.appointmentsYesterday,
      appointmentsMonth: acuityData.appointmentsMonth,
      roasAccumulated: roas,
    }

    // Cargar datos adicionales
    const [dailyRevenue, salesVsInvestment, storeOccupation, topVIP, alerts, ctrByCitas, ordersBreakdown] = await Promise.all([
      getDailyRevenueThisMonth(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching daily revenue:', err)
        return []
      }),
      getSalesVsInvestment(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching sales vs investment:', err)
        return []
      }),
      getStoreOccupationToday(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching store occupation:', err)
        return []
      }),
      getTopVIPCustomers(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching VIP customers:', err)
        return []
      }),
      generateIntelligentAlerts(supabase, kpis).catch((err) => {
        console.error('[Dashboard] Error generating alerts:', err)
        return []
      }),
      getCTRByCitasCampaigns(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching CTR by citas campaigns:', err)
        return []
      }),
      getOrdersBreakdown(supabase).catch((err) => {
        console.error('[Dashboard] Error fetching orders breakdown:', err)
        return { totalOrders: 0, ordersOnline: 0, ordersFromMedicion: 0, ordersFromFitting: 0, ordersWithoutAppointment: 0 }
      }),
    ])

    const response: DashboardResponse = {
      kpis,
      dailyRevenue,
      salesVsInvestment,
      storeOccupation,
      topVIPCustomers: topVIP,
      alerts,
      period,
      ctrByCitasCampaigns: ctrByCitas,
      ordersBreakdown,
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

