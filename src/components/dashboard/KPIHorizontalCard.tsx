'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KPIHorizontalCardProps {
  title: string
  valueYesterday: number
  valueMonth: number
  icon: React.ReactNode
  iconBgColor?: string
  formatValue?: (value: number) => string
  className?: string
}

export function KPIHorizontalCard({
  title,
  valueYesterday,
  valueMonth,
  icon,
  iconBgColor = 'bg-primary/10',
  formatValue = (v) => v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }),
  className,
}: KPIHorizontalCardProps) {
  return (
    <Card className={cn('overflow-hidden transition-all duration-300 hover:shadow-md', className)}>
      <CardContent className="p-3 py-2">
        {/* Línea 1: Emoji + Título + Valor Principal */}
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('rounded-lg p-1.5 text-base flex-shrink-0', iconBgColor)}>{icon}</span>
          <p className="text-xs font-medium text-muted-foreground truncate flex-shrink-0">{title}</p>
          <h3 className="text-lg font-bold tracking-tight ml-auto">{formatValue(valueMonth)}</h3>
        </div>
        
        {/* Línea 2: Ayer */}
        <div className="flex items-center justify-end">
          <span className="text-xs text-muted-foreground">
            ayer: <span className="text-foreground font-medium">{formatValue(valueYesterday)}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

