import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { subDays, format, parseISO } from 'date-fns'

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
    const type = searchParams.get('type') || 'orders' // orders, metrics, products, charts

    switch (type) {
      case 'orders':
        return getOrders(supabase, searchParams)
      case 'metrics':
        return getMetrics(supabase, searchParams)
      case 'products':
        return getProducts(supabase, searchParams)
      case 'charts':
        return getCharts(supabase, searchParams)
      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: orders, metrics, products, or charts' },
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

  // Obtener datos del período actual
  const { data: currentData, error: currentError } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, line_items')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString())

  if (currentError) {
    throw currentError
  }

  // Obtener datos del período anterior para comparación
  const { data: previousData, error: previousError } = await supabase
    .from('shopify_orders')
    .select('total_price, financial_status, line_items')
    .gte('created_at', previousPeriodStart.toISOString())
    .lte('created_at', previousPeriodEnd.toISOString())

  if (previousError) {
    throw previousError
  }

  const currentOrders = (currentData || []) as Database['public']['Tables']['shopify_orders']['Row'][]
  const previousOrders = (previousData || []) as Database['public']['Tables']['shopify_orders']['Row'][]

  // Calcular métricas del período actual
  const totalRevenue = currentOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0)
  const totalOrders = currentOrders.length
  const paidOrders = currentOrders.filter(o => o.financial_status === 'paid')
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

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

  return NextResponse.json({
    success: true,
    data: {
      totalRevenue,
      revenueChange: Math.round(revenueChange * 100) / 100,
      totalOrders,
      ordersChange: Math.round(ordersChange * 100) / 100,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      aovChange: Math.round(aovChange * 100) / 100,
      totalProductsSold,
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

  let query = supabase
    .from('shopify_orders')
    .select('line_items, created_at')
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

