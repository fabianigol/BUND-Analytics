'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
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
  // Detectar si es online
  const isOnline = target.location === 'online'

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
              {target.progressPercentage.toFixed(1)}% del objetivo
            </p>
          </div>
          <Badge
            style={{ backgroundColor: colors.primary }}
            className="text-white font-bold"
          >
            {target.progressPercentage.toFixed(1)}%
          </Badge>
        </div>

        {/* Barra de progreso principal */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span>Facturación</span>
            <span className="font-semibold">
              {formatCurrency(target.currentRevenue)} / {formatCurrency(target.targetRevenue)}
              <span className="ml-2 text-muted-foreground">
                ({target.progressPercentage.toFixed(1)}%)
              </span>
            </span>
          </div>
          <Progress
            value={Math.min(target.progressPercentage, 100)}
            className="h-3"
          />
        </div>

        {/* Grid de métricas */}
        <div className={cn("grid gap-3 mb-4", isOnline ? "grid-cols-2" : "grid-cols-2")}>
          {/* Pedidos */}
          <MetricItem
            label="Pedidos"
            current={target.currentOrders}
            target={Math.ceil(target.targetOrders)}
          />

          {/* AOV */}
          <MetricItem
            label="AOV"
            current={formatCurrency(target.currentAov)}
            target={formatCurrency(target.targetAov)}
            compareValues={true}
          />

          {/* Citas Medición - Solo para tiendas físicas */}
          {!isOnline && (
            <MetricItem
              label="Citas Medición"
              current={target.currentAppointments}
              target={Math.ceil(target.targetAppointments)}
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
          {target.weeklyBreakdown.map((week) => (
            <WeekProgressBar
              key={week.weekNumber}
              week={week}
              color={colors.primary}
              isOnline={isOnline}
            />
          ))}
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
