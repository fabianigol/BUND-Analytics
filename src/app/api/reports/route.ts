import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List all reports or generate a specific report
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // If type is specified, generate that specific report
    if (type) {
      switch (type) {
        case 'overview':
          return generateOverviewReport(supabase, startDate, endDate)
        case 'sales':
          return generateSalesReport(supabase, startDate, endDate)
        case 'campaigns':
          return generateCampaignsReport(supabase, startDate, endDate)
        default:
          return NextResponse.json({ error: 'Unknown report type' }, { status: 400 })
      }
    }

    // Return list of available reports
    return NextResponse.json({
      reports: [
        { id: 'overview', name: 'Resumen General', description: 'Métricas principales de todas las fuentes' },
        { id: 'sales', name: 'Informe de Ventas', description: 'Detalle de ventas y pedidos de Shopify' },
        { id: 'campaigns', name: 'Rendimiento de Campañas', description: 'Métricas de Meta Ads' },
      ]
    })
  } catch (error) {
    console.error('Reports error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

async function generateOverviewReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startDate: string | null,
  endDate: string | null
) {
  // Fetch aggregated data from all sources
  const [ordersRes, campaignsRes, analyticsRes] = await Promise.all([
    supabase.from('shopify_orders').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('meta_campaigns').select('*').order('date', { ascending: false }).limit(100),
    supabase.from('analytics_data').select('*').order('date', { ascending: false }).limit(30),
  ])

  const orders = ordersRes.data as Array<{ total_price: number; [key: string]: unknown }> | null
  const campaigns = campaignsRes.data as Array<{ spend: number; conversions: number; [key: string]: unknown }> | null
  const analytics = analyticsRes.data as Array<{ sessions: number; [key: string]: unknown }> | null

  // Calculate metrics
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0
  const totalOrders = orders?.length || 0
  const totalSpend = campaigns?.reduce((sum, c) => sum + (c.spend || 0), 0) || 0
  const totalConversions = campaigns?.reduce((sum, c) => sum + (c.conversions || 0), 0) || 0
  const totalSessions = analytics?.reduce((sum, a) => sum + (a.sessions || 0), 0) || 0

  return NextResponse.json({
    report: {
      type: 'overview',
      generated_at: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      metrics: {
        revenue: {
          total: totalRevenue,
          orders: totalOrders,
          average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        },
        marketing: {
          ad_spend: totalSpend,
          conversions: totalConversions,
          roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        },
        traffic: {
          sessions: totalSessions,
        },
      },
    },
  })
}

async function generateSalesReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startDate: string | null,
  endDate: string | null
) {
  let query = supabase.from('shopify_orders').select('*').order('created_at', { ascending: false })

  if (startDate) query = query.gte('created_at', startDate)
  if (endDate) query = query.lte('created_at', endDate)

  const { data, error } = await query
  const orders = data as Array<{ total_price: number; financial_status: string; [key: string]: unknown }> | null

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0
  const paidOrders = orders?.filter(o => o.financial_status === 'paid') || []
  const pendingOrders = orders?.filter(o => o.financial_status === 'pending') || []

  return NextResponse.json({
    report: {
      type: 'sales',
      generated_at: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        total_revenue: totalRevenue,
        total_orders: orders?.length || 0,
        paid_orders: paidOrders.length,
        pending_orders: pendingOrders.length,
        average_order_value: orders && orders.length > 0 ? totalRevenue / orders.length : 0,
      },
      orders: orders?.slice(0, 50), // Return top 50 orders
    },
  })
}

async function generateCampaignsReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startDate: string | null,
  endDate: string | null
) {
  let query = supabase.from('meta_campaigns').select('*').order('date', { ascending: false })

  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)

  const { data, error } = await query
  const campaigns = data as Array<{ spend: number; impressions: number; clicks: number; conversions: number; roas: number; [key: string]: unknown }> | null

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }

  const totalSpend = campaigns?.reduce((sum, c) => sum + (c.spend || 0), 0) || 0
  const totalImpressions = campaigns?.reduce((sum, c) => sum + (c.impressions || 0), 0) || 0
  const totalClicks = campaigns?.reduce((sum, c) => sum + (c.clicks || 0), 0) || 0
  const totalConversions = campaigns?.reduce((sum, c) => sum + (c.conversions || 0), 0) || 0

  return NextResponse.json({
    report: {
      type: 'campaigns',
      generated_at: new Date().toISOString(),
      period: { start: startDate, end: endDate },
      summary: {
        total_spend: totalSpend,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_conversions: totalConversions,
        average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        average_roas: campaigns && campaigns.length > 0
          ? campaigns.reduce((sum, c) => sum + (c.roas || 0), 0) / campaigns.length
          : 0,
      },
      campaigns: campaigns,
    },
  })
}

// POST - Create a new saved report
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, type, frequency, metrics, filters } = body

    // In production, you would save this to a reports table
    // For now, we'll return a success response
    return NextResponse.json({
      success: true,
      report: {
        id: `report_${Date.now()}`,
        name,
        description,
        type,
        frequency,
        metrics,
        filters,
        created_by: user.id,
        created_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Create report error:', error)
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }
}

