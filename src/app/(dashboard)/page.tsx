'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, LineChart, PieChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShoppingCart,
  TrendingUp,
  Users,
  DollarSign,
  MousePointer,
  Eye,
  Target,
  Calendar,
  Loader2,
} from 'lucide-react'
import { formatCurrency, formatNumber, formatCompactNumber } from '@/lib/utils/format'

interface DashboardData {
  kpis: {
    totalRevenue: { current: number; previous: number; change: number }
    overallRoas: { current: number; previous: number; change: number }
    totalSessions: { current: number; previous: number; change: number }
    totalOrders: { current: number; previous: number; change: number }
    totalAdSpend: { current: number; previous: number; change: number }
    totalClicks: { current: number; previous: number; change: number }
    totalImpressions: { current: number; previous: number; change: number }
    totalAppointments?: { current: number; previous: number; change: number }
  }
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/dashboard/overview')
      if (!response.ok) {
        throw new Error('Error al cargar datos del dashboard')
      }

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        throw new Error(result.error || 'Error desconocido')
      }
    } catch (err: any) {
      console.error('Error loading dashboard data:', err)
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const hasRevenueData = data?.charts.revenue && data.charts.revenue.length > 0
  const hasComparativeData = data?.charts.comparative && data.charts.comparative.length > 0
  const hasProducts = data?.topProducts && data.topProducts.length > 0
  const hasTraffic = data?.trafficSources && data.trafficSources.length > 0
  const hasInsights = data?.insights && data.insights.length > 0

  // Preparar datos para PieChart (formato esperado)
  const trafficColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
  const trafficChartData = data?.trafficSources.map((source, index) => ({
    name: `${source.source} (${source.medium})`,
    value: source.sessions,
    color: trafficColors[index % trafficColors.length],
  })) || []

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Dashboard" subtitle="Vista general del rendimiento de marketing" />
        <div className="flex-1 space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col">
        <Header title="Dashboard" subtitle="Vista general del rendimiento de marketing" />
        <div className="flex-1 p-6">
          <Card>
            <CardHeader>
              <CardTitle>Error al cargar datos</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Reintentar
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        subtitle="Vista general del rendimiento de marketing"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* KPIs Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <MetricCard
            title="Ingresos Totales"
            value={
              data?.kpis.totalRevenue.current
                ? formatCurrency(data.kpis.totalRevenue.current)
                : '—'
            }
            change={data?.kpis.totalRevenue.change}
            changeLabel="vs. mes anterior"
            icon={DollarSign}
            iconColor="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          />
          <MetricCard
            title="ROAS General"
            value={
              data?.kpis.overallRoas.current
                ? `${data.kpis.overallRoas.current.toFixed(2)}x`
                : '—'
            }
            change={data?.kpis.overallRoas.change}
            changeLabel="vs. mes anterior"
            icon={Target}
            iconColor="bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
          />
          <MetricCard
            title="Sesiones Web"
            value={
              data?.kpis.totalSessions.current
                ? formatCompactNumber(data.kpis.totalSessions.current)
                : '—'
            }
            change={data?.kpis.totalSessions.change}
            changeLabel="vs. mes anterior"
            icon={Users}
            iconColor="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
          />
          {data?.kpis.totalAppointments && (
            <MetricCard
              title="Citas del Mes"
              value={formatNumber(data.kpis.totalAppointments.current)}
              change={data.kpis.totalAppointments.change}
              changeLabel="vs. mes anterior"
              icon={Calendar}
              iconColor="bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400"
            />
          )}
        </div>

        {/* Secondary KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Pedidos"
            value={
              data?.kpis.totalOrders.current
                ? formatNumber(data.kpis.totalOrders.current)
                : '—'
            }
            change={data?.kpis.totalOrders.change}
            icon={ShoppingCart}
            iconColor="bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
          />
          <MetricCard
            title="Gasto en Ads"
            value={
              data?.kpis.totalAdSpend.current
                ? formatCurrency(data.kpis.totalAdSpend.current)
                : '—'
            }
            change={data?.kpis.totalAdSpend.change}
            icon={TrendingUp}
            iconColor="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
          />
          <MetricCard
            title="Clics Totales"
            value={
              data?.kpis.totalClicks.current
                ? formatCompactNumber(data.kpis.totalClicks.current)
                : '—'
            }
            change={data?.kpis.totalClicks.change}
            icon={MousePointer}
            iconColor="bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
          />
          <MetricCard
            title="Impresiones"
            value={
              data?.kpis.totalImpressions.current
                ? formatCompactNumber(data.kpis.totalImpressions.current)
                : '—'
            }
            change={data?.kpis.totalImpressions.change}
            icon={Eye}
            iconColor="bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          {hasRevenueData ? (
            <AreaChart
              title="Ingresos - Últimos 30 días"
              data={data!.charts.revenue.map((item) => ({
                date: item.date,
                value: item.value,
              }))}
              color="var(--chart-1)"
              formatValue={(v) => formatCurrency(v)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Ingresos - Últimos 30 días</CardTitle>
                <CardDescription>
                  {data?.integrations.shopify
                    ? 'Sin datos aún. Sincroniza Shopify para ver el histórico.'
                    : 'Sin datos aún. Conecta Shopify para ver el histórico.'}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {hasComparativeData ? (
            <LineChart
              title="Rendimiento Comparativo"
              data={data!.charts.comparative}
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
                <CardDescription>
                  {data?.integrations.meta && data?.integrations.shopify
                    ? 'Sin datos comparativos aún. Sincroniza las integraciones.'
                    : 'Conecta Shopify y Meta Ads para ver datos comparativos.'}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          {/* Top Products */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Top Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasProducts ? (
                data!.topProducts.slice(0, 5).map((product, index) => (
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
                <p className="text-sm text-muted-foreground">
                  {data?.integrations.shopify
                    ? 'Sin datos de productos. Sincroniza Shopify para ver productos.'
                    : 'Sin datos de productos. Conecta Shopify para ver productos.'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Traffic Sources */}
          {hasTraffic ? (
            <PieChart
              title="Fuentes de Tráfico"
              data={trafficChartData}
              height={280}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Fuentes de Tráfico</CardTitle>
                <CardDescription>
                  {data?.integrations.analytics
                    ? 'Sin datos de tráfico. Sincroniza Analytics para ver el desglose.'
                    : 'Conecta Google Analytics para ver el desglose de tráfico.'}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Quick Insights */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasInsights ? (
                data!.insights.slice(0, 4).map((insight, index) => (
                  <InsightItem
                    key={index}
                    type={insight.type}
                    title={insight.title}
                    description={insight.description}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Los insights aparecerán cuando haya suficientes datos para analizar.
                </p>
              )}
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
    <div className="rounded-lg border p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        <Badge variant="secondary" className={variants[type]}>
          {type === 'success' && '↑'}
          {type === 'warning' && '!'}
          {type === 'info' && 'i'}
          {type === 'error' && '×'}
        </Badge>
        <div className="flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
