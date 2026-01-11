'use client'

import { Progress } from '@/components/ui/progress'
import { WeeklyProgress } from '@/types'
import { formatNumber, formatCurrencyByCountry } from '@/lib/utils/format'

interface WeekProgressBarProps {
  week: WeeklyProgress
  color: string
  isOnline?: boolean
  country?: 'ES' | 'MX'
}

export function WeekProgressBar({ week, color, isOnline = false, country = 'ES' }: WeekProgressBarProps) {
  // Determinar color de citas/pedidos según si está por encima o debajo del objetivo
  const appointmentsColor = week.currentAppointments >= week.targetAppointments 
    ? 'text-green-600' 
    : 'text-red-600'
  
  const ordersColor = week.currentOrders >= week.targetOrders
    ? 'text-green-600'
    : 'text-red-600'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{week.weekLabel}</span>
        <div className="flex gap-3 text-muted-foreground">
          <span>{formatCurrencyByCountry(week.currentRevenue, country).replace(/\.\d{2}$/, '')}</span>
          <span>|</span>
          {isOnline ? (
            <span>
              <span className={ordersColor}>{week.currentOrders}</span> pedidos vs{' '}
              <span>{Math.ceil(week.targetOrders)}</span>
            </span>
          ) : (
            <span>
              <span className={appointmentsColor}>{week.currentAppointments}</span> citas vs{' '}
              <span>{Math.ceil(week.targetAppointments)}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {/* Barra de facturación */}
        <div className="flex-1">
          <Progress 
            value={Math.min(week.revenueProgress, 100)} 
            className="h-2"
          />
        </div>
        {/* Barra de citas o pedidos */}
        {!isOnline && (
          <div className="flex-1">
            <Progress 
              value={Math.min(week.appointmentsProgress, 100)} 
              className="h-2"
            />
          </div>
        )}
        {isOnline && (
          <div className="flex-1">
            <Progress 
              value={Math.min(week.ordersProgress, 100)} 
              className="h-2"
            />
          </div>
        )}
      </div>
    </div>
  )
}
