'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Alert {
  type: 'success' | 'warning' | 'info' | 'error'
  message: string
}

interface IntelligentAlertsProps {
  alerts: Alert[]
  className?: string
}

const alertConfig = {
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    textColor: 'text-emerald-900',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-900',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    textColor: 'text-blue-900',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    textColor: 'text-red-900',
  },
}

export function IntelligentAlerts({ alerts, className }: IntelligentAlertsProps) {
  if (alerts.length === 0) {
    return (
      <Card className={cn('border-2', className)}>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Alertas Inteligentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No hay alertas en este momento.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('border-2', className)}>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Alertas Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert, index) => {
            const config = alertConfig[alert.type]
            const Icon = config.icon

            return (
              <div
                key={index}
                className={cn(
                  'rounded-lg border-2 p-3 flex items-start gap-3',
                  config.bgColor,
                  config.borderColor
                )}
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />
                <p className={cn('text-sm font-medium flex-1', config.textColor)}>{alert.message}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

