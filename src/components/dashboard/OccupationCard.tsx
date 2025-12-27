'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface OccupationCardProps {
  storeName: string
  medicion: { booked: number; total: number; percentage: number }
  fitting: { booked: number; total: number; percentage: number }
  isClosed?: boolean
  className?: string
}

// Colores para diferentes tiendas (similar a LocationBentoCard)
const locationColors: { [key: string]: { primary: string; gradient: string } } = {
  'Madrid': { primary: '#3b82f6', gradient: '#60a5fa' },
  'Barcelona': { primary: '#ef4444', gradient: '#f87171' },
  'Sevilla': { primary: '#f59e0b', gradient: '#fbbf24' },
  'Málaga': { primary: '#10b981', gradient: '#34d399' },
  'Malaga': { primary: '#10b981', gradient: '#34d399' },
  'Bilbao': { primary: '#8b5cf6', gradient: '#a78bfa' },
  'Valencia': { primary: '#ec4899', gradient: '#f472b6' },
  'Murcia': { primary: '#06b6d4', gradient: '#22d3ee' },
  'Zaragoza': { primary: '#f97316', gradient: '#fb923c' },
  'Cdmx': { primary: '#6b7280', gradient: '#9ca3af' },
  'CDMX': { primary: '#6b7280', gradient: '#9ca3af' },
}

// Emojis de banderas por tienda
const storeFlags: { [key: string]: string } = {
  'Cdmx': '🇲🇽',
  'CDMX': '🇲🇽',
  'Madrid': '🇪🇸',
  'Barcelona': '🇪🇸',
  'Sevilla': '🇪🇸',
  'Málaga': '🇪🇸',
  'Malaga': '🇪🇸',
  'Murcia': '🇪🇸',
  'Valencia': '🇪🇸',
  'Zaragoza': '🇪🇸',
  'Bilbao': '🇪🇸',
  'Próximamente': '🚀',
}

export function OccupationCard({ storeName, medicion, fitting, isClosed = false, className }: OccupationCardProps) {
  const colors = locationColors[storeName] || {
    primary: '#6b7280',
    gradient: '#9ca3af',
  }

  const hasData = medicion.total > 0 || fitting.total > 0

  return (
    <Card className={cn(
      'overflow-hidden border-2 hover:shadow-lg transition-all duration-300',
      isClosed || !hasData ? 'bg-gray-50 border-gray-200' : '',
      className
    )}>
      <CardContent className="p-3">
        {/* Header con nombre de tienda con fondo de color y emoji de bandera */}
        <div className="flex items-center justify-between mb-2">
          <div
            className={cn(
              'px-2 py-1 rounded flex items-center gap-1.5',
              isClosed || !hasData ? 'bg-gray-200' : ''
            )}
            style={!isClosed && hasData ? { backgroundColor: `${colors.primary}20` } : undefined}
          >
            <span className="text-base">{storeFlags[storeName] || '🏢'}</span>
            <h3 className={cn(
              'text-sm font-bold truncate',
              isClosed || !hasData ? 'text-muted-foreground' : 'text-foreground'
            )}>
              {storeName}
            </h3>
            <span className="text-[10px] font-medium text-muted-foreground">
              {storeName === 'Próximamente' ? 'Próximamente' : (isClosed || !hasData ? 'CERRADA' : 'HOY')}
            </span>
          </div>
        </div>

        {isClosed || !hasData ? (
          <div className="text-center py-2">
            <p className="text-xs font-medium text-muted-foreground">
              {storeName === 'Próximamente' ? 'Próximamente' : 'CERRADA HOY'}
            </p>
          </div>
        ) : (
          <>
            {/* Medición */}
            <div className="space-y-1 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Medición</span>
                <span className="text-xs font-bold text-foreground">{medicion.percentage}%</span>
              </div>
              <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${medicion.percentage}%`,
                    backgroundColor: colors.primary,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{medicion.booked} reserv.</span>
                <span>{medicion.total} total</span>
              </div>
            </div>

            {/* Fitting */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fitting</span>
                <span className="text-xs font-bold text-foreground">{fitting.percentage}%</span>
              </div>
              <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fitting.percentage}%`,
                    backgroundColor: colors.gradient,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{fitting.booked} reserv.</span>
                <span>{fitting.total} total</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

