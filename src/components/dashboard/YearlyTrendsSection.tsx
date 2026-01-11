'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { YearlyTargetTrend, StoreYearlyTrend } from '@/types'
import { RefreshCw } from 'lucide-react'
import { CompanyTrendChart } from './CompanyTrendChart'
import { StoresTrendChart } from './StoresTrendChart'

interface YearlyTrendsSectionProps {
  year: number
}

export function YearlyTrendsSection({ year }: YearlyTrendsSectionProps) {
  const [yearlyData, setYearlyData] = useState<{
    companyTrend: YearlyTargetTrend | null
    storeTrends: StoreYearlyTrend[]
  }>({
    companyTrend: null,
    storeTrends: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadYearlyTrends(year)
  }, [year])

  const loadYearlyTrends = async (year: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sales-targets/yearly-trend?year=${year}`)
      if (response.ok) {
        const data = await response.json()
        setYearlyData(data)
      }
    } catch (error) {
      console.error('Error loading yearly trends:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // No mostrar nada si no hay datos
  if (!yearlyData.companyTrend && yearlyData.storeTrends.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Gráfico 1: Tendencia Total Empresa */}
      {yearlyData.companyTrend && (
        <Card>
          <CardHeader>
            <CardTitle>Consecución de Objetivos {year} - Total Empresa</CardTitle>
            <CardDescription>
              Objetivo vs Facturación lograda (todas las tiendas)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CompanyTrendChart data={yearlyData.companyTrend} />
          </CardContent>
        </Card>
      )}

      {/* Gráfico 2: Tendencia por Tienda */}
      {yearlyData.storeTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Consecución de Objetivos {year} - Por Tienda</CardTitle>
            <CardDescription>
              Objetivo vs Facturación lograda por ubicación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StoresTrendChart data={yearlyData.storeTrends} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
