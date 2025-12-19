'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart, PieChart, LineChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Eye,
  Clock,
  MousePointer,
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  Loader2,
} from 'lucide-react'
import { formatNumber, formatCompactNumber, formatPercentage, formatDuration } from '@/lib/utils/format'

interface AnalyticsData {
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  totalNewUsers: number
  avgBounceRate: number
  avgSessionDuration: number
  latest: {
    sessions: number
    users: number
    new_users: number
    page_views: number
    bounce_rate: number
    avg_session_duration: number
    traffic_sources: Array<{ source: string; medium: string; sessions: number; users: number; percentage: number }>
    top_pages: Array<{ page_path: string; page_title: string; page_views: number; avg_time_on_page: number }>
  } | null
  sessionsData: Array<{ date: string; value: number }>
  usersData: Array<{ date: string; usuarios: number; nuevos: number }>
  trafficSources: Array<{ source: string; medium: string; sessions: number; users: number }>
  topPages: Array<{ pagePath: string; pageTitle: string; pageViews: number; avgTimeOnPage: number }>
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/analytics')
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load analytics data')
      }

      setAnalyticsData(result.data)
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const hasAnalytics = analyticsData && analyticsData.latest !== null
  if (loading) {
    return (
      <div className="flex flex-col">
        <Header
          title="Analytics"
          subtitle="Datos de Google Analytics 4"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col">
        <Header
          title="Analytics"
          subtitle="Datos de Google Analytics 4"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">Error al cargar datos: {error}</p>
              <button
                onClick={loadAnalyticsData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
        title="Analytics"
        subtitle="Datos de Google Analytics 4"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Sesiones"
            value={analyticsData?.totalSessions ? formatCompactNumber(analyticsData.totalSessions) : '—'}
            change={0}
            icon={Eye}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Usuarios"
            value={analyticsData?.totalUsers ? formatCompactNumber(analyticsData.totalUsers) : '—'}
            change={0}
            icon={Users}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Páginas Vistas"
            value={analyticsData?.totalPageViews ? formatCompactNumber(analyticsData.totalPageViews) : '—'}
            change={0}
            icon={Globe}
            iconColor="bg-purple-100 text-purple-600"
          />
          <MetricCard
            title="Tasa de Rebote"
            value={analyticsData?.avgBounceRate ? formatPercentage(analyticsData.avgBounceRate) : '—'}
            change={0}
            icon={MousePointer}
            iconColor="bg-amber-100 text-amber-600"
          />
        </div>

        {/* Secondary KPIs */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-indigo-100 p-3 text-indigo-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duración Media</p>
                <p className="text-xl font-semibold">
                  {analyticsData?.avgSessionDuration
                    ? formatDuration(analyticsData.avgSessionDuration)
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-pink-100 p-3 text-pink-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nuevos Usuarios</p>
                <p className="text-xl font-semibold">
                  {analyticsData?.totalNewUsers ? formatNumber(analyticsData.totalNewUsers) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-cyan-100 p-3 text-cyan-600">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Páginas/Sesión</p>
                <p className="text-xl font-semibold">
                  {analyticsData?.totalPageViews && analyticsData?.totalSessions
                    ? (analyticsData.totalPageViews / analyticsData.totalSessions).toFixed(2)
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sesiones - Últimos 30 días</CardTitle>
              <CardDescription>
                {analyticsData?.sessionsData && analyticsData.sessionsData.length > 0
                  ? `${analyticsData.sessionsData.length} días de datos`
                  : 'Sin datos. Conecta GA4 y sincroniza.'}
              </CardDescription>
            </CardHeader>
            {analyticsData?.sessionsData && analyticsData.sessionsData.length > 0 ? (
              <CardContent>
                <AreaChart
                  data={analyticsData.sessionsData}
                  dataKey="value"
                  height={300}
                />
              </CardContent>
            ) : null}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Usuarios vs Nuevos Usuarios</CardTitle>
              <CardDescription>
                {analyticsData?.usersData && analyticsData.usersData.length > 0
                  ? `${analyticsData.usersData.length} días de datos`
                  : 'Sin datos. Conecta GA4 y sincroniza.'}
              </CardDescription>
            </CardHeader>
            {analyticsData?.usersData && analyticsData.usersData.length > 0 ? (
              <CardContent>
                <LineChart
                  title="Usuarios vs Nuevos Usuarios"
                  data={analyticsData.usersData}
                  lines={[
                    { dataKey: 'usuarios', name: 'Usuarios', color: '#3b82f6' },
                    { dataKey: 'nuevos', name: 'Nuevos Usuarios', color: '#10b981', dashed: true },
                  ]}
                  xAxisKey="date"
                  height={300}
                />
              </CardContent>
            ) : null}
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Fuentes de Tráfico</CardTitle>
              <CardDescription>
                {analyticsData?.trafficSources && analyticsData.trafficSources.length > 0
                  ? `${analyticsData.trafficSources.length} fuentes`
                  : 'Sin datos. Conecta GA4 y sincroniza.'}
              </CardDescription>
            </CardHeader>
            {analyticsData?.trafficSources && analyticsData.trafficSources.length > 0 ? (
              <CardContent>
                <PieChart
                  data={analyticsData.trafficSources.map((source) => ({
                    name: `${source.source} (${source.medium})`,
                    value: source.sessions,
                  }))}
                  height={280}
                />
              </CardContent>
            ) : null}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Dispositivos</CardTitle>
              <CardDescription>Sin datos. Conecta GA4 y sincroniza.</CardDescription>
            </CardHeader>
          </Card>

          {/* Top Pages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Páginas Más Visitadas</CardTitle>
              <CardDescription>
                {analyticsData?.topPages && analyticsData.topPages.length > 0
                  ? `${analyticsData.topPages.length} páginas`
                  : 'Sin datos. Conecta GA4 y sincroniza.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analyticsData?.topPages && analyticsData.topPages.length > 0
                ? analyticsData.topPages.map((page, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[150px]">{page.pageTitle}</span>
                        <span className="text-muted-foreground">
                          {formatCompactNumber(page.pageViews)}
                        </span>
                      </div>
                      <Progress
                        value={(page.pageViews / (analyticsData.topPages[0]?.pageViews || 1)) * 100}
                        className="h-1.5"
                      />
                    </div>
                  ))
                : (
                  <p className="text-sm text-muted-foreground">Sin páginas aún.</p>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Geographic Data */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Tráfico por País</CardTitle>
            <CardDescription>Sin datos. Conecta GA4 y sincroniza.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>País</TableHead>
                  <TableHead className="text-right">Sesiones</TableHead>
                  <TableHead className="text-right">% del Total</TableHead>
                  <TableHead className="w-[200px]">Distribución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    Sin países listados. Los datos geográficos se agregarán en futuras actualizaciones.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

