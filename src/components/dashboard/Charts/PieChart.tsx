'use client'

import { useState, useEffect } from 'react'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Ajustar radios para móviles
  const adjustedInnerRadius = isMobile ? (innerRadius * 0.6) : innerRadius
  const adjustedOuterRadius = isMobile ? (outerRadius * 0.7) : outerRadius

  // Ordenar datos para la leyenda
  const sortedData = [...data].sort((a, b) => b.value - a.value)

  return (
    <div className="flex flex-col h-full">
      {title && (
        <div className="pb-2">
          <h3 className="text-base font-medium">{title}</h3>
        </div>
      )}
      <div className="flex-1 flex flex-col">
        {/* Gráfico sin leyenda dentro */}
        <div className="flex-shrink-0">
          <ResponsiveContainer width="100%" height={height}>
            <RechartsPieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={adjustedInnerRadius}
                outerRadius={adjustedOuterRadius}
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
                      <div className="rounded-lg border bg-background p-2 shadow-lg">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium text-xs">{item.name}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold">
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
            </RechartsPieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Leyenda siempre debajo, alineada al final */}
        {showLegend && (
          <div className="pt-3 border-t mt-auto">
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center">
              {sortedData.map((entry, index) => {
                const percentage = ((entry.value / total) * 100).toFixed(0)
                return (
                  <div key={`legend-${index}`} className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px] sm:max-w-[120px]">
                      {entry.name}
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

