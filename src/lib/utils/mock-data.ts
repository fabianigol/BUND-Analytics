import { DashboardMetrics, ChartDataPoint, MultiSeriesChartData, AnalyticsData, ShopifyOrder } from '@/types'

// Placeholder metrics hasta conectar APIs reales
export const mockDashboardMetrics: DashboardMetrics = {
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

export const mockShopifyOrders: ShopifyOrder[] = []
export const mockMetaCampaigns: [] = []
export const mockAnalyticsData: AnalyticsData | null = null
export const mockTopProducts: Array<{ name: string; sales: number; revenue: number }> = []
export const mockTrafficSources: [] = []

