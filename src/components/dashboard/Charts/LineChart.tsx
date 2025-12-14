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

interface LineChartProps {
  title: string
  data: Array<Record<string, string | number | undefined>>
  lines: Array<{
    dataKey: string
    name: string
    color: string
    strokeWidth?: number
    dashed?: boolean
  }>
  xAxisKey?: string
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  formatValue?: (value: number) => string
}

export function LineChart({
  title,
  data,
  lines,
  xAxisKey = 'date',
  height = 300,
  showGrid = true,
  showLegend = true,
  formatValue = (v) => v.toLocaleString('es-ES'),
}: LineChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <RechartsLineChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
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
                      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
                      {payload.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {item.name}:
                          </span>
                          <span className="text-sm font-semibold">
                            {formatValue(item.value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }
                return null
              }}
            />
            {showLegend && (
              <Legend
                verticalAlign="top"
                height={36}
                content={({ payload }) => (
                  <div className="flex flex-wrap justify-center gap-4 pb-2">
                    {payload?.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              />
            )}
            {lines.map((line) => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.color}
                strokeWidth={line.strokeWidth || 2}
                strokeDasharray={line.dashed ? '5 5' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

