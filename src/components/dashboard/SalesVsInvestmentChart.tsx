'use client'

import {
  Line,
  LineChart as RechartsLineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/format'
import { format, parseISO } from 'date-fns'

interface SalesVsInvestmentChartProps {
  data: Array<{ date: string; ventas: number; inversion: number }>
  className?: string
}

export function SalesVsInvestmentChart({ data, className }: SalesVsInvestmentChartProps) {
  // Formatear fechas para mostrar y asegurar que los datos sean válidos
  const formattedData = data
    .filter((item) => item.date) // Filtrar items sin fecha
    .map((item) => {
      try {
        return {
          ...item,
          ventas: Number(item.ventas) || 0,
          inversion: Number(item.inversion) || 0,
          dateFormatted: format(parseISO(item.date), 'dd MMM'),
        }
      } catch {
        return null
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Card className={`overflow-hidden border-2 hover:shadow-lg transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Evolución Ventas vs Inversión (Últimos 30 días)</CardTitle>
      </CardHeader>
      <CardContent>
        {formattedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={175}>
            <RechartsLineChart
              data={formattedData}
              margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
              <XAxis
                dataKey="dateFormatted"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                dy={10}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                dx={-10}
                width={60}
                tickFormatter={(v) => {
                  if (v >= 1000) return `€${(v / 1000).toFixed(0)}k`
                  return `€${v}`
                }}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border-2 bg-background p-3 shadow-xl">
                        <p className="text-xs font-semibold text-foreground mb-2">{label}</p>
                        {payload.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-sm font-medium text-foreground">
                              {entry.name === 'ventas' ? 'Ventas' : 'Inversión'}:{' '}
                              <span className="font-bold">{formatCurrency(entry.value as number)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend
                formatter={(value) => (value === 'ventas' ? 'Ventas' : 'Inversión')}
                wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                iconType="line"
              />
              <Line
                type="monotone"
                dataKey="ventas"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: '#10b981' }}
                name="ventas"
              />
              <Line
                type="monotone"
                dataKey="inversion"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5, fill: '#3b82f6' }}
                name="inversion"
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[350px] text-sm text-muted-foreground">
            No hay datos disponibles para mostrar
          </div>
        )}
      </CardContent>
    </Card>
  )
}

