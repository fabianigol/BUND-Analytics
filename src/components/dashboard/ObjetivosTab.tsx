'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LocationTargetProgress } from '@/types'
import { RefreshCw, AlertCircle, Plus } from 'lucide-react'
import { MonthNavigator } from './MonthNavigator'
import { YearlyTrendsSection } from './YearlyTrendsSection'
import { TargetLocationCard } from './TargetLocationCard'
import { TargetDialog } from './TargetDialog'

export function ObjetivosTab() {
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [targets, setTargets] = useState<LocationTargetProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  // Cargar datos del mes seleccionado
  const loadTargetsProgress = useCallback(async (month: Date) => {
    setLoading(true)
    try {
      const year = month.getFullYear()
      const monthNum = month.getMonth() + 1

      const response = await fetch(
        `/api/sales-targets/progress?year=${year}&month=${monthNum}`
      )

      if (response.ok) {
        const data = await response.json()
        setTargets(data)
      } else {
        console.error('Error loading targets progress')
        setTargets([])
      }
    } catch (error) {
      console.error('Error loading targets progress:', error)
      setTargets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTargetsProgress(selectedMonth)
  }, [selectedMonth, loadTargetsProgress])

  const handleOpenEditDialog = (location: string) => {
    setSelectedLocation(location)
    setIsDialogOpen(true)
  }

  const handleOpenNewDialog = () => {
    setSelectedLocation(null)
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedLocation(null)
  }

  const handleSaveTarget = () => {
    // Recargar datos después de guardar
    loadTargetsProgress(selectedMonth)
  }

  return (
    <div className="space-y-6">
      {/* Header con navegación de mes */}
      <MonthNavigator
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Gráficos de Tendencia Anual */}
      <YearlyTrendsSection year={selectedMonth.getFullYear()} />

      {/* Grid de tarjetas por ubicación */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : targets.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targets.map((target) => (
              <TargetLocationCard
                key={target.location}
                target={target}
                onEdit={() => handleOpenEditDialog(target.location)}
              />
            ))}
          </div>

          {/* Botón para añadir nuevo objetivo */}
          <Button onClick={handleOpenNewDialog} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Añadir Objetivo
          </Button>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold mb-2">
                No hay objetivos definidos para este mes
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Comienza creando tu primer objetivo de facturación
              </p>
              <Button onClick={handleOpenNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Objetivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog para crear/editar objetivo */}
      <TargetDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        location={selectedLocation}
        month={selectedMonth}
        onSave={handleSaveTarget}
      />
    </div>
  )
}
