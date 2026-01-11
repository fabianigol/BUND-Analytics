'use client'

import { YearlyTargetTrend } from '@/types'
import { formatCurrency } from '@/lib/utils/format'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Separator } from '@/components/ui/separator'

interface CompanyTrendChartProps {
  data: YearlyTargetTrend | null
}

export function CompanyTrendChart({ data }: CompanyTrendChartProps) {
  if (!data || !data.monthlyData || data.monthlyData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>No hay datos de objetivos para este año</p>
      </div>
    )
  }

  // Preparar datos para el gráfico
  const chartData = data.monthlyData.map(month => ({
    month: month.monthLabel,
    objetivo: Math.round(month.targetRevenue),
    facturación: Math.round(month.currentRevenue),
    consecución: month.achievementPercentage
  }))

  return (
    <div className="space-y-4">
      {/* Resumen global */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="text-xs text-muted-foreground">Objetivo Total {data.year}</p>
          <p className="text-lg font-bold">{formatCurrency(data.totalTargetRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Facturación Total</p>
          <p className="text-lg font-bold">{formatCurrency(data.totalCurrentRevenue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Consecución</p>
          <p className="text-lg font-bold">{data.totalAchievementPercentage.toFixed(1)}%</p>
        </div>
      </div>

      {/* Gráfico de líneas */}
      <div style={{ height: '400px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="month"
              stroke="var(--foreground)"
              fontSize={12}
            />
            <YAxis
              stroke="var(--foreground)"
              fontSize={12}
              tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length >= 2) {
                  const objetivo = payload[0].value as number
                  const facturacion = payload[1].value as number
                  const consecucion = objetivo > 0 ? (facturacion / objetivo) * 100 : 0
                  
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="font-semibold mb-2">{label}</p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-blue-600">● Objetivo:</span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(objetivo)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-green-600">● Facturación:</span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(facturacion)}
                          </span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-muted-foreground">Consecución:</span>
                          <span className="text-sm font-bold">
                            {consecucion.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="objetivo"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
              name="Objetivo"
            />
            <Line
              type="monotone"
              dataKey="facturación"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 5 }}
              activeDot={{ r: 7 }}
              name="Facturación"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
