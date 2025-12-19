'use client'

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface PieChartProps {
  title: string
  data: Array<{
    name: string
    value: number
    color: string
  }>
  height?: number
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  formatValue?: (value: number) => string
}

export function PieChart({
  title,
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  formatValue = (v) => v.toLocaleString('es-ES'),
}: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <RechartsPieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload
                  const percentage = ((item.value / total) * 100).toFixed(1)
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <p className="mt-1 text-lg font-semibold">
                        {formatValue(item.value)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {percentage}% del total
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            {showLegend && (
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                content={({ payload }) => {
                  // Ordenar el payload por valor descendente para mostrar la leyenda ordenada
                  const sortedPayload = [...(payload || [])].sort((a, b) => {
                    const valueA = a.payload?.value || 0
                    const valueB = b.payload?.value || 0
                    return valueB - valueA
                  })
                  
                  return (
                    <div className="flex flex-col gap-2 pl-4">
                      {sortedPayload.map((entry, index) => {
                        const itemValue = entry.payload?.value || entry.value || 0
                        const itemName = entry.payload?.name || entry.name || ''
                        const percentage = ((itemValue / total) * 100).toFixed(0)
                        return (
                          <div key={`legend-${index}`} className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-sm text-muted-foreground flex-1 truncate">
                              {itemName}
                            </span>
                            <span className="text-sm font-medium">{percentage}%</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                }}
              />
            )}
          </RechartsPieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

