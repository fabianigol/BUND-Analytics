'use client'

import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { ShopifyLocationMetrics } from '@/types'
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'

interface LocationBentoCardProps {
  location: ShopifyLocationMetrics
  className?: string
}

export function LocationBentoCard({ location, className }: LocationBentoCardProps) {
  // Colores para diferentes tiendas
  const locationColors: { [key: string]: { primary: string; gradient: string; bg: string } } = {
    'Madrid': { primary: '#3b82f6', gradient: '#60a5fa', bg: 'bg-blue-50' },
    'Barcelona': { primary: '#ef4444', gradient: '#f87171', bg: 'bg-red-50' },
    'Sevilla': { primary: '#f59e0b', gradient: '#fbbf24', bg: 'bg-amber-50' },
    'Málaga': { primary: '#10b981', gradient: '#34d399', bg: 'bg-emerald-50' },
    'Malaga': { primary: '#10b981', gradient: '#34d399', bg: 'bg-emerald-50' },
    'Bilbao': { primary: '#8b5cf6', gradient: '#a78bfa', bg: 'bg-purple-50' },
    'Valencia': { primary: '#ec4899', gradient: '#f472b6', bg: 'bg-pink-50' },
    'Murcia': { primary: '#06b6d4', gradient: '#22d3ee', bg: 'bg-cyan-50' },
    'Zaragoza': { primary: '#f97316', gradient: '#fb923c', bg: 'bg-orange-50' },
    'online': { primary: '#6366f1', gradient: '#818cf8', bg: 'bg-indigo-50' },
  }

  const colors = locationColors[location.location] || {
    primary: '#6b7280',
    gradient: '#9ca3af',
    bg: 'bg-gray-50',
  }

  // Preparar datos para gráfico diario (últimos 7 días o todo el período)
  const dailyChartData = location.dailyRevenue
    ?.slice(-7)
    .map(item => ({
      date: item.date.split('-').slice(1).join('/'), // Formato DD/MM
      value: item.value,
    })) || []

  return (
    <Card className={cn('overflow-hidden border-2 hover:shadow-lg transition-all duration-300', className)}>
      <CardContent className="p-4">
        {/* Header con nombre de tienda y % del total */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">{location.location}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {location.percentageOfTotal.toFixed(1)}% del total
            </p>
          </div>
          <div
            className="px-3 py-1.5 rounded-lg text-white font-bold text-sm"
            style={{ backgroundColor: colors.primary }}
          >
            {location.percentageOfTotal.toFixed(1)}%
          </div>
        </div>

        {/* Grid de métricas principales */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Facturación */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Facturación</p>
            <p className="text-lg font-bold">{formatCurrency(location.revenue)}</p>
          </div>

          {/* Pedidos */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Pedidos</p>
            <p className="text-lg font-bold">{formatNumber(location.orders)}</p>
          </div>

          {/* AOV */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">AOV</p>
            <p className="text-lg font-bold">{formatCurrency(location.averageOrderValue)}</p>
          </div>

          {/* ROAS */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ROAS</p>
            <p className="text-lg font-bold">{location.roas !== undefined ? location.roas.toFixed(2) : '—'}</p>
          </div>
        </div>

        {/* Gráfico de evolución diaria */}
        {dailyChartData.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Evolución Diaria (últimos 7 días)</p>
            <div style={{ height: '80px' }}>
              <ResponsiveContainer width="100%" height={80}>
                <RechartsAreaChart
                  data={dailyChartData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={`gradient-${location.location}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.gradient} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={colors.gradient} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                    dy={5}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                    width={40}
                    tickFormatter={(v) => {
                      if (v >= 1000) return `€${(v / 1000).toFixed(1)}k`
                      return `€${v}`
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-lg">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors.primary}
                    strokeWidth={2}
                    fill={`url(#gradient-${location.location})`}
                  />
                </RechartsAreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top 3 Clientes y Top 3 Complementos */}
        <div className="grid grid-cols-2 gap-4">
          {/* Top 3 Clientes */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top 3 Clientes</p>
            <div className="space-y-1.5">
              {location.topCustomers && location.topCustomers.length > 0 ? (
                location.topCustomers.map((customer, idx) => (
                  <div key={customer.email || idx} className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium flex-1" title={customer.name}>
                      {customer.name || customer.email}
                    </span>
                    <span className="ml-2 font-bold text-foreground flex-shrink-0">
                      {formatCurrency(customer.revenue)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Sin datos</p>
              )}
            </div>
          </div>

          {/* Top 3 Complementos */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top 3 Complementos</p>
            <div className="space-y-1.5">
              {location.topComplements && location.topComplements.length > 0 ? (
                location.topComplements.map((complement, idx) => (
                  <div key={complement.name || idx} className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium flex-1" title={complement.name}>
                      {complement.name}
                    </span>
                    <span className="ml-2 font-bold text-foreground flex-shrink-0">
                      {formatCurrency(complement.revenue)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Sin datos</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

