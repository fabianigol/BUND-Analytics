'use client'

import { useState, useEffect } from 'react'
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
  showLegend?: boolean
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
  showLegend = false,
  formatValue = (v) => v.toLocaleString('es-ES'),
}: BarChartProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Calcular total para porcentajes en la leyenda
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  // Ordenar datos para la leyenda (por valor descendente)
  const sortedData = [...data].sort((a, b) => b.value - a.value)
  
  // Función para truncar nombres mostrando solo el inicio
  const truncateName = (name: string, maxLength: number = 15) => {
    if (name.length <= maxLength) return name
    return name.substring(0, maxLength - 3) + '...'
  }

  return (
    <div className="flex flex-col h-full">
      {title && (
        <div className="pb-2">
          <h3 className="text-base font-medium">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="flex-1 flex flex-col">
        <div className="flex-shrink-0">
          <ResponsiveContainer width="100%" height={height}>
            <RechartsBarChart
              data={data}
              layout={horizontal ? 'vertical' : 'horizontal'}
              margin={{ 
                top: 10, 
                right: isMobile ? 5 : 10, 
                left: horizontal ? (isMobile ? 60 : 80) : (isMobile ? 40 : 0), 
                bottom: showLegend ? 10 : (isMobile ? 50 : 20)
              }}
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
                    tick={{ fill: 'var(--muted-foreground)', fontSize: isMobile ? 10 : 12 }}
                    tickFormatter={formatValue}
                  />
                  <YAxis
                    dataKey={xAxisKey}
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: isMobile ? 10 : 12 }}
                    width={isMobile ? 60 : 80}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey={xAxisKey}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: isMobile ? 10 : 12 }}
                    angle={showLegend ? 0 : (isMobile ? -45 : 0)}
                    textAnchor={showLegend ? 'middle' : (isMobile ? 'end' : 'middle')}
                    height={showLegend ? 0 : (isMobile ? 60 : 30)}
                    dy={showLegend ? 0 : (isMobile ? 15 : 10)}
                    hide={showLegend}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: isMobile ? 10 : 12 }}
                    dx={isMobile ? -5 : -10}
                    tickFormatter={formatValue}
                    width={isMobile ? 40 : 50}
                  />
                </>
              )}
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-lg">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-sm font-semibold">
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
                maxBarSize={isMobile ? 40 : 50}
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
        </div>
        
        {/* Leyenda siempre debajo, alineada al final */}
        {showLegend && (
          <div className="pt-3 border-t mt-auto">
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
              {sortedData.map((entry, index) => {
                const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(0) : '0'
                const displayName = truncateName(entry.name, 15)
                return (
                  <div key={`legend-${index}`} className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.color || color }}
                    />
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px] sm:max-w-[120px]">
                      {displayName}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">{percentage}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

