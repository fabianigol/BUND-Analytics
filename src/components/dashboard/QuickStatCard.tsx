'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface QuickStatCardProps {
  title: string
  value: string
  emoji: string
  emojiBgColor?: string
  previousPeriodValue?: number | null
  previousPeriodChange?: number
  historicalValue?: number | null
  historicalChange?: number
  formatValue?: (value: number) => string
  className?: string
}

export function QuickStatCard({
  title,
  value,
  emoji,
  emojiBgColor = 'bg-primary/10',
  previousPeriodValue,
  previousPeriodChange,
  historicalValue,
  historicalChange,
  formatValue = (v) => v.toLocaleString('es-ES', { maximumFractionDigits: 0 }),
  className,
}: QuickStatCardProps) {
  const formatChange = (change: number | undefined) => {
    if (change === undefined) return null
    return change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`
  }

  const getChangeColor = (change: number | undefined) => {
    if (change === undefined || change === 0) return 'text-gray-500'
    return change > 0 ? 'text-emerald-600' : 'text-red-600'
  }

  const getChangeIcon = (change: number | undefined) => {
    if (change === undefined || change === 0) return null
    return change > 0 ? (
      <TrendingUp className="h-3 w-3" />
    ) : (
      <TrendingDown className="h-3 w-3" />
    )
  }

  return (
    <Card className={cn('overflow-hidden transition-all duration-300 hover:shadow-md', className)}>
      <CardContent className="p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn('rounded-lg p-1.5 text-base flex-shrink-0', emojiBgColor)}>{emoji}</span>
            <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          </div>
          <h3 className="text-xl font-bold tracking-tight mb-2">{value}</h3>
          
          {/* Leyenda de comparaciones */}
          <div className="space-y-1 text-xs">
            {/* Vs Período Previo */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">vs. período previo:</span>
              <div className="flex items-center gap-1">
                {previousPeriodValue !== null && previousPeriodValue !== undefined && previousPeriodValue > 0 ? (
                  <>
                    <span className="text-muted-foreground">
                      {formatValue(previousPeriodValue)}
                    </span>
                    {previousPeriodChange !== undefined && (
                      <span className={cn('flex items-center gap-0.5', getChangeColor(previousPeriodChange))}>
                        {getChangeIcon(previousPeriodChange)}
                        {formatChange(previousPeriodChange)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">no data</span>
                )}
              </div>
            </div>
            
            {/* Vs Histórico */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">vs. histórico:</span>
              <div className="flex items-center gap-1">
                {historicalValue !== null && historicalValue !== undefined && historicalValue > 0 ? (
                  <>
                    <span className="text-muted-foreground">
                      {formatValue(historicalValue)}
                    </span>
                    {historicalChange !== undefined && (
                      <span className={cn('flex items-center gap-0.5', getChangeColor(historicalChange))}>
                        {getChangeIcon(historicalChange)}
                        {formatChange(historicalChange)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground italic">no data</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
