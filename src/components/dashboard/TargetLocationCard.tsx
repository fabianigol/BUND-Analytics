'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatCurrencyByCountry, formatNumber, MXN_TO_EUR_RATE } from '@/lib/utils/format'
import { LocationTargetProgress } from '@/types'
import { Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MetricItem } from './MetricItem'
import { WeekProgressBar } from './WeekProgressBar'

interface TargetLocationCardProps {
  target: LocationTargetProgress
  onEdit: () => void
  className?: string
}

export function TargetLocationCard({ target, onEdit, className }: TargetLocationCardProps) {
  // Detectar país de la ubicación (basado en el nombre)
  const isMexicoLocation = 
    target.location.toLowerCase().includes('méxico') ||
    target.location.toLowerCase().includes('mexico') ||
    target.location.toLowerCase().includes('cdmx')
  const country: 'ES' | 'MX' = isMexicoLocation ? 'MX' : 'ES'
  
  // Detectar si es online
  const isOnline = target.location === 'online'

  // Para México, convertir objetivos de EUR a MXN
  // Los objetivos se guardan en EUR, pero debemos mostrarlos en MXN
  const EUR_TO_MXN_RATE = 1 / MXN_TO_EUR_RATE // ~21.28
  
  const displayTargetRevenue = isMexicoLocation 
    ? target.targetRevenue * EUR_TO_MXN_RATE 
    : target.targetRevenue
  
  const displayTargetAov = isMexicoLocation
    ? target.targetAov * EUR_TO_MXN_RATE
    : target.targetAov
  
  const displayTargetOrders = isMexicoLocation
    ? target.targetOrders // No necesita conversión (es cantidad)
    : target.targetOrders
  
  const displayTargetAppointments = isMexicoLocation
    ? target.targetAppointments // No necesita conversión (es cantidad)
    : target.targetAppointments
  
  // Recalcular progreso con los valores convertidos
  const displayProgressPercentage = displayTargetRevenue > 0
    ? (target.currentRevenue / displayTargetRevenue) * 100
    : 0

  // Usar los mismos colores que LocationBentoCard
  const locationColors: { [key: string]: { primary: string; gradient: string; bg: string } } = {
    'Madrid': { primary: '#3b82f6', gradient: '#60a5fa', bg: 'bg-blue-50' },
    'Barcelona': { primary: '#ef4444', gradient: '#f87171', bg: 'bg-red-50' },
    'Sevilla': { primary: '#f59e0b', gradient: '#fbbf24', bg: 'bg-amber-50' },
    'Málaga': { primary: '#10b981', gradient: '#34d399', bg: 'bg-emerald-50' },
    'Malaga': { primary: '#10b981', gradient: '#34d399', bg: 'bg-emerald-50' },
    'Bilbao': { primary: '#8b5cf6', gradient: '#a78bfa', bg: 'bg-purple-50' },
    'Valencia': { primary: '#ec4899', gradient: '#f472b6', bg: 'bg-pink-50' },
    'Murcia': { primary: '#06b6d4', gradient: '#22d3ee', bg: 'bg-cyan-50' },
    'Zaragoza': { primary: '#f97316', gradient: '#fb923c', bg: 'bg-orange-50' },
    'Ciudad de México': { primary: '#d946ef', gradient: '#e879f9', bg: 'bg-fuchsia-50' },
    'CDMX': { primary: '#d946ef', gradient: '#e879f9', bg: 'bg-fuchsia-50' },
    'México': { primary: '#d946ef', gradient: '#e879f9', bg: 'bg-fuchsia-50' },
    'online': { primary: '#6366f1', gradient: '#818cf8', bg: 'bg-indigo-50' },
  }

  const colors = locationColors[target.location] || {
    primary: '#6b7280',
    gradient: '#9ca3af',
    bg: 'bg-gray-50',
  }

  return (
    <Card className={cn('overflow-hidden border-2 hover:shadow-lg transition-all duration-300', className)}>
      <CardContent className="p-4">
        {/* Header: Nombre tienda + % progreso */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-foreground">{target.location}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {displayProgressPercentage.toFixed(1)}% del objetivo
            </p>
          </div>
          <Badge
            style={{ backgroundColor: colors.primary }}
            className="text-white font-bold"
          >
            {displayProgressPercentage.toFixed(1)}%
          </Badge>
        </div>

        {/* Barra de progreso principal */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span>Facturación</span>
            <span className="font-semibold">
              {formatCurrencyByCountry(target.currentRevenue, country)} / {formatCurrencyByCountry(displayTargetRevenue, country)}
              <span className="ml-2 text-muted-foreground">
                ({displayProgressPercentage.toFixed(1)}%)
              </span>
            </span>
          </div>
          <Progress
            value={Math.min(displayProgressPercentage, 100)}
            className="h-3"
          />
        </div>

        {/* Grid de métricas */}
        <div className={cn("grid gap-3 mb-4", isOnline ? "grid-cols-2" : "grid-cols-2")}>
          {/* Pedidos */}
          <MetricItem
            label="Pedidos"
            current={target.currentOrders}
            target={Math.ceil(displayTargetOrders)}
          />

          {/* AOV */}
          <MetricItem
            label="AOV"
            current={formatCurrencyByCountry(target.currentAov, country)}
            target={formatCurrencyByCountry(displayTargetAov, country)}
            compareValues={true}
          />

          {/* Citas Medición - Solo para tiendas físicas */}
          {!isOnline && (
            <MetricItem
              label="Citas Medición"
              current={target.currentAppointments}
              target={Math.ceil(displayTargetAppointments)}
            />
          )}

          {/* Tasa Conversión - Solo para tiendas físicas */}
          {!isOnline && (
            <MetricItem
              label="Conv. Rate"
              current={`${target.conversionRate.toFixed(1)}%`}
              isInfo
            />
          )}
        </div>

        {/* Desglose semanal */}
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Desglose Semanal
          </p>
          {target.weeklyBreakdown.map((week) => {
            // Para México, convertir objetivos semanales de EUR a MXN
            const displayWeek = isMexicoLocation ? {
              ...week,
              targetRevenue: week.targetRevenue * EUR_TO_MXN_RATE,
              targetOrders: week.targetOrders, // No necesita conversión
              targetAppointments: week.targetAppointments, // No necesita conversión
              revenueProgress: week.targetRevenue > 0 
                ? (week.currentRevenue / (week.targetRevenue * EUR_TO_MXN_RATE)) * 100 
                : 0,
            } : week;
            
            return (
              <WeekProgressBar
                key={week.weekNumber}
                week={displayWeek}
                color={colors.primary}
                isOnline={isOnline}
                country={country}
              />
            );
          })}
        </div>

        {/* Botón editar */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4 mr-2" />
          Editar Objetivo
        </Button>
      </CardContent>
    </Card>
  )
}
