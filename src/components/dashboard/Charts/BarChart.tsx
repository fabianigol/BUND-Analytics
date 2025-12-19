'use client'

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface BarChartProps {
  title: string
  description?: string
  data: Array<{
    name: string
    value: number
    color?: string
    [key: string]: string | number | undefined
  }>
  dataKey?: string
  xAxisKey?: string
  color?: string
  height?: number
  horizontal?: boolean
  showGrid?: boolean
  formatValue?: (value: number) => string
}

export function BarChart({
  title,
  description,
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  color = 'var(--chart-1)',
  height = 300,
  horizontal = false,
  showGrid = true,
  formatValue = (v) => v.toLocaleString('es-ES'),
}: BarChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 10, right: 10, left: horizontal ? 80 : 0, bottom: 0 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={!horizontal}
                horizontal={horizontal}
                stroke="var(--border)"
              />
            )}
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  tickFormatter={formatValue}
                />
                <YAxis
                  dataKey={xAxisKey}
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                  width={80}
                />
              </>
            ) : (
              <>
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
              </>
            )}
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
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
            <Bar
              dataKey={dataKey}
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color || color}
                />
              ))}
            </Bar>
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

