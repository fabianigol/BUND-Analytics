'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  iconColor?: string
  trend?: 'up' | 'down' | 'neutral'
  subtitle?: string
  className?: string
  simpleChange?: boolean // Si es true, muestra el cambio en gris pequeño sin badge
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'bg-primary/10 text-primary',
  trend,
  subtitle,
  className,
  simpleChange = false,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up' || (change !== undefined && change > 0)) {
      return <TrendingUp className="h-3 w-3" />
    }
    if (trend === 'down' || (change !== undefined && change < 0)) {
      return <TrendingDown className="h-3 w-3" />
    }
    return <Minus className="h-3 w-3" />
  }

  const getTrendColor = () => {
    if (trend === 'up' || (change !== undefined && change > 0)) {
      return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400'
    }
    if (trend === 'down' || (change !== undefined && change < 0)) {
      return 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400'
    }
    return 'text-muted-foreground bg-muted'
  }

  return (
    <Card className={cn('overflow-hidden transition-shadow hover:shadow-md', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
              {change !== undefined && (
                simpleChange ? (
                  <span className="text-xs text-muted-foreground">
                    {change > 0 ? '+' : ''}{change.toFixed(1)}%
                  </span>
                ) : (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      getTrendColor()
                    )}
                  >
                    {getTrendIcon()}
                    {Math.abs(change).toFixed(1)}%
                  </span>
                )
              )}
            </div>
            {(changeLabel || subtitle) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {changeLabel || subtitle}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn('rounded-lg p-2.5', iconColor)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for grids
export function MetricCardCompact({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string
  value: string
  change?: number
  icon?: LucideIcon
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      {Icon && (
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      )}
      <div className="flex-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
      {change !== undefined && (
        <span
          className={cn(
            'text-xs font-medium',
            change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground'
          )}
        >
          {change > 0 ? '+' : ''}{change.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

