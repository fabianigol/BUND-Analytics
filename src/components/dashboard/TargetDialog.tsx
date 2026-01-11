'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const knownLocations = [
  'Madrid',
  'Sevilla',
  'Málaga',
  'Barcelona',
  'Bilbao',
  'Valencia',
  'Murcia',
  'Zaragoza',
  'México',
  'online',
]

interface TargetDialogProps {
  isOpen: boolean
  onClose: () => void
  location: string | null
  month: Date
  onSave: () => void
}

export function TargetDialog({ isOpen, onClose, location, month, onSave }: TargetDialogProps) {
  const [formData, setFormData] = useState({
    location: location || '',
    targetRevenue: '',
    targetAov: '',
    conversionRate: '50.00',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingOnlineAov, setLoadingOnlineAov] = useState(false)
  const [onlineAov, setOnlineAov] = useState<number | null>(null)

  // Detectar si la ubicación es online
  const isOnline = formData.location === 'online' || location === 'online'

  // Cargar AOV de pedidos online cuando se selecciona "online"
  useEffect(() => {
    if (isOpen && isOnline && month) {
      loadOnlineAov(month)
    }
  }, [isOpen, isOnline, month])

  // Cargar datos existentes si estamos editando
  useEffect(() => {
    if (isOpen && location && month) {
      loadExistingTarget(location, month)
    } else if (isOpen && !location) {
      // Reset form para nuevo objetivo
      setFormData({
        location: '',
        targetRevenue: '',
        targetAov: '',
        conversionRate: '50.00',
      })
      setOnlineAov(null)
    }
  }, [isOpen, location, month])

  const loadOnlineAov = async (monthDate: Date) => {
    try {
      setLoadingOnlineAov(true)
      const year = monthDate.getFullYear()
      const monthNum = monthDate.getMonth() + 1
      
      // Construir fechas del mes
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
      const lastDay = new Date(year, monthNum, 0).getDate()
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      
      const response = await fetch(`/api/shopify?type=metrics&startDate=${startDate}&endDate=${endDate}&onlineOnly=true`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data && data.data.averageOrderValue) {
          setOnlineAov(data.data.averageOrderValue)
          // Actualizar formData con el AOV automáticamente
          setFormData(prev => ({
            ...prev,
            targetAov: data.data.averageOrderValue.toFixed(2)
          }))
        }
      }
    } catch (error) {
      console.error('Error loading online AOV:', error)
    } finally {
      setLoadingOnlineAov(false)
    }
  }

  const loadExistingTarget = async (loc: string, monthDate: Date) => {
    try {
      const year = monthDate.getFullYear()
      const month = monthDate.getMonth() + 1

      const response = await fetch(
        `/api/sales-targets?location=${loc}&year=${year}&month=${month}`
      )

      if (response.ok) {
        const data = await response.json()
        if (data && data.length > 0) {
          const target = data[0]
          setFormData({
            location: target.location,
            targetRevenue: target.target_revenue.toString(),
            targetAov: target.target_aov.toString(),
            conversionRate: target.conversion_rate.toString(),
          })
        }
      }
    } catch (error) {
      console.error('Error loading existing target:', error)
    }
  }

  // Calcular estimaciones en tiempo real
  const targetOrders = parseFloat(formData.targetRevenue) / parseFloat(formData.targetAov) || 0
  const targetAppointments = !isOnline ? targetOrders / (parseFloat(formData.conversionRate) / 100) || 0 : 0

  const handleSave = async () => {
    setError(null)

    // Validaciones
    if (!formData.location || !formData.targetRevenue) {
      setError('Por favor, completa todos los campos requeridos')
      return
    }

    if (parseFloat(formData.targetRevenue) <= 0) {
      setError('El objetivo de facturación debe ser mayor que 0')
      return
    }

    // Para online, el AOV debe estar cargado automáticamente
    if (isOnline && !formData.targetAov) {
      setError('No se pudo cargar el AOV de pedidos online. Intenta de nuevo.')
      return
    }

    // Para tiendas físicas, validar AOV manualmente
    if (!isOnline && !formData.targetAov) {
      setError('Por favor, ingresa el AOV esperado')
      return
    }

    if (parseFloat(formData.targetAov) <= 0) {
      setError('El AOV debe ser mayor que 0')
      return
    }

    // Validar conversión solo para tiendas físicas
    if (!isOnline && (parseFloat(formData.conversionRate) < 0.01 || parseFloat(formData.conversionRate) > 100)) {
      setError('La tasa de conversión debe estar entre 0.01 y 100')
      return
    }

    setLoading(true)

    try {
      const year = month.getFullYear()
      const monthNum = month.getMonth() + 1

      const response = await fetch('/api/sales-targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: formData.location,
          year,
          month: monthNum,
          targetRevenue: parseFloat(formData.targetRevenue),
          targetAov: parseFloat(formData.targetAov),
          // Para online, usar 100% ya que no hay citas intermedias
          conversionRate: isOnline ? 100.0 : parseFloat(formData.conversionRate),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al guardar objetivo')
      }

      // Éxito
      onSave()
      onClose()
    } catch (error: any) {
      console.error('Error saving target:', error)
      setError(error.message || 'Error al guardar objetivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {location ? 'Editar' : 'Crear'} Objetivo de Facturación
          </DialogTitle>
          <DialogDescription>
            {format(month, 'MMMM yyyy', { locale: es })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selector de ubicación */}
          {!location && (
            <div>
              <Label>Ubicación *</Label>
              <Select
                value={formData.location}
                onValueChange={(v) => setFormData({ ...formData, location: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {knownLocations.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {location && (
            <div>
              <Label>Ubicación</Label>
              <Input value={location} disabled className="bg-muted" />
            </div>
          )}

          {/* Objetivo de facturación */}
          <div>
            <Label>Objetivo de Facturación (€) *</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.targetRevenue}
              onChange={(e) => setFormData({ ...formData, targetRevenue: e.target.value })}
              placeholder="50000.00"
            />
          </div>

          {/* AOV esperado - Solo para tiendas físicas */}
          {!isOnline && (
            <div>
              <Label>AOV Esperado (€) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.targetAov}
                onChange={(e) => setFormData({ ...formData, targetAov: e.target.value })}
                placeholder="750.00"
              />
            </div>
          )}

          {/* AOV automático para online */}
          {isOnline && (
            <div>
              <Label>AOV Actual de Pedidos Online (€)</Label>
              <Input
                type="text"
                value={loadingOnlineAov ? 'Cargando...' : formData.targetAov ? `${parseFloat(formData.targetAov).toFixed(2)} €` : '—'}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se usa el AOV real de los pedidos online del mes seleccionado
              </p>
            </div>
          )}

          {/* Tasa de conversión - Solo para tiendas físicas */}
          {!isOnline && (
            <div>
              <Label>Tasa de Conversión (%) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.conversionRate}
                onChange={(e) => setFormData({ ...formData, conversionRate: e.target.value })}
                placeholder="50.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Porcentaje de citas de medición que resultan en compra
              </p>
            </div>
          )}

          {/* Panel de estimaciones */}
          {formData.targetRevenue && formData.targetAov && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Estimaciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pedidos necesarios:</span>
                  <span className="font-bold">{Math.ceil(targetOrders)}</span>
                </div>
                {!isOnline && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Citas de medición necesarias (mes):</span>
                      <span className="font-bold">{Math.ceil(targetAppointments)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Citas de medición necesarias (semana):</span>
                      <span className="font-bold">{Math.ceil(targetAppointments / 4)}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Objetivo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
