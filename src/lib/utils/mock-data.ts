import { DashboardMetrics, ChartDataPoint, MultiSeriesChartData } from '@/types'
import { subDays, format } from 'date-fns'

// Mock Dashboard Metrics
export const mockDashboardMetrics: DashboardMetrics = {
  // Calendly
  totalAppointments: 156,
  appointmentsChange: 12.5,
  completedAppointments: 132,
  canceledAppointments: 18,
  noShowAppointments: 6,
  appointmentConversionRate: 68.5,

  // Shopify
  totalRevenue: 45678.90,
  revenueChange: 8.3,
  totalOrders: 234,
  ordersChange: 5.2,
  averageOrderValue: 195.21,
  aovChange: 2.8,

  // Meta Ads
  totalAdSpend: 3456.78,
  adSpendChange: -2.1,
  totalImpressions: 456789,
  impressionsChange: 15.7,
  totalClicks: 12345,
  clicksChange: 11.2,
  overallRoas: 3.24,
  roasChange: 4.5,

  // Analytics
  totalSessions: 23456,
  sessionsChange: 9.8,
  totalUsers: 15678,
  usersChange: 7.3,
  bounceRate: 42.3,
  bounceRateChange: -3.2,
}

// Generate chart data for the last 30 days
export function generateRevenueChartData(): ChartDataPoint[] {
  const data: ChartDataPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const date = subDays(new Date(), i)
    data.push({
      date: format(date, 'yyyy-MM-dd'),
      value: Math.floor(Math.random() * 2000) + 800,
      label: format(date, 'dd MMM'),
    })
  }
  return data
}

export function generateSessionsChartData(): ChartDataPoint[] {
  const data: ChartDataPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const date = subDays(new Date(), i)
    data.push({
      date: format(date, 'yyyy-MM-dd'),
      value: Math.floor(Math.random() * 1000) + 500,
      label: format(date, 'dd MMM'),
    })
  }
  return data
}

export function generateMultiSeriesChartData(): MultiSeriesChartData[] {
  const data: MultiSeriesChartData[] = []
  for (let i = 29; i >= 0; i--) {
    const date = subDays(new Date(), i)
    data.push({
      date: format(date, 'dd MMM'),
      ventas: Math.floor(Math.random() * 2000) + 1000,
      citas: Math.floor(Math.random() * 15) + 5,
      gasto_ads: Math.floor(Math.random() * 200) + 50,
    })
  }
  return data
}

// Mock Calendly Events
export const mockCalendlyEvents = [
  {
    id: '1',
    event_type: 'consultation',
    event_type_name: 'Consulta Inicial',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 3600000).toISOString(),
    invitee_email: 'cliente@ejemplo.com',
    invitee_name: 'María García',
    status: 'active' as const,
    metadata: {},
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    event_type: 'follow-up',
    event_type_name: 'Seguimiento',
    start_time: new Date(Date.now() + 86400000).toISOString(),
    end_time: new Date(Date.now() + 86400000 + 1800000).toISOString(),
    invitee_email: 'otro@ejemplo.com',
    invitee_name: 'Carlos López',
    status: 'active' as const,
    metadata: {},
    created_at: new Date().toISOString(),
  },
]

// Mock Shopify Orders
export const mockShopifyOrders = [
  {
    id: '1',
    order_number: '#1234',
    total_price: 299.99,
    subtotal_price: 279.99,
    total_tax: 20.00,
    currency: 'EUR',
    financial_status: 'paid',
    fulfillment_status: 'fulfilled',
    customer_email: 'cliente@ejemplo.com',
    customer_name: 'María García',
    line_items: [
      { id: '1', title: 'Producto A', quantity: 2, price: 139.99, sku: 'SKU-001', product_id: 'p1' }
    ],
    created_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
  },
  {
    id: '2',
    order_number: '#1235',
    total_price: 159.50,
    subtotal_price: 149.50,
    total_tax: 10.00,
    currency: 'EUR',
    financial_status: 'paid',
    fulfillment_status: 'pending',
    customer_email: 'otro@ejemplo.com',
    customer_name: 'Carlos López',
    line_items: [
      { id: '2', title: 'Producto B', quantity: 1, price: 149.50, sku: 'SKU-002', product_id: 'p2' }
    ],
    created_at: new Date(Date.now() - 86400000).toISOString(),
    processed_at: new Date(Date.now() - 86400000).toISOString(),
  },
]

// Mock Meta Campaigns
export const mockMetaCampaigns = [
  {
    id: '1',
    campaign_id: 'camp_001',
    campaign_name: 'Campaña Verano 2024',
    status: 'ACTIVE' as const,
    objective: 'CONVERSIONS',
    spend: 1234.56,
    impressions: 156789,
    clicks: 4567,
    conversions: 123,
    cpm: 7.87,
    cpc: 0.27,
    ctr: 2.91,
    roas: 3.45,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: '2',
    campaign_id: 'camp_002',
    campaign_name: 'Remarketing Website',
    status: 'ACTIVE' as const,
    objective: 'CONVERSIONS',
    spend: 567.89,
    impressions: 89012,
    clicks: 2345,
    conversions: 67,
    cpm: 6.38,
    cpc: 0.24,
    ctr: 2.63,
    roas: 4.12,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
]

// Mock Analytics Data
export const mockAnalyticsData = {
  id: '1',
  date: new Date().toISOString(),
  sessions: 2345,
  users: 1890,
  new_users: 567,
  page_views: 7890,
  bounce_rate: 42.3,
  avg_session_duration: 185,
  traffic_sources: [
    { source: 'google', medium: 'organic', sessions: 890, users: 780, percentage: 38 },
    { source: 'facebook', medium: 'paid', sessions: 456, users: 412, percentage: 19 },
    { source: 'direct', medium: 'none', sessions: 345, users: 298, percentage: 15 },
    { source: 'instagram', medium: 'social', sessions: 289, users: 256, percentage: 12 },
    { source: 'google', medium: 'cpc', sessions: 234, users: 198, percentage: 10 },
    { source: 'other', medium: 'referral', sessions: 131, users: 112, percentage: 6 },
  ],
  top_pages: [
    { page_path: '/', page_title: 'Inicio', page_views: 2345, avg_time_on_page: 45 },
    { page_path: '/productos', page_title: 'Productos', page_views: 1234, avg_time_on_page: 120 },
    { page_path: '/nosotros', page_title: 'Nosotros', page_views: 567, avg_time_on_page: 90 },
    { page_path: '/contacto', page_title: 'Contacto', page_views: 345, avg_time_on_page: 60 },
  ],
  created_at: new Date().toISOString(),
}

// Top Products data
export const mockTopProducts = [
  { name: 'Producto Premium A', sales: 145, revenue: 14500 },
  { name: 'Producto Básico B', sales: 234, revenue: 11700 },
  { name: 'Servicio Consultoría', sales: 67, revenue: 13400 },
  { name: 'Pack Starter', sales: 189, revenue: 9450 },
  { name: 'Producto Plus C', sales: 78, revenue: 7800 },
]

// Traffic by source
export const mockTrafficSources = [
  { name: 'Orgánico', value: 38, color: '#1E3A5F' },
  { name: 'Paid Social', value: 25, color: '#3B82F6' },
  { name: 'Directo', value: 18, color: '#10B981' },
  { name: 'Referral', value: 12, color: '#F59E0B' },
  { name: 'Email', value: 7, color: '#8B5CF6' },
]

