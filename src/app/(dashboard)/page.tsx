'use client'

import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart, LineChart, PieChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart,
  TrendingUp,
  Users,
  DollarSign,
  MousePointer,
  Eye,
  Target,
} from 'lucide-react'
import {
  mockDashboardMetrics,
  generateRevenueChartData,
  generateMultiSeriesChartData,
  mockTopProducts,
  mockTrafficSources,
} from '@/lib/utils/mock-data'
import { formatCurrency, formatNumber, formatCompactNumber } from '@/lib/utils/format'
import { CardDescription } from '@/components/ui/card'

export default function DashboardPage() {
  const revenueData = generateRevenueChartData()
  const multiSeriesData = generateMultiSeriesChartData()
  const hasRevenueData = revenueData.length > 0
  const hasMultiSeriesData = multiSeriesData.length > 0
  const hasProducts = mockTopProducts.length > 0
  const hasTraffic = mockTrafficSources.length > 0

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        subtitle="Vista general del rendimiento de marketing"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* KPIs Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Ingresos Totales"
            value={mockDashboardMetrics.totalRevenue ? formatCurrency(mockDashboardMetrics.totalRevenue) : '—'}
            change={mockDashboardMetrics.revenueChange}
            changeLabel="vs. mes anterior"
            icon={DollarSign}
            iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          />
          <MetricCard
            title="ROAS General"
            value={mockDashboardMetrics.overallRoas ? `${mockDashboardMetrics.overallRoas}x` : '—'}
            change={mockDashboardMetrics.roasChange}
            changeLabel="vs. mes anterior"
            icon={Target}
            iconColor="bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
          />
          <MetricCard
            title="Sesiones Web"
            value={mockDashboardMetrics.totalSessions ? formatCompactNumber(mockDashboardMetrics.totalSessions) : '—'}
            change={mockDashboardMetrics.sessionsChange}
            changeLabel="vs. mes anterior"
            icon={Users}
            iconColor="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pedidos"
            value={mockDashboardMetrics.totalOrders ? formatNumber(mockDashboardMetrics.totalOrders) : '—'}
            change={mockDashboardMetrics.ordersChange}
            icon={ShoppingCart}
            iconColor="bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
          />
          <MetricCard
            title="Gasto en Ads"
            value={mockDashboardMetrics.totalAdSpend ? formatCurrency(mockDashboardMetrics.totalAdSpend) : '—'}
            change={mockDashboardMetrics.adSpendChange}
            icon={TrendingUp}
            iconColor="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
          />
          <MetricCard
            title="Clics Totales"
            value={mockDashboardMetrics.totalClicks ? formatCompactNumber(mockDashboardMetrics.totalClicks) : '—'}
            change={mockDashboardMetrics.clicksChange}
            icon={MousePointer}
            iconColor="bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
          />
          <MetricCard
            title="Impresiones"
            value={mockDashboardMetrics.totalImpressions ? formatCompactNumber(mockDashboardMetrics.totalImpressions) : '—'}
            change={mockDashboardMetrics.impressionsChange}
            icon={Eye}
            iconColor="bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {hasRevenueData ? (
            <AreaChart
              title="Ingresos - Últimos 30 días"
              data={revenueData}
              color="var(--chart-1)"
              formatValue={(v) => formatCurrency(v)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Ingresos - Últimos 30 días</CardTitle>
                <CardDescription>Sin datos aún. Conecta la API para ver el histórico.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {hasMultiSeriesData ? (
            <LineChart
              title="Rendimiento Comparativo"
              data={multiSeriesData}
              xAxisKey="date"
              lines={[
                { dataKey: 'ventas', name: 'Ventas (€)', color: 'var(--chart-1)' },
                { dataKey: 'gasto_ads', name: 'Gasto Ads (€)', color: 'var(--chart-4)' },
              ]}
              formatValue={(v) => formatCurrency(v)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Rendimiento Comparativo</CardTitle>
                <CardDescription>Sin datos comparativos hasta que llegue la API.</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Top Products */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Top Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasProducts ? (
                mockTopProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.sales} ventas
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(product.revenue)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos de productos. Conecta Shopify o la API correspondiente.</p>
              )}
            </CardContent>
          </Card>

          {/* Traffic Sources */}
          {hasTraffic ? (
            <PieChart
              title="Fuentes de Tráfico"
              data={mockTrafficSources}
              height={280}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Fuentes de Tráfico</CardTitle>
                <CardDescription>Conecta Analytics para ver el desglose de tráfico.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Quick Insights */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InsightItem
                type="success"
                title="ROAS en aumento"
                description="El retorno de inversión publicitaria subió un 4.5% esta semana."
              />
              <InsightItem
                type="warning"
                title="Tasa de cancelación"
                description="Las cancelaciones de citas aumentaron un 8%. Revisar seguimiento."
              />
              <InsightItem
                type="info"
                title="Pico de tráfico"
                description="Mayor tráfico orgánico los martes y jueves entre 10-12h."
              />
              <InsightItem
                type="success"
                title="Mejor campaña"
                description="'Verano 2024' tiene el mejor CPA del mes: €12.34"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InsightItem({
  type,
  title,
  description,
}: {
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  description: string
}) {
  const variants = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Badge variant="secondary" className={variants[type]}>
          {type === 'success' && '↑'}
          {type === 'warning' && '!'}
          {type === 'info' && 'i'}
          {type === 'error' && '×'}
        </Badge>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}

