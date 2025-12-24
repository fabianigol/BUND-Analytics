'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils/format'

// Tipo para comparación de campaña (debe coincidir con el API)
interface CampaignComparison {
  campaign_id: string
  campaign_name: string
  current: {
    spend: number
    impressions: number
    clicks: number
    ctr: number
    cost_per_result: number
    results: number
  }
  comparative: {
    spend: number
    impressions: number
    clicks: number
    ctr: number
    cost_per_result: number
    results: number
  }
  change: {
    spend: { value: number; percent: number; isBetter: boolean }
    ctr: { value: number; percent: number; isBetter: boolean }
    cost_per_result: { value: number; percent: number; isBetter: boolean }
    results: { value: number; percent: number; isBetter: boolean }
  }
  hasData: boolean
}

interface ComparativesData {
  currentPeriod: { start: string; end: string }
  previousMonth: {
    start: string
    end: string
    data: CampaignComparison[]
  }
  previousYear: {
    start: string
    end: string
    data: CampaignComparison[]
  }
  byCategory: {
    citas: {
      previousMonth: CampaignComparison[]
      previousYear: CampaignComparison[]
    }
    leads: {
      previousMonth: CampaignComparison[]
      previousYear: CampaignComparison[]
    }
    ecom: {
      previousMonth: CampaignComparison[]
      previousYear: CampaignComparison[]
    }
  }
}

interface ComparativesViewProps {
  dateRange?: { start: string; end: string } | null
}

export function ComparativesView({ dateRange }: ComparativesViewProps) {
  const [comparatives, setComparatives] = useState<ComparativesData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadComparatives = async () => {
    if (!dateRange || !dateRange.start || !dateRange.end) {
      setComparatives(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append('startDate', dateRange.start)
      params.append('endDate', dateRange.end)

      console.log('[ComparativesView] Loading comparatives with params:', params.toString())
      const response = await fetch(`/api/meta/comparatives?${params.toString()}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[ComparativesView] Error loading comparatives:', response.status, response.statusText, errorText)
        setComparatives(null)
        return
      }

      const data = await response.json()
      console.log('[ComparativesView] Loaded comparatives data:', {
        previousMonth: data.previousMonth?.data?.length || 0,
        previousYear: data.previousYear?.data?.length || 0,
      })
      setComparatives(data)
    } catch (error) {
      console.error('[ComparativesView] Error loading comparatives:', error)
      setComparatives(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComparatives()
  }, [dateRange])

  // Función helper para obtener color según si mejoró o empeoró
  const getChangeColor = (isBetter: boolean, hasData: boolean): string => {
    if (!hasData) return 'bg-gray-50 text-gray-500'
    return isBetter ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
  }

  // Función helper para obtener icono de cambio
  const getChangeIcon = (isBetter: boolean, hasData: boolean) => {
    if (!hasData) return <Minus className="h-4 w-4" />
    return isBetter ? (
      <TrendingUp className="h-4 w-4" />
    ) : (
      <TrendingDown className="h-4 w-4" />
    )
  }

  // Función helper para formatear cambio
  const formatChange = (change: { value: number; percent: number; isBetter: boolean }, hasData: boolean): string => {
    if (!hasData) return '—'
    const sign = change.percent >= 0 ? '+' : ''
    return `${sign}${change.percent.toFixed(2)}%`
  }

  // Función para renderizar tabla de comparativa
  const renderComparisonTable = (
    title: string,
    comparisons: CampaignComparison[],
    periodLabel: string
  ) => {
    if (!comparisons || comparisons.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-sm text-muted-foreground py-4">
              No hay campañas con datos en este período
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {title} ({comparisons.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaña</TableHead>
                  <TableHead className="text-right">Spend Actual</TableHead>
                  <TableHead className="text-right">Spend Comparativo</TableHead>
                  <TableHead className="text-right">Cambio Spend</TableHead>
                  <TableHead className="text-right">CTR Actual</TableHead>
                  <TableHead className="text-right">CTR Comparativo</TableHead>
                  <TableHead className="text-right">Cambio CTR</TableHead>
                  <TableHead className="text-right">Cost/Result Actual</TableHead>
                  <TableHead className="text-right">Cost/Result Comparativo</TableHead>
                  <TableHead className="text-right">Cambio Cost/Result</TableHead>
                  <TableHead className="text-right">Results Actual</TableHead>
                  <TableHead className="text-right">Results Comparativo</TableHead>
                  <TableHead className="text-right">Cambio Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisons.map((comparison) => (
                  <TableRow key={comparison.campaign_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{comparison.campaign_name}</p>
                        {!comparison.hasData && (
                          <Badge variant="secondary" className="mt-1">
                            Comparativa no disponible
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(comparison.current.spend)}
                    </TableCell>
                    <TableCell className="text-right">
                      {comparison.hasData ? formatCurrency(comparison.comparative.spend) : '—'}
                    </TableCell>
                    <TableCell className={`text-right ${getChangeColor(comparison.change.spend.isBetter, comparison.hasData)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getChangeIcon(comparison.change.spend.isBetter, comparison.hasData)}
                        <span>{formatChange(comparison.change.spend, comparison.hasData)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPercentage(comparison.current.ctr, 2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {comparison.hasData ? formatPercentage(comparison.comparative.ctr, 2) : '—'}
                    </TableCell>
                    <TableCell className={`text-right ${getChangeColor(comparison.change.ctr.isBetter, comparison.hasData)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getChangeIcon(comparison.change.ctr.isBetter, comparison.hasData)}
                        <span>{formatChange(comparison.change.ctr, comparison.hasData)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {comparison.current.cost_per_result > 0
                        ? formatCurrency(comparison.current.cost_per_result)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {comparison.hasData && comparison.comparative.cost_per_result > 0
                        ? formatCurrency(comparison.comparative.cost_per_result)
                        : '—'}
                    </TableCell>
                    <TableCell className={`text-right ${getChangeColor(comparison.change.cost_per_result.isBetter, comparison.hasData)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getChangeIcon(comparison.change.cost_per_result.isBetter, comparison.hasData)}
                        <span>{formatChange(comparison.change.cost_per_result, comparison.hasData)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNumber(comparison.current.results)}
                    </TableCell>
                    <TableCell className="text-right">
                      {comparison.hasData ? formatNumber(comparison.comparative.results) : '—'}
                    </TableCell>
                    <TableCell className={`text-right ${getChangeColor(comparison.change.results.isBetter, comparison.hasData)}`}>
                      <div className="flex items-center justify-end gap-1">
                        {getChangeIcon(comparison.change.results.isBetter, comparison.hasData)}
                        <span>{formatChange(comparison.change.results, comparison.hasData)}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dateRange || !dateRange.start || !dateRange.end) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            Selecciona un período de fechas para ver las comparativas
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!comparatives) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            No se pudieron cargar las comparativas. Intenta de nuevo.
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    const endDate = new Date(end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${startDate} - ${endDate}`
  }

  return (
    <div className="space-y-6">
      {/* Información del período actual */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Período Actual: {formatPeriod(comparatives.currentPeriod.start, comparatives.currentPeriod.end)}
              </p>
              <p className="text-xs text-blue-800 mt-1">
                Solo se muestran campañas con spend &gt; 0€ en el período actual. Las comparativas se realizan con campañas que tienen el mismo nombre exacto en los períodos comparativos.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparativa con Mes Anterior */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Comparativa con Mes Anterior ({formatPeriod(comparatives.previousMonth.start, comparatives.previousMonth.end)})
        </h2>
        
        {renderComparisonTable(
          'Campañas de Citas',
          comparatives.byCategory.citas.previousMonth,
          `Mes anterior: ${formatPeriod(comparatives.previousMonth.start, comparatives.previousMonth.end)}`
        )}
        
        {renderComparisonTable(
          'Campañas de Leads',
          comparatives.byCategory.leads.previousMonth,
          `Mes anterior: ${formatPeriod(comparatives.previousMonth.start, comparatives.previousMonth.end)}`
        )}
        
        {renderComparisonTable(
          'Campañas de Ecom',
          comparatives.byCategory.ecom.previousMonth,
          `Mes anterior: ${formatPeriod(comparatives.previousMonth.start, comparatives.previousMonth.end)}`
        )}
      </div>

      {/* Comparativa con Año Anterior */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Comparativa con Año Anterior ({formatPeriod(comparatives.previousYear.start, comparatives.previousYear.end)})
        </h2>
        
        {renderComparisonTable(
          'Campañas de Citas',
          comparatives.byCategory.citas.previousYear,
          `Año anterior: ${formatPeriod(comparatives.previousYear.start, comparatives.previousYear.end)}`
        )}
        
        {renderComparisonTable(
          'Campañas de Leads',
          comparatives.byCategory.leads.previousYear,
          `Año anterior: ${formatPeriod(comparatives.previousYear.start, comparatives.previousYear.end)}`
        )}
        
        {renderComparisonTable(
          'Campañas de Ecom',
          comparatives.byCategory.ecom.previousYear,
          `Año anterior: ${formatPeriod(comparatives.previousYear.start, comparatives.previousYear.end)}`
        )}
      </div>
    </div>
  )
}

