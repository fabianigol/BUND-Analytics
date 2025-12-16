'use client'

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
} from 'lucide-react'
import { mockDashboardMetrics, mockAnalyticsData, mockTrafficSources } from '@/lib/utils/mock-data'
import { formatNumber, formatCompactNumber, formatPercentage, formatDuration } from '@/lib/utils/format'
const sessionsData: { date: string; value: number }[] = []
const usersData: { date: string; usuarios: number; nuevos: number }[] = []
const deviceData: { name: string; value: number; color: string }[] = []
const countriesData: { name: string; sessions: number; percentage: number }[] = []

export default function AnalyticsPage() {
  const hasAnalytics = Boolean(mockAnalyticsData)
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
            value={mockDashboardMetrics.totalSessions ? formatCompactNumber(mockDashboardMetrics.totalSessions) : '—'}
            change={mockDashboardMetrics.sessionsChange}
            icon={Eye}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Usuarios"
            value={mockDashboardMetrics.totalUsers ? formatCompactNumber(mockDashboardMetrics.totalUsers) : '—'}
            change={mockDashboardMetrics.usersChange}
            icon={Users}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Páginas Vistas"
            value={hasAnalytics && mockAnalyticsData?.page_views ? formatCompactNumber(mockAnalyticsData.page_views) : '—'}
            change={0}
            icon={Globe}
            iconColor="bg-purple-100 text-purple-600"
          />
          <MetricCard
            title="Tasa de Rebote"
            value={mockDashboardMetrics.bounceRate ? formatPercentage(mockDashboardMetrics.bounceRate) : '—'}
            change={mockDashboardMetrics.bounceRateChange}
            trend={mockDashboardMetrics.bounceRateChange < 0 ? 'up' : 'down'}
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
                  {hasAnalytics && mockAnalyticsData?.avg_session_duration
                    ? formatDuration(mockAnalyticsData.avg_session_duration)
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
                  {formatNumber(mockAnalyticsData.new_users)}
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
                  {(mockAnalyticsData.page_views / mockAnalyticsData.sessions).toFixed(2)}
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
              <CardDescription>Sin datos. Conecta GA4.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Usuarios vs Nuevos Usuarios</CardTitle>
              <CardDescription>Sin datos. Conecta GA4.</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Fuentes de Tráfico</CardTitle>
              <CardDescription>Sin datos. Conecta GA4.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Dispositivos</CardTitle>
              <CardDescription>Sin datos. Conecta GA4.</CardDescription>
            </CardHeader>
          </Card>

          {/* Top Pages */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">Páginas Más Visitadas</CardTitle>
              <CardDescription>Sin datos. Conecta GA4.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasAnalytics && mockAnalyticsData?.top_pages
                ? mockAnalyticsData.top_pages.map((page, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate max-w-[150px]">{page.page_title}</span>
                        <span className="text-muted-foreground">
                          {formatCompactNumber(page.page_views)}
                        </span>
                      </div>
                      <Progress
                        value={(page.page_views / (mockAnalyticsData.top_pages[0]?.page_views || 1)) * 100}
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
            <CardDescription>Sin datos. Conecta GA4.</CardDescription>
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
                {countriesData.map((country, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{country.name}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(country.sessions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercentage(country.percentage, 0)}
                    </TableCell>
                    <TableCell>
                      <Progress value={country.percentage} className="h-2" />
                    </TableCell>
                  </TableRow>
                ))}
                {!countriesData.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Sin países listados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

