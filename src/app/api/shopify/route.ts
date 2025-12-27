import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { subDays, format, parseISO, differenceInDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ShopifyCustomer, ShopifyCustomerMetrics, ShopifyLocationMetrics, ShopifyEmployeeMetrics } from '@/types'
import { normalizeStoreName } from '@/lib/integrations/acuity'

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

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'orders' // orders, metrics, products, charts, customers, customer-metrics, locations, location-employees, analytics, analytics-funnel

    switch (type) {
      case 'orders':
        return getOrders(supabase, searchParams)
      case 'metrics':
        return getMetrics(supabase, searchParams)
      case 'products':
        return getProducts(supabase, searchParams)
      case 'complements':
        return getComplements(supabase, searchParams)
      case 'charts':
        return getCharts(supabase, searchParams)
      case 'monthly-revenue':
        return getMonthlyRevenue(supabase, searchParams)
      case 'customers':
        return getCustomers(supabase, searchParams)
      case 'customer-metrics':
        return getCustomerMetrics(supabase, searchParams)
      case 'locations':
        return getLocations(supabase, searchParams)
      case 'location-employees':
        return getLocationEmployees(supabase, searchParams)
      case 'analytics':
        return getAnalytics(supabase, searchParams)
      case 'analytics-funnel':
        return getAnalyticsFunnel(supabase, searchParams)
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: orders, metrics, products, charts, customers, customer-metrics, locations, location-employees, analytics, analytics-funnel' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Error fetching Shopify data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Shopify data', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

async function getOrders(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const limit = parseInt(searchParams.get('limit') || '100', 10)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const status = searchParams.get('status') // all, paid, pending, refunded
  const search = searchParams.get('search')

  let query = supabase
    .from('shopify_orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (startDate) {
    // Asegurar que incluya todo el día desde 00:00:00
    const start = parseISO(startDate)
    start.setHours(0, 0, 0, 0)
    query = query.gte('created_at', start.toISOString())
  }
  if (endDate) {
    // Asegurar que incluya todo el día hasta 23:59:59
    const end = parseISO(endDate)
    end.setHours(23, 59, 59, 999)
    query = query.lte('created_at', end.toISOString())
  }
  if (status && status !== 'all') {
    query = query.eq('financial_status', status)
  }
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,order_number.ilike.%${search}%,customer_email.ilike.%${search}%`)
  }

  if (!startDate && !endDate) {
    query = query.limit(limit)
  }

  const { data, error } = await query
  const orders = data as Database['public']['Tables']['shopify_orders']['Row'][] | null

  if (error) {
    throw error
  }

  return NextResponse.json({
    success: true,
    data: orders || [],
    count: orders?.length || 0,
  })
}

async function getMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const days = parseInt(searchParams.get('days') || '30', 10)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const today = new Date()
  const periodEnd = endDate ? parseISO(endDate) : today
  periodEnd.setHours(23, 59, 59, 999)
  const periodStart = startDate ? parseISO(startDate) : subDays(periodEnd, days)
  periodStart.setHours(0, 0, 0, 0)
  const previousPeriodStart = subDays(periodStart, days)
  previousPeriodStart.setHours(0, 0, 0, 0)
  const previousPeriodEnd = new Date(periodStart)
  previousPeriodEnd.setHours(23, 59, 59, 999)

  // Obtener datos del período actual (incluyendo customer_email para relacionar con citas)
  const { data: currentData, error: currentError } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, line_items, customer_email, created_at')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  if (currentError) {
    throw currentError
  }

  // Obtener datos del período anterior para comparación
  const { data: previousData, error: previousError } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, line_items, customer_email, created_at')
    .gte('created_at', previousPeriodStart.toISOString())
    .lte('created_at', previousPeriodEnd.toISOString())

  if (previousError) {
    throw previousError
  }

  const currentOrders = (currentData || []) as Database['public']['Tables']['shopify_orders']['Row'][]
  const previousOrders = (previousData || []) as Database['public']['Tables']['shopify_orders']['Row'][]

  // Relacionar pedidos con citas de Acuity para determinar si vienen de medición o fitting
  // Estrategia optimizada: obtener todas las citas relevantes de una vez
  const customerEmails = [...new Set(currentOrders.map(o => o.customer_email).filter(Boolean))]
  
  // Obtener todas las citas de los clientes que tienen pedidos en el período
  // Buscar citas desde 30 días antes del inicio del período hasta 7 días después del final
  const appointmentsSearchStart = subDays(periodStart, 30)
  const appointmentsSearchEnd = new Date(periodEnd)
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
    // Agrupar por email y mantener solo la cita más reciente antes de cada pedido
    currentOrders.forEach(order => {
      if (!order.customer_email) return
      
      const orderDate = parseISO(order.created_at)
      const relevantAppointments = (allAppointments as any[])
        .filter((apt: any) => 
          apt.customer_email === order.customer_email &&
          parseISO(apt.datetime) <= orderDate &&
          parseISO(apt.datetime) >= subDays(orderDate, 30)
        )
        .sort((a: any, b: any) => parseISO(b.datetime).getTime() - parseISO(a.datetime).getTime())
      
      if (relevantAppointments.length > 0) {
        const latestAppointment = relevantAppointments[0]
        appointmentsByEmail.set(order.customer_email, {
          category: latestAppointment.appointment_category as 'medición' | 'fitting',
          datetime: latestAppointment.datetime,
        })
      }
    })
  }

  // Asignar tipo de cita a cada pedido
  const ordersWithAppointmentType = currentOrders.map(order => {
    if (!order.customer_email) {
      return { order, appointmentType: null as 'medición' | 'fitting' | null }
    }
    
    const appointment = appointmentsByEmail.get(order.customer_email)
    return {
      order,
      appointmentType: appointment ? appointment.category : null,
    }
  })

  // Calcular métricas del período actual
  const totalRevenue = currentOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
  const totalOrders = currentOrders.length
  const paidOrders = currentOrders.filter(o => o.financial_status === 'paid')
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Contar pedidos por tipo de cita
  const ordersFromMedicion = ordersWithAppointmentType.filter(
    (item) => item.appointmentType === 'medición'
  ).length
  const ordersFromFitting = ordersWithAppointmentType.filter(
    (item) => item.appointmentType === 'fitting'
  ).length
  const ordersWithoutAppointment = ordersWithAppointmentType.filter(
    (item) => item.appointmentType === null
  ).length

  // Calcular productos vendidos (suma de cantidades en line_items)
  let totalProductsSold = 0
  currentOrders.forEach(order => {
    const lineItems = (order.line_items as any) || []
    lineItems.forEach((item: any) => {
      totalProductsSold += item.quantity || 0
    })
  })

  // Calcular métricas del período anterior
  const previousRevenue = previousOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
  const previousOrdersCount = previousOrders.length
  const previousAOV = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0

  // Obtener datos históricos (todo el tiempo)
  const { data: historicalData, error: historicalError } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, line_items, created_at')

  if (historicalError) {
    console.warn('Error fetching historical data:', historicalError)
  }

  const historicalOrders = (historicalData || []) as Database['public']['Tables']['shopify_orders']['Row'][]
  
  // Calcular métricas históricas
  const historicalRevenue = historicalOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
  const historicalOrdersCount = historicalOrders.length
  let historicalProductsSold = 0
  historicalOrders.forEach(order => {
    const lineItems = (order.line_items as any) || []
    lineItems.forEach((item: any) => {
      historicalProductsSold += item.quantity || 0
    })
  })
  const historicalAOV = historicalOrdersCount > 0 ? historicalRevenue / historicalOrdersCount : 0

  // Obtener gasto de Meta Ads para el período actual
  const { data: currentMetaData } = await supabase
    .from('meta_campaigns')
    .select('spend')
    .gte('date', format(periodStart, 'yyyy-MM-dd'))
    .lte('date', format(periodEnd, 'yyyy-MM-dd'))

  const currentMetaSpend = (currentMetaData || []).reduce((sum, campaign: any) => sum + (Number(campaign.spend) || 0), 0)

  // Obtener gasto de Meta Ads para el período anterior
  const { data: previousMetaData } = await supabase
    .from('meta_campaigns')
    .select('spend')
    .gte('date', format(previousPeriodStart, 'yyyy-MM-dd'))
    .lte('date', format(previousPeriodEnd, 'yyyy-MM-dd'))

  const previousMetaSpend = (previousMetaData || []).reduce((sum, campaign: any) => sum + (Number(campaign.spend) || 0), 0)

  // Calcular ROAS (Revenue / Ad Spend)
  const currentROAS = currentMetaSpend > 0 ? totalRevenue / currentMetaSpend : 0
  const previousROAS = previousMetaSpend > 0 ? previousRevenue / previousMetaSpend : 0
  const roasChange = previousROAS > 0 
    ? ((currentROAS - previousROAS) / previousROAS) * 100 
    : 0

  // Calcular cambios porcentuales
  const revenueChange = previousRevenue > 0 
    ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
    : 0
  const ordersChange = previousOrdersCount > 0
    ? ((totalOrders - previousOrdersCount) / previousOrdersCount) * 100
    : 0
  const aovChange = previousAOV > 0
    ? ((averageOrderValue - previousAOV) / previousAOV) * 100
    : 0

  // Calcular promedio histórico (promedio por período de la misma duración)
  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Obtener el rango de fechas histórico para calcular el promedio diario
  let totalHistoricalDays = 1
  if (historicalOrders.length > 0) {
    const historicalDates = historicalOrders
      .map(o => o.created_at ? parseISO(o.created_at).getTime() : null)
      .filter((date): date is number => date !== null)
    
    if (historicalDates.length > 0) {
      const minDate = Math.min(...historicalDates)
      const maxDate = Math.max(...historicalDates)
      totalHistoricalDays = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1)
    }
  }
  
  const averageDailyHistoricalRevenue = totalHistoricalDays > 0 ? historicalRevenue / totalHistoricalDays : 0
  const averageDailyHistoricalOrders = totalHistoricalDays > 0 ? historicalOrdersCount / totalHistoricalDays : 0
  const averageDailyHistoricalProducts = totalHistoricalDays > 0 ? historicalProductsSold / totalHistoricalDays : 0
  
  const averageHistoricalRevenueForPeriod = averageDailyHistoricalRevenue * daysDiff
  const averageHistoricalOrdersForPeriod = averageDailyHistoricalOrders * daysDiff
  const averageHistoricalProductsForPeriod = averageDailyHistoricalProducts * daysDiff

  // Calcular cambios vs histórico (comparar con el promedio histórico para el mismo período)
  const revenueChangeHistorical = averageHistoricalRevenueForPeriod > 0
    ? ((totalRevenue - averageHistoricalRevenueForPeriod) / averageHistoricalRevenueForPeriod) * 100
    : 0
  const ordersChangeHistorical = averageHistoricalOrdersForPeriod > 0
    ? ((totalOrders - averageHistoricalOrdersForPeriod) / averageHistoricalOrdersForPeriod) * 100
    : 0
  const aovChangeHistorical = historicalAOV > 0
    ? ((averageOrderValue - historicalAOV) / historicalAOV) * 100
    : 0
  const productsSoldChangeHistorical = averageHistoricalProductsForPeriod > 0
    ? ((totalProductsSold - averageHistoricalProductsForPeriod) / averageHistoricalProductsForPeriod) * 100
    : 0

  return NextResponse.json({
    success: true,
    data: {
      totalRevenue,
      revenueChange: Math.round(revenueChange * 100) / 100,
      revenueChangeHistorical: Math.round(revenueChangeHistorical * 100) / 100,
      historicalRevenue: averageHistoricalRevenueForPeriod > 0 ? averageHistoricalRevenueForPeriod : null,
      previousRevenue: previousRevenue > 0 ? previousRevenue : null,
      totalOrders,
      ordersChange: Math.round(ordersChange * 100) / 100,
      ordersChangeHistorical: Math.round(ordersChangeHistorical * 100) / 100,
      historicalOrders: averageHistoricalOrdersForPeriod > 0 ? Math.round(averageHistoricalOrdersForPeriod) : null,
      previousOrdersCount: previousOrdersCount > 0 ? previousOrdersCount : null,
      // Desglose de pedidos por tipo de cita
      ordersFromMedicion,
      ordersFromFitting,
      ordersWithoutAppointment,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      aovChange: Math.round(aovChange * 100) / 100,
      aovChangeHistorical: Math.round(aovChangeHistorical * 100) / 100,
      historicalAOV: historicalAOV > 0 ? historicalAOV : null,
      previousAOV: previousAOV > 0 ? previousAOV : null,
      totalProductsSold,
      productsSoldChangeHistorical: Math.round(productsSoldChangeHistorical * 100) / 100,
      historicalProductsSold: averageHistoricalProductsForPeriod > 0 ? Math.round(averageHistoricalProductsForPeriod) : null,
      roas: Math.round(currentROAS * 100) / 100,
      roasChange: Math.round(roasChange * 100) / 100,
      previousROAS: previousROAS > 0 ? Math.round(previousROAS * 100) / 100 : null,
      metaSpend: currentMetaSpend,
      previousMetaSpend: previousMetaSpend > 0 ? previousMetaSpend : null,
      paidOrders: paidOrders.length,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      previousPeriod: {
        start: previousPeriodStart.toISOString(),
        end: previousPeriodEnd.toISOString(),
      },
    },
  })
}

async function getProducts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const filterType = searchParams.get('filterType') || 'monthly' // 'monthly' or 'total'

  let query = supabase
    .from('shopify_orders')
    .select('line_items, created_at')
    .order('created_at', { ascending: false })

  // Solo filtrar por fecha si es mensual, si es total no filtrar
  if (filterType === 'monthly') {
    if (startDate) {
      // Asegurar que incluya todo el día desde 00:00:00
      const start = parseISO(startDate)
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    }
    if (endDate) {
      // Asegurar que incluya todo el día hasta 23:59:59
      const end = parseISO(endDate)
      end.setHours(23, 59, 59, 999)
      query = query.lte('created_at', end.toISOString())
    }
  }

  const { data, error } = await query
  const orders = data as Database['public']['Tables']['shopify_orders']['Row'][] | null

  if (error) {
    throw error
  }

  // Agrupar productos por product_id o title y calcular ingresos y ventas
  const productMap = new Map<string, {
    name: string
    sales: number
    revenue: number
    productId?: string
  }>()

  ;(orders || []).forEach(order => {
    const lineItems = (order.line_items as any) || []
    lineItems.forEach((item: any) => {
      const key = item.product_id || item.title
      const existing = productMap.get(key) || {
        name: item.title || 'Producto sin nombre',
        sales: 0,
        revenue: 0,
        productId: item.product_id,
      }
      existing.sales += item.quantity || 0
      existing.revenue += (item.price || 0) * (item.quantity || 0)
      productMap.set(key, existing)
    })
  })

  // Convertir a array y ordenar por ingresos
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)

  return NextResponse.json({
    success: true,
    data: topProducts,
    count: topProducts.length,
  })
}

async function getComplements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const filterType = searchParams.get('filterType') || 'total' // 'monthly' or 'total'

  // Lista de complementos según la imagen y los productos que aparecen en la tabla
  // Incluimos variantes y términos relacionados
  const complementsList = [
    'Corbata', 'Corbatas', 'Gemelo', 'Gemelos', 'Pañuelo', 'Pañuelos',
    'Tirante', 'Tirantes', 'Ballena', 'Ballenas', 'Zapato', 'Zapatos',
    'Calcetín', 'Calcetines', 'Pajarita', 'Fajín', 'Cinturón', 'Cinturones',
    'Guante', 'Guantes', 'Cartera', 'Carteras', 'Portatraje', 'Portatrajes',
    'Pack', 'Packs', 'Tarjeta Regalo', 'Tarjeta', 'Regalo', 'Oxford'
  ]

  let query = supabase
    .from('shopify_orders')
    .select('line_items, created_at')
    .order('created_at', { ascending: false })

  // Si es mensual, usar el período del filtro de fechas
  // Si es total, no filtrar por fecha
  if (filterType === 'monthly') {
    if (startDate) {
      const start = parseISO(startDate)
      start.setHours(0, 0, 0, 0)
      query = query.gte('created_at', start.toISOString())
    }
    if (endDate) {
      const end = parseISO(endDate)
      end.setHours(23, 59, 59, 999)
      query = query.lte('created_at', end.toISOString())
    }
  }

  const { data, error } = await query
  const orders = data as Database['public']['Tables']['shopify_orders']['Row'][] | null

  if (error) {
    throw error
  }

  // Agrupar complementos por título
  const complementMap = new Map<string, {
    name: string
    sales: number
    revenue: number
  }>()

  ;(orders || []).forEach(order => {
    const lineItems = (order.line_items as any) || []
    lineItems.forEach((item: any) => {
      const title = item.title || ''
      const titleLower = title.toLowerCase()
      
      // Buscar si el producto es un complemento
      // Buscar el complemento más largo que coincida (para evitar coincidencias parciales)
      const matchingComplement = complementsList
        .filter(c => titleLower.includes(c.toLowerCase()))
        .sort((a, b) => b.length - a.length)[0] // Ordenar por longitud descendente

      if (matchingComplement) {
        // Agrupar por categoría (ej: todas las "Corbata" en una, todas las "Tirante" en otra)
        // Normalizar el nombre de la categoría (usar singular)
        let categoryName = matchingComplement
        // Normalizar plurales a singular
        const categoryMap: { [key: string]: string } = {
          'Corbatas': 'Corbata',
          'Gemelos': 'Gemelo',
          'Pañuelos': 'Pañuelo',
          'Tirantes': 'Tirante',
          'Ballenas': 'Ballena',
          'Zapatos': 'Zapato',
          'Calcetines': 'Calcetín',
          'Cinturones': 'Cinturón',
          'Guantes': 'Guante',
          'Carteras': 'Cartera',
          'Portatrajes': 'Portatraje',
          'Packs': 'Pack',
          'Tarjeta Regalo': 'Tarjeta Regalo',
          'Tarjeta': 'Tarjeta Regalo',
          'Regalo': 'Tarjeta Regalo',
          'Oxford': 'Oxford',
        }
        categoryName = categoryMap[categoryName] || categoryName

        const key = categoryName

        const existing = complementMap.get(key) || {
          name: categoryName,
          sales: 0,
          revenue: 0,
        }
        existing.sales += item.quantity || 0
        existing.revenue += (item.price || 0) * (item.quantity || 0)
        complementMap.set(key, existing)
      }
    })
  })

  // Convertir a array y ordenar por ingresos
  const topComplements = Array.from(complementMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)

  return NextResponse.json({
    success: true,
    data: topComplements,
    count: topComplements.length,
  })
}

async function getCharts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const days = parseInt(searchParams.get('days') || '30', 10)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const today = new Date()
  const periodEnd = endDate ? parseISO(endDate) : today
  periodEnd.setHours(23, 59, 59, 999)
  const periodStart = startDate ? parseISO(startDate) : subDays(periodEnd, days)
  periodStart.setHours(0, 0, 0, 0)

  // Obtener todos los pedidos del período
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('total_price, created_at')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  const orders = (data || []) as Database['public']['Tables']['shopify_orders']['Row'][]

  // Agrupar por fecha
  const dailyRevenue = new Map<string, number>()

  orders.forEach(order => {
    const date = format(parseISO(order.created_at), 'yyyy-MM-dd')
    const revenue = Number(order.total_price) || 0
    const existing = dailyRevenue.get(date) || 0
    dailyRevenue.set(date, existing + revenue)
  })

  // Convertir a array y ordenar por fecha
  const chartData = Array.from(dailyRevenue.entries())
    .map(([date, value]) => ({
      date,
      value: Math.round(value * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    success: true,
    data: chartData,
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
  })
}

async function getMonthlyRevenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  // Obtener últimos 12 meses
  const months = parseInt(searchParams.get('months') || '12', 10)
  const today = new Date()
  const startMonth = startOfMonth(subMonths(today, months - 1))
  startMonth.setHours(0, 0, 0, 0)
  const endMonth = endOfMonth(today)
  endMonth.setHours(23, 59, 59, 999)

  // Generar todos los meses del período (últimos 12 meses)
  const allMonths: string[] = []
  for (let i = 0; i < months; i++) {
    const monthDate = startOfMonth(subMonths(today, months - 1 - i))
    allMonths.push(format(monthDate, 'yyyy-MM'))
  }

  // Obtener todos los pedidos del período
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('total_price, created_at')
    .gte('created_at', startMonth.toISOString())
    .lte('created_at', endMonth.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  const orders = (data || []) as Database['public']['Tables']['shopify_orders']['Row'][]

  // Agrupar por mes (YYYY-MM)
  const monthlyRevenue = new Map<string, number>()

  orders.forEach(order => {
    const date = parseISO(order.created_at)
    const monthKey = format(date, 'yyyy-MM')
    const revenue = Number(order.total_price) || 0
    const existing = monthlyRevenue.get(monthKey) || 0
    monthlyRevenue.set(monthKey, existing + revenue)
  })

  // Crear datos para todos los meses, usando 0 si no hay datos
  // Formatear como abreviaturas de mes en español (ENE, FEB, MAR, etc.)
  const monthAbbr: { [key: string]: string } = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DIC'
  }

  const chartData = allMonths.map(monthKey => {
    const [year, month] = monthKey.split('-')
    const monthAbbrev = monthAbbr[month] || month
    return {
      date: monthAbbrev,
      value: Math.round((monthlyRevenue.get(monthKey) || 0) * 100) / 100,
    }
  })

  return NextResponse.json({
    success: true,
    data: chartData,
  })
}

// ============================================
// NEW ENDPOINTS: CUSTOMERS
// ============================================

async function getCustomers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const emailFilter = searchParams.get('email') // Filtro por email
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  // Obtener todos los pedidos (sin filtro de fecha para histórico completo)
  let query = supabase
    .from('shopify_orders')
    .select('customer_email, customer_name, total_price, created_at, tags')
    .order('created_at', { ascending: false })

  if (emailFilter) {
    query = query.ilike('customer_email', `%${emailFilter}%`)
  }

  const { data: allOrders, error } = await query
  if (error) {
    throw error
  }

  const orders = (allOrders || []) as Database['public']['Tables']['shopify_orders']['Row'][]

  // Agrupar por email de cliente
  const customerMap = new Map<string, {
    email: string
    name: string
    totalSpent: number
    orderCount: number
    lastOrderDate: string
    firstOrderDate: string
    city: string | null
    orders: Array<{ date: string; amount: number }>
  }>()

  orders.forEach(order => {
    const email = order.customer_email
    const existing = customerMap.get(email) || {
      email,
      name: order.customer_name || email,
      totalSpent: 0,
      orderCount: 0,
      lastOrderDate: '',
      firstOrderDate: '',
      city: null,
      orders: [],
    }

    existing.totalSpent += Number(order.total_price) || 0
    existing.orderCount += 1
    const orderDate = order.created_at

    // Extraer ciudad de los tags si no la tenemos aún
    if (!existing.city) {
      const tags = (order as any).tags as string[] | null
      existing.city = extractLocationFromTags(tags)
    }

    if (!existing.lastOrderDate || orderDate > existing.lastOrderDate) {
      existing.lastOrderDate = orderDate
    }
    if (!existing.firstOrderDate || orderDate < existing.firstOrderDate) {
      existing.firstOrderDate = orderDate
    }
    existing.orders.push({
      date: orderDate,
      amount: Number(order.total_price) || 0,
    })

    customerMap.set(email, existing)
  })

  // Filtrar por período si se especifica
  const periodStart = startDate ? parseISO(startDate) : null
  const periodEnd = endDate ? parseISO(endDate) : null

  // Convertir a array y calcular métricas adicionales
  const now = new Date()
  const INACTIVE_DAYS_THRESHOLD = 180 // 180 días para cliente inactivo
  const VIP_THRESHOLD = 2000 // €2,000 para VIP

  let customers: ShopifyCustomer[] = Array.from(customerMap.values()).map(customer => {
    const lastOrderDate = parseISO(customer.lastOrderDate)
    const daysSinceLastOrder = differenceInDays(now, lastOrderDate)
    const status: 'active' | 'inactive' = daysSinceLastOrder < INACTIVE_DAYS_THRESHOLD ? 'active' : 'inactive'
    const isVip = customer.totalSpent >= VIP_THRESHOLD

    // Determinar si es nuevo en el período
    const isNew = periodStart && parseISO(customer.firstOrderDate) >= periodStart
    // Es recurrente si tiene más de 1 pedido
    const isRecurring = customer.orderCount > 1

    return {
      email: customer.email,
      name: customer.name,
      totalSpent: Math.round(customer.totalSpent * 100) / 100,
      orderCount: customer.orderCount,
      lastOrderDate: customer.lastOrderDate,
      status,
      isVip,
      isNew: !!isNew,
      isRecurring,
      city: customer.city || null,
    }
  })

  // Aplicar filtro de período si existe (solo para nuevos clientes o estadísticas)
  if (periodStart && periodEnd) {
    // Mantener todos los clientes pero marcar correctamente isNew
    customers = customers.map(customer => {
      const firstOrderDate = customerMap.get(customer.email)?.firstOrderDate
      const isNew = firstOrderDate && parseISO(firstOrderDate) >= periodStart && parseISO(firstOrderDate) <= periodEnd
      return { ...customer, isNew: !!isNew }
    })
  }

  // Ordenar por total gastado (descendente)
  customers.sort((a, b) => b.totalSpent - a.totalSpent)

  // Aplicar paginación
  const paginatedCustomers = customers.slice(offset, offset + limit)

  return NextResponse.json({
    success: true,
    data: paginatedCustomers,
    count: paginatedCustomers.length,
    total: customers.length,
  })
}

async function getCustomerMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const today = new Date()
  const periodEnd = endDate ? parseISO(endDate) : today
  periodEnd.setHours(23, 59, 59, 999)
  const periodStart = startDate ? parseISO(startDate) : subDays(periodEnd, 30)
  periodStart.setHours(0, 0, 0, 0)

  // Calcular período anterior
  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
  const previousPeriodStart = subDays(periodStart, daysDiff)
  previousPeriodStart.setHours(0, 0, 0, 0)
  const previousPeriodEnd = new Date(periodStart)
  previousPeriodEnd.setHours(23, 59, 59, 999)

  // Obtener pedidos del período actual
  const { data: currentOrdersData, error: currentError } = await supabase
    .from('shopify_orders')
    .select('customer_email, total_price, created_at')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  if (currentError) {
    throw currentError
  }

  // Obtener pedidos del período anterior
  const { data: previousOrdersData, error: previousError } = await supabase
    .from('shopify_orders')
    .select('customer_email, total_price, created_at')
    .gte('created_at', previousPeriodStart.toISOString())
    .lte('created_at', previousPeriodEnd.toISOString())

  if (previousError) {
    throw previousError
  }

  // Obtener todos los pedidos históricos
  const { data: historicalOrdersData, error: historicalError } = await supabase
    .from('shopify_orders')
    .select('customer_email, total_price, created_at')

  if (historicalError) {
    console.warn('Error fetching historical customer data:', historicalError)
  }

  const currentOrders = (currentOrdersData || []) as Database['public']['Tables']['shopify_orders']['Row'][]
  const previousOrders = (previousOrdersData || []) as Database['public']['Tables']['shopify_orders']['Row'][]
  const historicalOrders = (historicalOrdersData || []) as Database['public']['Tables']['shopify_orders']['Row'][]

  // Función para calcular métricas de un conjunto de pedidos
  const calculateMetrics = (orders: typeof currentOrders, periodStartDate?: Date, periodEndDate?: Date) => {
    const customerMap = new Map<string, {
      totalSpent: number
      orderCount: number
      firstOrderDate: string
    }>()

    orders.forEach(order => {
      const email = order.customer_email
      const existing = customerMap.get(email) || {
        totalSpent: 0,
        orderCount: 0,
        firstOrderDate: order.created_at,
      }

      existing.totalSpent += Number(order.total_price) || 0
      existing.orderCount += 1
      if (order.created_at < existing.firstOrderDate) {
        existing.firstOrderDate = order.created_at
      }

      customerMap.set(email, existing)
    })

    const customers = Array.from(customerMap.values())
    const totalCustomers = customers.length
    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0)
    const averageCustomerValue = totalCustomers > 0 ? totalSpent / totalCustomers : 0

    const newCustomers = periodStartDate && periodEndDate
      ? customers.filter(c => {
          const firstOrderDate = parseISO(c.firstOrderDate)
          return firstOrderDate >= periodStartDate && firstOrderDate <= periodEndDate
        }).length
      : 0

    const recurringCustomers = customers.filter(c => c.orderCount > 1).length
    const retentionRate = totalCustomers > 0 ? (recurringCustomers / totalCustomers) * 100 : 0
    const vipCustomersCount = customers.filter(c => c.totalSpent >= 2000).length

    return {
      totalCustomers,
      newCustomers,
      recurringCustomers,
      retentionRate,
      averageCustomerValue,
      vipCustomersCount,
    }
  }

  // Calcular métricas del período actual
  const currentMetrics = calculateMetrics(currentOrders, periodStart, periodEnd)
  
  // Calcular métricas del período anterior
  const previousMetrics = calculateMetrics(previousOrders, previousPeriodStart, previousPeriodEnd)

  // Calcular métricas históricas (promedio por período similar)
  const historicalMetrics = calculateMetrics(historicalOrders)
  const historicalDays = historicalOrders.length > 0
    ? Math.max(1, Math.ceil((new Date().getTime() - parseISO(historicalOrders[historicalOrders.length - 1]?.created_at || new Date().toISOString()).getTime()) / (1000 * 60 * 60 * 24)))
    : 1
  const averageDailyHistoricalCustomers = historicalDays > 0 ? historicalMetrics.totalCustomers / historicalDays : 0
  const averageHistoricalCustomersForPeriod = averageDailyHistoricalCustomers * daysDiff

  // Calcular cambios porcentuales
  const totalCustomersChange = previousMetrics.totalCustomers > 0
    ? ((currentMetrics.totalCustomers - previousMetrics.totalCustomers) / previousMetrics.totalCustomers) * 100
    : 0
  const newCustomersChange = previousMetrics.newCustomers > 0
    ? ((currentMetrics.newCustomers - previousMetrics.newCustomers) / previousMetrics.newCustomers) * 100
    : 0
  const recurringCustomersChange = previousMetrics.recurringCustomers > 0
    ? ((currentMetrics.recurringCustomers - previousMetrics.recurringCustomers) / previousMetrics.recurringCustomers) * 100
    : 0
  const retentionRateChange = previousMetrics.retentionRate > 0
    ? ((currentMetrics.retentionRate - previousMetrics.retentionRate) / previousMetrics.retentionRate) * 100
    : 0
  const averageCustomerValueChange = previousMetrics.averageCustomerValue > 0
    ? ((currentMetrics.averageCustomerValue - previousMetrics.averageCustomerValue) / previousMetrics.averageCustomerValue) * 100
    : 0

  // Calcular cambios vs histórico
  const totalCustomersChangeHistorical = averageHistoricalCustomersForPeriod > 0
    ? ((currentMetrics.totalCustomers - averageHistoricalCustomersForPeriod) / averageHistoricalCustomersForPeriod) * 100
    : 0

  return NextResponse.json({
    success: true,
    data: {
      totalCustomers: currentMetrics.totalCustomers,
      totalCustomersChange: Math.round(totalCustomersChange * 100) / 100,
      totalCustomersChangeHistorical: Math.round(totalCustomersChangeHistorical * 100) / 100,
      previousTotalCustomers: previousMetrics.totalCustomers > 0 ? previousMetrics.totalCustomers : null,
      historicalTotalCustomers: averageHistoricalCustomersForPeriod > 0 ? Math.round(averageHistoricalCustomersForPeriod) : null,
      newCustomers: currentMetrics.newCustomers,
      newCustomersChange: Math.round(newCustomersChange * 100) / 100,
      previousNewCustomers: previousMetrics.newCustomers > 0 ? previousMetrics.newCustomers : null,
      recurringCustomers: currentMetrics.recurringCustomers,
      recurringCustomersChange: Math.round(recurringCustomersChange * 100) / 100,
      previousRecurringCustomers: previousMetrics.recurringCustomers > 0 ? previousMetrics.recurringCustomers : null,
      retentionRate: Math.round(currentMetrics.retentionRate * 100) / 100,
      retentionRateChange: Math.round(retentionRateChange * 100) / 100,
      previousRetentionRate: previousMetrics.retentionRate > 0 ? Math.round(previousMetrics.retentionRate * 100) / 100 : null,
      averageCustomerValue: Math.round(currentMetrics.averageCustomerValue * 100) / 100,
      averageCustomerValueChange: Math.round(averageCustomerValueChange * 100) / 100,
      previousAverageCustomerValue: previousMetrics.averageCustomerValue > 0 ? Math.round(previousMetrics.averageCustomerValue * 100) / 100 : null,
      vipCustomersCount: currentMetrics.vipCustomersCount,
    },
  })
}

// ============================================
// NEW ENDPOINTS: LOCATIONS
// ============================================

/**
 * Extrae la tienda desde los tags del pedido
 * Busca patrones comunes: "Tienda: X", "X" donde X es una ubicación conocida
 */
function extractLocationFromTags(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null

  // Ubicaciones conocidas
  const knownLocations = ['Madrid', 'Sevilla', 'Málaga', 'Malaga', 'Barcelona', 'Bilbao', 'Valencia', 'Murcia', 'Zaragoza', 'México', 'Mexico']

  // Buscar en los tags
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim()
    
    // Buscar formato "Tienda: X"
    if (tagLower.startsWith('tienda:')) {
      const location = tag.substring(7).trim()
      return location || null
    }

    // Buscar ubicación conocida directamente
    for (const location of knownLocations) {
      if (tagLower === location.toLowerCase() || tagLower.includes(location.toLowerCase())) {
        return location
      }
    }
  }

  return null
}

/**
 * Extrae la ubicación del nombre de una campaña de Meta Ads
 * Busca nombres de ciudades en el nombre de la campaña
 */
function extractLocationFromCampaignName(campaignName: string): string | null {
  if (!campaignName) return null

  const nameLower = campaignName.toLowerCase()
  
  // Ubicaciones conocidas con normalización
  const locationMap: { [key: string]: string } = {
    'madrid': 'Madrid',
    'barcelona': 'Barcelona',
    'sevilla': 'Sevilla',
    'málaga': 'Málaga',
    'malaga': 'Málaga',
    'bilbao': 'Bilbao',
    'valencia': 'Valencia',
    'murcia': 'Murcia',
    'zaragoza': 'Zaragoza',
    'méxico': 'México',
    'mexico': 'México',
  }

  // Buscar coincidencias (case insensitive)
  for (const [key, location] of Object.entries(locationMap)) {
    if (nameLower.includes(key)) {
      return location
    }
  }

  return null
}

/**
 * Extrae el nombre del empleado desde tags con patrón "XXX - Nombre" o "XXX-Nombre"
 * Devuelve un objeto con el código (XXX) y el nombre, o null si no coincide
 */
function extractEmployeeFromTagsPattern(tags: string[] | null | undefined): { code: string; name: string } | null {
  if (!tags || tags.length === 0) return null

  // Patrón: número (2-4 dígitos típicamente) seguido de guión y nombre
  const pattern = /^(\d{2,4})\s*[-–]\s*(.+)$/i
  
  for (const tag of tags) {
    const trimmed = tag.trim()
    const match = trimmed.match(pattern)
    
    if (match) {
      return {
        code: match[1],
        name: match[2].trim()
      }
    }
  }

  return null
}

/**
 * Extrae el vendedor desde los tags del pedido
 * Busca patrones como "Vendedor: X", "X:", "XXX - Nombre", etc.
 */
function extractEmployeeFromTags(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null

  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim()
    
    // Buscar formato "Vendedor: X"
    if (tagLower.startsWith('vendedor:') || tagLower.startsWith('vendedor ')) {
      const employeeValue = tag.substring(9).trim()
      
      // Si el valor tiene formato "XXX - Nombre", extraer solo el nombre
      const patternMatch = extractEmployeeFromTagsPattern([employeeValue])
      if (patternMatch) {
        console.log(`[Shopify API] Detected employee pattern in "Vendedor: ${employeeValue}": code="${patternMatch.code}", name="${patternMatch.name}", returning name: "${patternMatch.name}"`)
        return patternMatch.name
      }
      
      // Si no tiene patrón, devolver el valor completo
      return employeeValue || null
    }

    // Buscar formato "X:" (iniciales o nombre seguido de dos puntos)
    if (tag.includes(':') && tag.length < 20) {
      const parts = tag.split(':')
      if (parts.length === 2 && parts[0].trim().length > 0) {
        return parts[0].trim()
      }
    }
  }

  // Como último recurso, intentar detectar patrón directamente en los tags (sin prefijo "Vendedor:")
  const patternMatch = extractEmployeeFromTagsPattern(tags)
  if (patternMatch) {
    console.log(`[Shopify API] Detected employee pattern: "${patternMatch.code} - ${patternMatch.name}", returning name: "${patternMatch.name}"`)
    return patternMatch.name
  }

  return null
}

/**
 * Normaliza un nombre eliminando tildes y acentos para hacer búsquedas más flexibles
 */
function normalizeNameForSearch(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD') // Descompone caracteres con acentos
    .replace(/[\u0300-\u036f]/g, '') // Elimina las marcas diacríticas (tildes, acentos)
    .trim()
}

/**
 * Correlaciona un nombre de empleado con los datos de Acuity
 * Busca en acuity_calendars por nombre y ubicación
 */
async function correlateEmployeeWithAcuity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeName: string,
  location: string
): Promise<{ name: string; displayName: string } | null> {
  try {
    // Normalizar el nombre del empleado para búsqueda (case insensitive, sin espacios extras, sin tildes)
    const normalizedNameForSearch = normalizeNameForSearch(employeeName)
    const normalizedNameOriginal = employeeName.trim().toLowerCase()
    
    // Normalizar la ubicación para buscar en appointment_type_name
    // Puede ser "Madrid", "Barcelona", etc. y necesitamos buscar en "The Bundclub Madrid", etc.
    const normalizedLocation = normalizeStoreName(location).toLowerCase()

    console.log(`[Shopify API] Correlating employee: "${employeeName}" in location: "${location}" (normalized: "${normalizedLocation}")`)

    // Buscar en acuity_calendars por nombre (name o display_name) - buscar tanto con como sin tildes
    const { data: calendars, error } = await supabase
      .from('acuity_calendars')
      .select('name, display_name, appointment_type_name')
      .eq('is_active', true)
      .or(`name.ilike.%${normalizedNameOriginal}%,display_name.ilike.%${normalizedNameOriginal}%`)

    if (error) {
      console.warn(`[Shopify API] Error correlating employee ${employeeName}:`, error)
      return null
    }

    // Si no encontramos resultados con el nombre original (con tildes), intentar sin tildes
    let finalCalendars: any[] = calendars || []
    if ((!calendars || calendars.length === 0) && normalizedNameForSearch !== normalizedNameOriginal) {
      // Obtener todos los calendarios activos y filtrar manualmente comparando nombres normalizados (sin tildes)
      const { data: allCalendars, error: error2 } = await supabase
        .from('acuity_calendars')
        .select('name, display_name, appointment_type_name')
        .eq('is_active', true)
      
      if (!error2 && allCalendars) {
        finalCalendars = allCalendars.filter((cal: any) => {
          const calNameNormalized = normalizeNameForSearch(cal.name)
          const calDisplayNameNormalized = cal.display_name ? normalizeNameForSearch(cal.display_name) : ''
          // Buscar si el nombre normalizado contiene el nombre buscado (sin tildes)
          return calNameNormalized.includes(normalizedNameForSearch) || calDisplayNameNormalized.includes(normalizedNameForSearch)
        })
        console.log(`[Shopify API] Retrying search without accents for "${employeeName}", found ${finalCalendars.length} matches`)
      }
    }

    if (!finalCalendars || finalCalendars.length === 0) {
      console.log(`[Shopify API] No calendars found for employee: "${employeeName}"`)
      return null
    }

    console.log(`[Shopify API] Found ${finalCalendars.length} calendars matching name "${employeeName}":`, finalCalendars.map((c: any) => ({ name: c.name, display_name: c.display_name, appointment_type_name: c.appointment_type_name })))

    // Filtrar por ubicación - buscar coincidencias en appointment_type_name normalizado
    for (const calendar of finalCalendars as any[]) {
      const appointmentTypeName = calendar.appointment_type_name || ''
      const normalizedAppointmentTypeName = normalizeStoreName(appointmentTypeName).toLowerCase()
      
      // Verificar si el appointment_type_name contiene la ubicación
      if (normalizedAppointmentTypeName.includes(normalizedLocation) || 
          normalizedLocation.includes(normalizedAppointmentTypeName.split(' ').pop() || '')) {
        // Encontramos una coincidencia
        console.log(`[Shopify API] Matched employee "${employeeName}" with calendar "${calendar.name}" in location "${appointmentTypeName}"`)
        return {
          name: calendar.name,
          displayName: calendar.display_name || calendar.name
        }
      }
    }

    // Si no encontramos por ubicación, devolvemos el primero que coincida por nombre
    // (puede que la ubicación no esté bien normalizada)
    if (finalCalendars.length > 0) {
      const firstCalendar = finalCalendars[0] as any
      console.log(`[Shopify API] No location match found, using first name match: "${firstCalendar.name}"`)
      return {
        name: firstCalendar.name,
        displayName: firstCalendar.display_name || firstCalendar.name
      }
    }

    return null
  } catch (error) {
    console.warn(`[Shopify API] Error in correlateEmployeeWithAcuity:`, error)
    return null
  }
}

async function getLocations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const periodStart = startDate ? parseISO(startDate) : subDays(new Date(), 30)
  periodStart.setHours(0, 0, 0, 0)
  const periodEnd = endDate ? parseISO(endDate) : new Date()
  periodEnd.setHours(23, 59, 59, 999)

  // Lista de complementos
  const complementsList = [
    'Corbata', 'Corbatas', 'Gemelo', 'Gemelos', 'Pañuelo', 'Pañuelos',
    'Tirante', 'Tirantes', 'Ballena', 'Ballenas', 'Zapato', 'Zapatos',
    'Calcetín', 'Calcetines', 'Pajarita', 'Fajín', 'Cinturón', 'Cinturones',
    'Guante', 'Guantes', 'Cartera', 'Carteras', 'Portatraje', 'Portatrajes',
    'Pack', 'Packs', 'Tarjeta Regalo', 'Tarjeta', 'Regalo', 'Oxford'
  ]

  const categoryMap: { [key: string]: string } = {
    'Corbatas': 'Corbata',
    'Gemelos': 'Gemelo',
    'Pañuelos': 'Pañuelo',
    'Tirantes': 'Tirante',
    'Ballenas': 'Ballena',
    'Zapatos': 'Zapato',
    'Calcetines': 'Calcetín',
    'Cinturones': 'Cinturón',
    'Guantes': 'Guante',
    'Carteras': 'Cartera',
    'Portatrajes': 'Portatraje',
    'Packs': 'Pack',
    'Tarjeta Regalo': 'Tarjeta Regalo',
    'Tarjeta': 'Tarjeta Regalo',
    'Regalo': 'Tarjeta Regalo',
    'Oxford': 'Oxford',
  }

  // Obtener pedidos del período
  let query = supabase
    .from('shopify_orders')
    .select('tags, total_price, created_at, customer_email, customer_name, line_items')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())
    .order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) {
    throw error
  }

  const orders = (data || []) as Array<Database['public']['Tables']['shopify_orders']['Row']>

  // Obtener campañas de Meta Ads del período
  const { data: metaData } = await supabase
    .from('meta_campaigns')
    .select('campaign_name, spend')
    .gte('date', format(periodStart, 'yyyy-MM-dd'))
    .lte('date', format(periodEnd, 'yyyy-MM-dd'))

  // Agrupar gasto de Meta Ads por ubicación basándome en el nombre de la campaña
  const locationMetaSpendMap = new Map<string, number>()
  
  if (metaData) {
    (metaData as any[]).forEach((campaign: any) => {
      const campaignLocation = extractLocationFromCampaignName(campaign.campaign_name || '')
      if (campaignLocation) {
        const currentSpend = locationMetaSpendMap.get(campaignLocation) || 0
        locationMetaSpendMap.set(campaignLocation, currentSpend + (Number(campaign.spend) || 0))
      }
    })
  }

  // Calcular revenue total para calcular porcentajes
  let totalRevenue = 0

  // Agrupar por ubicación
  const locationMap = new Map<string, {
    revenue: number
    orders: number
    customers: Map<string, { name: string; email: string; revenue: number }>
    complements: Map<string, { name: string; revenue: number; sales: number }>
    dailyRevenue: Map<string, number>
    monthlyRevenue: Map<string, number>
  }>()

  orders.forEach(order => {
    const tags = (order as any).tags as string[] | null
    const location = extractLocationFromTags(tags) || 'Sin ubicación'
    
    if (location === 'Sin ubicación') return // Ignorar pedidos sin ubicación

    const existing = locationMap.get(location) || {
      revenue: 0,
      orders: 0,
      customers: new Map(),
      complements: new Map(),
      dailyRevenue: new Map(),
      monthlyRevenue: new Map(),
    }

    const orderRevenue = Number(order.total_price) || 0
    existing.revenue += orderRevenue
    existing.orders += 1
    totalRevenue += orderRevenue // Acumular para el total

    // Agregar cliente
    const customerEmail = order.customer_email || ''
    const customerName = order.customer_name || customerEmail
    const customerKey = customerEmail || `unknown-${Date.now()}`
    const existingCustomer = existing.customers.get(customerKey) || {
      name: customerName,
      email: customerEmail,
      revenue: 0,
    }
    existingCustomer.revenue += orderRevenue
    existing.customers.set(customerKey, existingCustomer)

    // Procesar complementos de line_items
    const lineItems = (order.line_items as any) || []
    lineItems.forEach((item: any) => {
      const title = item.title || ''
      const titleLower = title.toLowerCase()
      
      const matchingComplement = complementsList
        .filter(c => titleLower.includes(c.toLowerCase()))
        .sort((a, b) => b.length - a.length)[0]

      if (matchingComplement) {
        let categoryName = categoryMap[matchingComplement] || matchingComplement
        const existingComplement = existing.complements.get(categoryName) || {
          name: categoryName,
          revenue: 0,
          sales: 0,
        }
        existingComplement.revenue += (item.price || 0) * (item.quantity || 0)
        existingComplement.sales += item.quantity || 0
        existing.complements.set(categoryName, existingComplement)
      }
    })

    // Agregar revenue diario
    const orderDate = parseISO(order.created_at)
    const dailyKey = format(orderDate, 'yyyy-MM-dd')
    existing.dailyRevenue.set(dailyKey, (existing.dailyRevenue.get(dailyKey) || 0) + orderRevenue)

    // Agregar revenue mensual
    const monthlyKey = format(orderDate, 'yyyy-MM')
    existing.monthlyRevenue.set(monthlyKey, (existing.monthlyRevenue.get(monthlyKey) || 0) + orderRevenue)

    locationMap.set(location, existing)
  })

  // Convertir a array y calcular métricas
  const locations: ShopifyLocationMetrics[] = Array.from(locationMap.entries())
    .map(([location, data]) => {
      // Top 3 clientes
      const topCustomers = Array.from(data.customers.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3)
        .map(c => ({
          name: c.name,
          email: c.email,
          revenue: Math.round(c.revenue * 100) / 100,
        }))

      // Top 3 complementos
      const topComplements = Array.from(data.complements.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3)
        .map(c => ({
          name: c.name,
          revenue: Math.round(c.revenue * 100) / 100,
          sales: c.sales,
        }))

      // Gráfico diario
      const dailyRevenue = Array.from(data.dailyRevenue.entries())
        .map(([date, value]) => ({
          date,
          value: Math.round(value * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Gráfico mensual
      const monthlyRevenue = Array.from(data.monthlyRevenue.entries())
        .map(([date, value]) => ({
          date,
          value: Math.round(value * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Calcular ROAS específico para esta ubicación
      const locationMetaSpend = locationMetaSpendMap.get(location) || 0
      const locationROAS = locationMetaSpend > 0 ? data.revenue / locationMetaSpend : null

      return {
        location,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        averageOrderValue: data.orders > 0 ? Math.round((data.revenue / data.orders) * 100) / 100 : 0,
        percentageOfTotal: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100 * 100) / 100 : 0,
        roas: locationROAS ? Math.round(locationROAS * 100) / 100 : undefined, // ROAS específico por tienda
        topCustomers,
        topComplements,
        dailyRevenue,
        monthlyRevenue,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json({
    success: true,
    data: locations,
    count: locations.length,
  })
}

/**
 * Verifica si los tags contienen un empleado con el patrón "Vendedor: XXX - Nombre"
 */
function hasEmployeePattern(tags: string[] | null | undefined): boolean {
  if (!tags || tags.length === 0) return false
  
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim()
    
    // Buscar formato "Vendedor: XXX - Nombre" o "Vendedor: XXX-Nombre"
    if (tagLower.startsWith('vendedor:')) {
      const employeeValue = tag.substring(9).trim()
      // Verificar si tiene el patrón "XXX - Nombre"
      const patternMatch = extractEmployeeFromTagsPattern([employeeValue])
      if (patternMatch) {
        return true
      }
    }
  }
  
  return false
}

async function getLocationEmployees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const locationFilter = searchParams.get('location') // Filtro opcional por ubicación

  let query = supabase
    .from('shopify_orders')
    .select('tags, total_price, created_at')
    .order('created_at', { ascending: false })

  if (startDate) {
    const start = parseISO(startDate)
    start.setHours(0, 0, 0, 0)
    query = query.gte('created_at', start.toISOString())
  }
  if (endDate) {
    const end = parseISO(endDate)
    end.setHours(23, 59, 59, 999)
    query = query.lte('created_at', end.toISOString())
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  const orders = (data || []) as Array<Database['public']['Tables']['shopify_orders']['Row']>

  // Filtrar solo pedidos que tengan el patrón "Vendedor: XXX - Nombre"
  const ordersWithEmployeePattern = orders.filter(order => {
    const tags = (order as any).tags as string[] | null
    return hasEmployeePattern(tags)
  })

  console.log(`[Shopify API] Total orders: ${orders.length}, Orders with employee pattern: ${ordersWithEmployeePattern.length}`)

  // Agrupar por empleado y ubicación
  const employeeMap = new Map<string, {
    location: string
    revenue: number
    orders: number
    rawEmployeeName: string // Guardamos el nombre original extraído del patrón
  }>()

  let totalRevenue = 0
  let skippedNoEmployee = 0
  let skippedNoLocation = 0
  let skippedLocationFilter = 0
  
  ordersWithEmployeePattern.forEach(order => {
    const tags = (order as any).tags as string[] | null
    const location = extractLocationFromTags(tags) || 'Sin ubicación'
    const rawEmployee = extractEmployeeFromTags(tags)

    // Solo procesar si tenemos un empleado válido (extraído del patrón)
    if (!rawEmployee) {
      skippedNoEmployee++
      return
    }

    // Aplicar filtro de ubicación si existe
    if (locationFilter && location !== locationFilter) {
      skippedLocationFilter++
      return
    }

    // Ignorar si la ubicación es "Sin ubicación"
    if (location === 'Sin ubicación') {
      skippedNoLocation++
      return
    }

    const key = `${rawEmployee}|${location}`
    
    const existing = employeeMap.get(key) || {
      location,
      revenue: 0,
      orders: 0,
      rawEmployeeName: rawEmployee,
    }

    const orderRevenue = Number(order.total_price) || 0
    existing.revenue += orderRevenue
    existing.orders += 1
    totalRevenue += orderRevenue

    employeeMap.set(key, existing)
  })
  
  console.log(`[Shopify API] Skipped - No employee: ${skippedNoEmployee}, No location: ${skippedNoLocation}, Location filter: ${skippedLocationFilter}`)

  console.log(`[Shopify API] Employee map size: ${employeeMap.size}, Total revenue: ${totalRevenue}`)

  // Correlacionar empleados con Acuity
  const employeeCorrelationMap = new Map<string, string>()
  
  // Obtener todas las combinaciones únicas de empleado + ubicación
  const uniqueEmployees = new Set<string>()
  for (const entry of employeeMap.values()) {
    uniqueEmployees.add(`${entry.rawEmployeeName}|${entry.location}`)
  }

  console.log(`[Shopify API] Unique employees to correlate: ${uniqueEmployees.size}`)

  // Correlacionar cada empleado con Acuity
  for (const employeeLocation of uniqueEmployees) {
    const [employeeName, location] = employeeLocation.split('|')
    const correlated = await correlateEmployeeWithAcuity(supabase, employeeName, location)
    
    if (correlated) {
      // Usar displayName si está disponible, sino name
      employeeCorrelationMap.set(employeeLocation, correlated.displayName || correlated.name)
    }
  }

  console.log(`[Shopify API] Correlated employees: ${employeeCorrelationMap.size}`)

  // Convertir a array y aplicar correlaciones
  const employees: ShopifyEmployeeMetrics[] = Array.from(employeeMap.entries())
    .map(([key, data]) => {
      let employee = data.rawEmployeeName
      
      // Si tenemos una correlación, usarla (siempre para empleados con patrón)
      const correlationKey = `${data.rawEmployeeName}|${data.location}`
      const correlatedName = employeeCorrelationMap.get(correlationKey)
      if (correlatedName) {
        employee = correlatedName
      }

      return {
        employee,
        location: data.location,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        percentageOfTotal: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100 * 100) / 100 : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  console.log(`[Shopify API] Final employees array size: ${employees.length}`)

  return NextResponse.json({
    success: true,
    data: employees,
    count: employees.length,
  })
}

// ============================================
// NEW ENDPOINTS: ANALYTICS
// ============================================

async function getAnalytics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  // Por ahora, calcular desde pedidos almacenados
  // En el futuro, puede integrarse con Shopify Analytics API si está disponible
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const periodStart = startDate ? parseISO(startDate) : subDays(new Date(), 30)
  periodStart.setHours(0, 0, 0, 0)
  const periodEnd = endDate ? parseISO(endDate) : new Date()
  periodEnd.setHours(23, 59, 59, 999)

  // Obtener pedidos del período
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, created_at')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  if (error) {
    throw error
  }

  const orders = (data || []) as Database['public']['Tables']['shopify_orders']['Row'][]
  const paidOrders = orders.filter(o => o.financial_status === 'paid')

  // Calcular tasa de conversión (pedidos pagados / total pedidos)
  const conversionRate = orders.length > 0 ? (paidOrders.length / orders.length) * 100 : 0

  // Nota: Tasa de abandono y tiempo promedio en checkout requerirían datos de checkouts
  // que no están disponibles en la tabla actual. Se pueden calcular desde Analytics API si está disponible.

  return NextResponse.json({
    success: true,
    data: {
      conversionRate: Math.round(conversionRate * 100) / 100,
      checkoutAbandonmentRate: 0, // Requiere datos de checkouts
      averageCheckoutTime: 0, // Requiere datos de checkouts
      conversionRateByPeriod: [], // Se puede implementar agrupando por fecha
    },
  })
}

async function getAnalyticsFunnel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  searchParams: URLSearchParams
) {
  // Por ahora, estructura básica
  // En el futuro, se puede integrar con Checkouts API de Shopify si está disponible
  return NextResponse.json({
    success: true,
    data: {
      visitors: 0,
      addedToCart: 0,
      reachedCheckout: 0,
      completedCheckout: 0,
      stages: [],
    },
    message: 'Funnel data requires Checkouts API access',
  })
}
