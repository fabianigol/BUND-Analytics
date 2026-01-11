'use client'

import { useState } from 'react'
import { StoreYearlyTrend } from '@/types'
import { formatCurrency } from '@/lib/utils/format'
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface StoresTrendChartProps {
  data: StoreYearlyTrend[]
}

export function StoresTrendChart({ data }: StoresTrendChartProps) {
  const [selectedView, setSelectedView] = useState<'all' | 'individual'>('all')
  const [selectedStore, setSelectedStore] = useState<string | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <p>No hay datos de objetivos por tienda para este año</p>
      </div>
    )
  }

  // Usar los mismos colores que LocationBentoCard
  const locationColors: { [key: string]: string } = {
    'Madrid': '#3b82f6',
    'Barcelona': '#ef4444',
    'Sevilla': '#f59e0b',
    'Málaga': '#10b981',
    'Malaga': '#10b981',
    'Bilbao': '#8b5cf6',
    'Valencia': '#ec4899',
    'Murcia': '#06b6d4',
    'Zaragoza': '#f97316',
    'online': '#6366f1',
  }

  // Preparar datos para el gráfico
  // Transformar de formato por tienda a formato por mes
  const chartData: any[] = []
  const months = data[0]?.monthlyData || []

  months.forEach((monthData, idx) => {
    const monthEntry: any = {
      month: monthData.monthLabel,
    }

    // Para cada tienda, añadir objetivo y facturación
    data.forEach(store => {
      const storeMonth = store.monthlyData[idx]
      if (storeMonth) {
        monthEntry[`${store.location}-objetivo`] = storeMonth.targetRevenue
        monthEntry[`${store.location}-facturación`] = storeMonth.currentRevenue
      }
    })

    chartData.push(monthEntry)
  })

  return (
    <div className="space-y-4">
      {/* Selector de vista */}
      <div className="flex gap-2">
        <Button
          variant={selectedView === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedView('all')}
        >
          Vista Completa
        </Button>
        <Select
          value={selectedStore || ''}
          onValueChange={(value) => {
            setSelectedStore(value)
            setSelectedView('individual')
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Seleccionar tienda" />
          </SelectTrigger>
          <SelectContent>
            {data.map(store => (
              <SelectItem key={store.location} value={store.location}>
                {store.location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Gráfico */}
      <div style={{ height: '500px' }}>
        {selectedView === 'all' ? (
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
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg max-h-[400px] overflow-y-auto">
                        <p className="font-semibold mb-2">{label}</p>
                        <div className="space-y-2">
                          {data.map(store => {
                            const targetKey = `${store.location}-objetivo`
                            const revenueKey = `${store.location}-facturación`
                            const target = payload.find(p => p.dataKey === targetKey)
                            const revenue = payload.find(p => p.dataKey === revenueKey)

                            return (
                              <div key={store.location} className="space-y-1">
                                <p className="text-xs font-semibold" style={{ color: locationColors[store.location] }}>
                                  {store.location}
                                </p>
                                <div className="flex justify-between gap-2 text-xs pl-2">
                                  <span>Objetivo:</span>
                                  <span>{formatCurrency(target?.value as number || 0)}</span>
                                </div>
                                <div className="flex justify-between gap-2 text-xs pl-2">
                                  <span>Facturación:</span>
                                  <span>{formatCurrency(revenue?.value as number || 0)}</span>
                                </div>
                                <Separator className="my-1" />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
                iconSize={10}
              />

              {/* Línea de objetivo por cada tienda (línea punteada) - No aparece en leyenda */}
              {data.map(store => (
                <Line
                  key={`${store.location}-objetivo`}
                  type="monotone"
                  dataKey={`${store.location}-objetivo`}
                  stroke={locationColors[store.location] || '#6b7280'}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                  legendType="none"
                />
              ))}

              {/* Línea de facturación por cada tienda (línea sólida) - Solo estas en leyenda */}
              {data.map(store => (
                <Line
                  key={`${store.location}-facturación`}
                  type="monotone"
                  dataKey={`${store.location}-facturación`}
                  stroke={locationColors[store.location] || '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name={store.location}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          // Vista individual de una tienda
          selectedStore && (() => {
            const storeData = data.find(s => s.location === selectedStore)
            if (!storeData) return null

            const individualChartData = storeData.monthlyData.map(m => ({
              month: m.monthLabel,
              objetivo: m.targetRevenue,
              facturación: m.currentRevenue,
              consecución: m.achievementPercentage
            }))

            return (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={individualChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--foreground)" fontSize={12} />
                  <YAxis
                    stroke="var(--foreground)"
                    fontSize={12}
                    tickFormatter={(value) => `€${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-lg">
                            <p className="font-semibold mb-2">{label}</p>
                            <div className="space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-xs">Objetivo:</span>
                                <span className="font-semibold">{formatCurrency(payload[0].value as number)}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-xs">Facturación:</span>
                                <span className="font-semibold">{formatCurrency(payload[1].value as number)}</span>
                              </div>
                              <Separator className="my-1" />
                              <div className="flex justify-between gap-4">
                                <span className="text-xs">Consecución:</span>
                                <span className="font-bold">{(payload[2]?.value as number)?.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px' }}
                    iconSize={10}
                  />
                  <Line
                    type="monotone"
                    dataKey="objetivo"
                    stroke={locationColors[selectedStore] || '#6b7280'}
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ r: 5 }}
                    name="Objetivo"
                  />
                  <Line
                    type="monotone"
                    dataKey="facturación"
                    stroke={locationColors[selectedStore] || '#6b7280'}
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                    name="Facturación"
                  />
                </LineChart>
              </ResponsiveContainer>
            )
          })()
        )}
      </div>
    </div>
  )
}
