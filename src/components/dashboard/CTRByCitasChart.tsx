'use client'

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPercentage } from '@/lib/utils/format'

interface CTRByCitasChartProps {
  data: Array<{
    campaignName: string
    ctr: number
    impressions: number
    clicks: number
  }>
  className?: string
}

export function CTRByCitasChart({ data, className }: CTRByCitasChartProps) {
  // Truncar nombres de campañas si son muy largos
  const formattedData = data.map((item) => ({
    ...item,
    campaignNameShort: item.campaignName.length > 30 
      ? item.campaignName.substring(0, 30) + '...' 
      : item.campaignName,
  }))

  return (
    <Card className={`overflow-hidden border-2 hover:shadow-lg transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">CTR por Campañas de Citas</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Top 10 campañas con mejor CTR este mes</p>
      </CardHeader>
      <CardContent>
        {formattedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={175}>
            <RechartsBarChart
              data={formattedData}
              margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
              <XAxis
                dataKey="campaignNameShort"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                dx={-10}
                width={50}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as typeof formattedData[0]
                    return (
                      <div className="rounded-lg border-2 bg-background p-3 shadow-xl">
                        <p className="text-xs font-semibold text-foreground mb-2">{data.campaignName}</p>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">
                            CTR: <span style={{ color: '#3b82f6' }}>{formatPercentage(data.ctr)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Impresiones: {data.impressions.toLocaleString('es-ES')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Clicks: {data.clicks.toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar
                dataKey="ctr"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[175px] text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-center">
              <p className="font-medium mb-1">No hay datos disponibles</p>
              <p className="text-xs">Sincroniza Meta Ads para ver CTR de campañas de citas</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

