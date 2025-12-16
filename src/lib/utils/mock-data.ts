import { DashboardMetrics, ChartDataPoint, MultiSeriesChartData } from '@/types'

// Placeholder metrics hasta conectar APIs reales
export const mockDashboardMetrics: DashboardMetrics = {
  totalAppointments: 0,
  appointmentsChange: 0,
  completedAppointments: 0,
  canceledAppointments: 0,
  noShowAppointments: 0,
  appointmentConversionRate: 0,

  totalRevenue: 0,
  revenueChange: 0,
  totalOrders: 0,
  ordersChange: 0,
  averageOrderValue: 0,
  aovChange: 0,

  totalAdSpend: 0,
  adSpendChange: 0,
  totalImpressions: 0,
  impressionsChange: 0,
  totalClicks: 0,
  clicksChange: 0,
  overallRoas: 0,
  roasChange: 0,

  totalSessions: 0,
  sessionsChange: 0,
  totalUsers: 0,
  usersChange: 0,
  bounceRate: 0,
  bounceRateChange: 0,
}

// Placeholders sin datos reales
export function generateRevenueChartData(): ChartDataPoint[] {
  return []
}

export function generateSessionsChartData(): ChartDataPoint[] {
  return []
}

export function generateMultiSeriesChartData(): MultiSeriesChartData[] {
  return []
}

export const mockCalendlyEvents: [] = []
export const mockShopifyOrders: [] = []
export const mockMetaCampaigns: [] = []
export const mockAnalyticsData = null
export const mockTopProducts: [] = []
export const mockTrafficSources: [] = []

