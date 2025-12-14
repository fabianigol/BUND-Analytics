'use client'

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AreaChartProps {
  title: string
  data: Array<Record<string, string | number | undefined>>
  dataKey?: string
  xAxisKey?: string
  color?: string
  gradientColor?: string
  height?: number
  showGrid?: boolean
  formatValue?: (value: number) => string
}

export function AreaChart({
  title,
  data,
  dataKey = 'value',
  xAxisKey = 'date',
  color = 'var(--chart-1)',
  gradientColor,
  height = 300,
  showGrid = true,
  formatValue = (v) => v.toLocaleString('es-ES'),
}: AreaChartProps) {
  const gradientId = `gradient-${dataKey}`

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <RechartsAreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={gradientColor || color}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={gradientColor || color}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--border)"
              />
            )}
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              dx={-10}
              tickFormatter={formatValue}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold">
                        {formatValue(payload[0].value as number)}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </RechartsAreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

