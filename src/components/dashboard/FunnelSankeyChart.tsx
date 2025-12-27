'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SankeyChart } from '@/components/dashboard/Charts/SankeyChart'

interface FunnelSankeyChartProps {
  nodes: Array<{ id: string; name: string; value: number; level: number; color?: string }>
  links: Array<{ source: string; target: string; value: number }>
  onPeriodChange?: (period: 'daily' | 'weekly' | 'monthly') => void
  currentPeriod?: 'daily' | 'weekly' | 'monthly'
  className?: string
}

export function FunnelSankeyChart({
  nodes,
  links,
  onPeriodChange,
  currentPeriod = 'daily',
  className,
}: FunnelSankeyChartProps) {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>(currentPeriod)

  const handlePeriodChange = (newPeriod: 'daily' | 'weekly' | 'monthly') => {
    setPeriod(newPeriod)
    onPeriodChange?.(newPeriod)
  }

  const periodLabels = {
    daily: 'Diario',
    weekly: 'Semanal',
    monthly: 'Mensual',
  }

  return (
    <Card className={`overflow-hidden border-2 hover:shadow-lg transition-all duration-300 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Funnel Completo</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Flujo: Meta → Web → Calendly → Shopify ({periodLabels[period]})
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={period === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange('daily')}
              className="text-xs h-7 px-3"
            >
              Diario
            </Button>
            <Button
              variant={period === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange('weekly')}
              className="text-xs h-7 px-3"
            >
              Semanal
            </Button>
            <Button
              variant={period === 'monthly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePeriodChange('monthly')}
              className="text-xs h-7 px-3"
            >
              Mensual
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {links.length > 0 && nodes.length > 0 ? (
          <div className="mt-2">
            <SankeyChart
              title=""
              description=""
              nodes={nodes}
              links={links}
              height={450}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-[450px] text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-center">
              <p className="font-medium mb-1">No hay datos disponibles</p>
              <p className="text-xs">Selecciona otro período o sincroniza las integraciones</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

