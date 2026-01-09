'use client'

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { BarChart, LineChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Calendar,
  TrendingUp,
  Clock,
  XCircle,
  RefreshCw,
  Scissors,
  Ruler,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react'
import { formatNumber } from '@/lib/utils/format'
import { slugToStoreName, getClubImagePath } from '@/lib/utils/storeHelpers'
import { normalizeStoreName } from '@/lib/integrations/acuity'
import { ClubHero } from '@/components/clubs/ClubHero'
import Link from 'next/link'

interface AppointmentStats {
  upcoming: {
    total: number
    byCategory: { medición: number; fitting: number }
    byStore: Array<{
      storeName: string
      medición: number
      fitting: number
      total: number
      employees: Array<{
        employeeName: string
        medición: number
        fitting: number
        total: number
      }>
    }>
  }
  availability: {
    byCategory: {
      medición: { total: number; available: number; booked: number }
      fitting: { total: number; available: number; booked: number }
    }
    byStore: Array<{
      storeName: string
      medición: { total: number; available: number; booked: number }
      fitting: { total: number; available: number; booked: number }
    }>
  }
  occupation: {
    byCategory: {
      medición: { booked: number; total: number; percentage: number }
      fitting: { booked: number; total: number; percentage: number }
      overall: { booked: number; total: number; percentage: number }
    }
    byStore: Array<{
      storeName: string
      medición: { booked: number; total: number; percentage: number }
      fitting: { booked: number; total: number; percentage: number }
      overall: { booked: number; total: number; percentage: number }
      employees: Array<{
        employeeName: string
        medición: { booked: number; total: number; percentage: number }
        fitting: { booked: number; total: number; percentage: number }
        overall: { booked: number; total: number; percentage: number }
      }>
    }>
  }
  monthly: {
    byMonth: Array<{ year: number; month: number; medición: number; fitting: number; total: number }>
  }
  daily: {
    year: number
    month: number
    byDay: Array<{ name: string; 'Medición': number; 'Fitting': number; 'Total': number; 'Canceladas'?: number }>
  }
  cancellations: {
    byCategory: {
      medición: { canceled: number; rescheduled: number }
      fitting: { canceled: number; rescheduled: number }
      total: { canceled: number; rescheduled: number }
    }
  }
}

export default function ClubDetailPage() {
  const params = useParams()
  const router = useRouter()
  const storeSlug = params.storeName as string
  const storeName = slugToStoreName(storeSlug)
  const normalizedStoreName = normalizeStoreName(storeName)

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Partial<AppointmentStats>>({})
  const [dailyStats, setDailyStats] = useState<Partial<AppointmentStats['daily']>>({})
  const [selectedMonth, setSelectedMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
  const [appointments, setAppointments] = useState<Array<{ datetime: string; appointment_type_name: string; appointment_category: string }>>([])
  const [monthlyCancellations, setMonthlyCancellations] = useState<Map<string, { medición: number; fitting: number; total: number; canceladas: number }>>(new Map())
  
  // Procesar datos para gráficas de horas y días
  const getHourlyData = () => {
    const hourCounts = new Map<number, number>()
    console.log(`[Club Detail] Processing ${appointments.length} appointments for hourly data`)
    appointments.forEach(apt => {
      try {
        const date = new Date(apt.datetime)
        if (isNaN(date.getTime())) {
          console.warn(`[Club Detail] Invalid date: ${apt.datetime}`)
          return
        }
        const hour = date.getHours()
        // Solo incluir horas de 10:00 a 22:00
        if (hour >= 10 && hour <= 22) {
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
        }
      } catch (error) {
        console.error(`[Club Detail] Error processing appointment date:`, apt, error)
      }
    })
    // Solo generar datos para horas de 10:00 a 22:00
    return Array.from({ length: 13 }, (_, i) => {
      const hour = i + 10 // De 10 a 22
      return {
        name: `${String(hour).padStart(2, '0')}:00`,
        value: hourCounts.get(hour) || 0,
      }
    })
  }

  const getDayOfWeekData = () => {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const dayCounts = new Map<number, number>()
    appointments.forEach(apt => {
      try {
        const date = new Date(apt.datetime)
        if (isNaN(date.getTime())) {
          console.warn(`[Club Detail] Invalid date: ${apt.datetime}`)
          return
        }
        const dayOfWeek = date.getDay()
        dayCounts.set(dayOfWeek, (dayCounts.get(dayOfWeek) || 0) + 1)
      } catch (error) {
        console.error(`[Club Detail] Error processing appointment date:`, apt, error)
      }
    })
    return Array.from({ length: 7 }, (_, i) => ({
      name: dayNames[i],
      value: dayCounts.get(i) || 0,
    }))
  }

  const getMedicionTypeData = () => {
    const typeCounts = new Map<string, number>()
    const baseName = normalizeStoreName(storeName)
    
    const medicionAppointments = appointments.filter(apt => apt.appointment_category === 'medición')
    console.log(`[Club Detail] Processing ${medicionAppointments.length} medición appointments`)
    console.log(`[Club Detail] Base store name: "${baseName}"`)
    
    medicionAppointments.forEach(apt => {
      const typeName = apt.appointment_type_name || 'Unknown'
      console.log(`[Club Detail] Processing appointment type: "${typeName}"`)
      
      // IMPORTANTE: NO normalizar todavía, primero verificar si tiene "+"
      // La normalización elimina todo después del "+", así que debemos detectar antes
      const plusIndex = typeName.indexOf('+')
      
      if (plusIndex !== -1) {
        // Tiene un "+", extraer la variación
        const beforePlus = typeName.substring(0, plusIndex).trim()
        const afterPlus = typeName.substring(plusIndex + 1).trim()
        
        // Verificar que la parte antes del "+" pertenece a esta tienda
        const normalizedBeforePlus = normalizeStoreName(beforePlus)
        
        if (normalizedBeforePlus === baseName) {
          // Normalizar variaciones comunes para agruparlas
          const variationLower = afterPlus.toLowerCase()
          let normalizedVariation: string
          
          // Patrones más flexibles para capturar variaciones
          if (variationLower.match(/añadir\s*1\s*persona/i) || 
              variationLower.match(/1\s*acompañante/i) || 
              variationLower.match(/añadir\s*1/i) ||
              variationLower.match(/añadir\s*una\s*persona/i) ||
              variationLower.match(/una\s*persona\s*más/i)) {
            normalizedVariation = '+ 1 acompañante'
          } else if (variationLower.match(/añadir\s*2\s*personas/i) || 
                     variationLower.match(/2\s*acompañantes/i) || 
                     variationLower.match(/añadir\s*2/i) ||
                     variationLower.match(/añadir\s*dos\s*personas/i) ||
                     variationLower.match(/dos\s*personas\s*más/i)) {
            normalizedVariation = '+ 2 acompañantes'
          } else if (variationLower.match(/informarme/i) || 
                     variationLower.match(/información/i) || 
                     variationLower.match(/solo\s*quiero/i) ||
                     variationLower.match(/quiero\s*informarme/i) ||
                     variationLower.match(/solo\s*información/i)) {
            normalizedVariation = '+ Solo quiero informarme'
          } else {
            // Mantener la variación original pero con el prefijo "+"
            normalizedVariation = '+ ' + afterPlus
          }
          
          console.log(`[Club Detail] Found variation: "${afterPlus}" -> normalized to "${normalizedVariation}"`)
          typeCounts.set(normalizedVariation, (typeCounts.get(normalizedVariation) || 0) + 1)
        } else {
          console.log(`[Club Detail] Type "${typeName}" doesn't match store "${baseName}" (beforePlus: "${beforePlus}", normalized: "${normalizedBeforePlus}")`)
        }
      } else {
        // No tiene "+", verificar si es el tipo base
        const normalizedTypeName = normalizeStoreName(typeName)
        if (normalizedTypeName === baseName) {
          console.log(`[Club Detail] Found base type: "${typeName}"`)
          typeCounts.set('Base', (typeCounts.get('Base') || 0) + 1)
        } else {
          console.log(`[Club Detail] Type "${typeName}" (normalized: "${normalizedTypeName}") doesn't match store "${baseName}"`)
        }
      }
    })
    
    const result = Array.from(typeCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => {
        // Ordenar: Base primero, luego por valor descendente
        if (a.name === 'Base') return -1
        if (b.name === 'Base') return 1
        return b.value - a.value
      })
    
    console.log(`[Club Detail] Final medicion type data:`, result)
    return result
  }

  // Filtrar datos por tienda
  const getStoreData = () => {
    const storeUpcoming = stats.upcoming?.byStore.find(s => 
      normalizeStoreName(s.storeName) === normalizedStoreName
    )
    const storeAvailability = stats.availability?.byStore.find(s => 
      normalizeStoreName(s.storeName) === normalizedStoreName
    )
    const storeOccupation = stats.occupation?.byStore.find(s => 
      normalizeStoreName(s.storeName) === normalizedStoreName
    )

    return {
      upcoming: storeUpcoming,
      availability: storeAvailability,
      occupation: storeOccupation,
    }
  }

  const storeData = getStoreData()
  
  const hourlyData = getHourlyData()
  const dayOfWeekData = getDayOfWeekData()
  const medicionTypeData = getMedicionTypeData()

  const fetchStats = async () => {
    try {
      setLoading(true)
      const today = new Date()
      const startDate = format(today, 'yyyy-MM-dd')
      
      const [upcomingRes, availabilityRes, occupationRes, monthlyRes, cancellationsRes] = await Promise.all([
        fetch(`/api/acuity/stats?type=upcoming&days=365&startDate=${startDate}`),
        fetch(`/api/acuity/stats?type=availability&days=365&startDate=${startDate}`),
        fetch(`/api/acuity/stats?type=occupation&days=365&startDate=${startDate}`),
        fetch('/api/acuity/stats?type=monthly&months=12'),
        fetch(`/api/acuity/stats?type=cancellations&startDate=${startDate}`),
      ])

      if (!upcomingRes.ok || !availabilityRes.ok || !occupationRes.ok || !monthlyRes.ok || !cancellationsRes.ok) {
        throw new Error('Failed to fetch stats')
      }

      const [upcoming, availability, occupation, monthly, cancellations] = await Promise.all([
        upcomingRes.json(),
        availabilityRes.json(),
        occupationRes.json(),
        monthlyRes.json(),
        cancellationsRes.json(),
      ])

      setStats({
        upcoming: upcoming.type === 'upcoming' ? upcoming : null,
        availability: availability.type === 'availability' ? availability : null,
        occupation: occupation.type === 'occupation' ? occupation : null,
        monthly: monthly.type === 'monthly' ? monthly : null,
        cancellations: cancellations.type === 'cancellations' ? cancellations : null,
      })

      // Obtener citas individuales para análisis de horas y días
      // Hacer una query adicional para obtener las citas sin canceladas
      // Incluir citas pasadas también para tener más datos históricos
      try {
        const pastDate = new Date(today)
        pastDate.setFullYear(pastDate.getFullYear() - 1) // Incluir 1 año hacia atrás
        const pastStartDate = format(pastDate, 'yyyy-MM-dd')
        
        const appointmentsRes = await fetch(`/api/acuity/appointments?store=${encodeURIComponent(storeName)}&startDate=${pastStartDate}`)
        if (appointmentsRes.ok) {
          const appointmentsData = await appointmentsRes.json()
          console.log(`[Club Detail] Fetched ${appointmentsData.count || 0} appointments for store ${storeName}`)
          setAppointments(appointmentsData.appointments || [])
        } else {
          const errorText = await appointmentsRes.text()
          console.error('[Club Detail] Error fetching appointments:', errorText)
        }
      } catch (error) {
        console.error('Error fetching appointments for analysis:', error)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  // Debug: Log cuando cambian los appointments
  useEffect(() => {
    if (appointments.length > 0) {
      console.log(`[Club Detail] Appointments updated: ${appointments.length} total`)
      console.log(`[Club Detail] Sample appointment:`, appointments[0])
      const hourly = getHourlyData().filter(h => h.value > 0)
      const days = getDayOfWeekData().filter(d => d.value > 0)
      const medicion = getMedicionTypeData()
      console.log(`[Club Detail] Hourly data points with values:`, hourly.length, hourly)
      console.log(`[Club Detail] Day of week data points with values:`, days.length, days)
      console.log(`[Club Detail] Medición type data points:`, medicion.length, medicion)
    } else {
      console.log(`[Club Detail] No appointments loaded yet`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments.length])

  useEffect(() => {
    const fetchDailyStats = async () => {
      try {
        // Obtener citas directamente filtradas por tienda para este mes
        const monthStart = new Date(selectedMonth.year, selectedMonth.month - 1, 1)
        const monthEnd = new Date(selectedMonth.year, selectedMonth.month, 0, 23, 59, 59, 999)
        const startStr = format(monthStart, 'yyyy-MM-dd')
        const endStr = format(monthEnd, 'yyyy-MM-dd')

        const appointmentsRes = await fetch(
          `/api/acuity/appointments?store=${encodeURIComponent(storeName)}&startDate=${startStr}&endDate=${endStr}`
        )
        
        if (appointmentsRes.ok) {
          const appointmentsData = await appointmentsRes.json()
          
          // Agrupar citas por día
          const dayData = new Map<number, { medición: number; fitting: number; total: number; canceladas: number }>()
          
          // Inicializar todos los días del mes
          const daysInMonth = new Date(selectedMonth.year, selectedMonth.month, 0).getDate()
          for (let day = 1; day <= daysInMonth; day++) {
            dayData.set(day, { medición: 0, fitting: 0, total: 0, canceladas: 0 })
          }
          
          // Procesar citas
          appointmentsData.appointments?.forEach((apt: any) => {
            if (normalizeStoreName(apt.appointment_type_name || '') === normalizedStoreName) {
              const date = new Date(apt.datetime)
              const day = date.getDate()
              const data = dayData.get(day)
              
              if (data) {
                if (apt.status === 'canceled') {
                  data.canceladas++
                } else {
                  const category = apt.appointment_category?.toLowerCase() || ''
                  if (category === 'medición') {
                    data.medición++
                    data.total++
                  } else if (category === 'fitting') {
                    data.fitting++
                    data.total++
                  }
                }
                dayData.set(day, data)
              }
            }
          })
          
          // Convertir a formato de gráfica
          const byDay = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const data = dayData.get(day) || { medición: 0, fitting: 0, total: 0, canceladas: 0 }
            return {
              name: String(day),
              'Medición': data.medición,
              'Fitting': data.fitting,
              'Total': data.total,
              'Canceladas': data.canceladas,
            }
          })
          
          setDailyStats({
            year: selectedMonth.year,
            month: selectedMonth.month,
            byDay,
          })
        }
      } catch (error) {
        console.error('Error fetching daily stats:', error)
      }
    }

    fetchDailyStats()
  }, [selectedMonth, storeName, normalizedStoreName])

  // Preparar datos mensuales filtrados por tienda
  // Necesitamos obtener todas las citas y agruparlas por mes
  useEffect(() => {
    const fetchMonthlyData = async () => {
      if (!stats.monthly?.byMonth || stats.monthly.byMonth.length === 0) return

      const monthlyMap = new Map<string, { medición: number; fitting: number; total: number; canceladas: number }>()
      
      // Obtener datos para cada mes
      const promises = stats.monthly.byMonth.map(async (month) => {
        const monthStart = new Date(month.year, month.month - 1, 1)
        const monthEnd = new Date(month.year, month.month, 0, 23, 59, 59, 999)
        const startStr = format(monthStart, 'yyyy-MM-dd')
        const endStr = format(monthEnd, 'yyyy-MM-dd')
        const monthKey = `${month.year}-${String(month.month).padStart(2, '0')}`

        try {
          const response = await fetch(
            `/api/acuity/appointments?store=${encodeURIComponent(storeName)}&startDate=${startStr}&endDate=${endStr}`
          )
          if (response.ok) {
            const data = await response.json()
            let medición = 0
            let fitting = 0
            let total = 0
            let canceladas = 0
            
            data.appointments?.forEach((apt: any) => {
              if (normalizeStoreName(apt.appointment_type_name || '') === normalizedStoreName) {
                if (apt.status === 'canceled') {
                  canceladas++
                } else {
                  const category = apt.appointment_category?.toLowerCase() || ''
                  if (category === 'medición') {
                    medición++
                    total++
                  } else if (category === 'fitting') {
                    fitting++
                    total++
                  }
                }
              }
            })
            
            monthlyMap.set(monthKey, { medición, fitting, total, canceladas })
          }
        } catch (error) {
          console.error(`Error fetching data for ${monthKey}:`, error)
        }
      })

      await Promise.all(promises)
      setMonthlyCancellations(monthlyMap)
    }

    fetchMonthlyData()
  }, [stats.monthly, storeName, normalizedStoreName])

  const monthlyData = stats.monthly?.byMonth
    .map(month => {
      const monthKey = `${month.year}-${String(month.month).padStart(2, '0')}`
      const data = monthlyCancellations.get(monthKey) || { medición: 0, fitting: 0, total: 0, canceladas: 0 }
      return {
        name: monthKey,
        year: month.year,
        month: month.month,
        'Medición': data.medición,
        'Fitting': data.fitting,
        Total: data.total,
        'Canceladas': data.canceladas,
      }
    }) || []

  // Datos diarios filtrados
  const dailyDataForMonth = dailyStats.year === selectedMonth.year && dailyStats.month === selectedMonth.month
    ? (dailyStats.byDay || [])
    : []

  const getMonthName = (year: number, month: number) => {
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedMonth.year, selectedMonth.month - 1 + (direction === 'next' ? 1 : -1), 1)
    setSelectedMonth({ year: newDate.getFullYear(), month: newDate.getMonth() + 1 })
  }

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title={storeName} subtitle="Detalles del club" />
        <div className="flex-1 flex items-center justify-center p-6">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!storeData.upcoming) {
    return (
      <div className="flex flex-col">
        <Header title={storeName} subtitle="Detalles del club" />
        <div className="flex-1 flex items-center justify-center p-6 pt-0">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No se encontraron datos para este club.</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => router.push('/citas')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Citas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header title={storeName} subtitle="Detalles del club" />

      <div className="flex-1 space-y-6 p-6">
        {/* Pestañas de navegación */}
        <Tabs value="club-detail" className="w-full">
          <TabsList>
            <TabsTrigger value="general" onClick={() => router.push('/citas')}>
              General
            </TabsTrigger>
            <TabsTrigger value="clubs" onClick={() => router.push('/citas')}>
              Clubs
            </TabsTrigger>
            <TabsTrigger value="comparativas" onClick={() => router.push('/citas')}>
              Comparativas
            </TabsTrigger>
            <TabsTrigger value="club-detail">
              Detalle Club
            </TabsTrigger>
          </TabsList>

          <TabsContent value="club-detail" className="space-y-6 mt-6">
            {/* Imagen Hero */}
            <ClubHero storeName={storeName} slug={storeSlug} />

        {/* KPIs Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Citas Reservadas"
            value={formatNumber(storeData.upcoming?.total || 0)}
            subtitle={`Medición: ${formatNumber(storeData.upcoming?.medición || 0)} • Fitting: ${formatNumber(storeData.upcoming?.fitting || 0)}`}
            icon={Calendar}
            iconColor="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
          />
          <MetricCard
            title="Citas Disponibles"
            value={formatNumber(
              (storeData.availability?.medición?.available || 0) +
              (storeData.availability?.fitting?.available || 0)
            )}
            subtitle={`Medición: ${formatNumber(storeData.availability?.medición?.available || 0)} • Fitting: ${formatNumber(storeData.availability?.fitting?.available || 0)}`}
            icon={Clock}
            iconColor="bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
          />
          <MetricCard
            title="% Ocupación"
            value={`${storeData.occupation?.overall.percentage || 0}%`}
            subtitle={`Medición: ${storeData.occupation?.medición.percentage || 0}% • Fitting: ${storeData.occupation?.fitting.percentage || 0}%`}
            icon={TrendingUp}
            iconColor="bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
          />
          <MetricCard
            title="Canceladas"
            value={formatNumber(stats.cancellations?.byCategory.total?.canceled || 0)}
            subtitle={`Medición: ${formatNumber(stats.cancellations?.byCategory.medición?.canceled || 0)} • Fitting: ${formatNumber(stats.cancellations?.byCategory.fitting?.canceled || 0)}`}
            icon={XCircle}
            iconColor="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
          />
        </div>

        {/* Desglose Diario */}
        {dailyDataForMonth.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Desglose Diario</CardTitle>
                  <CardDescription>{getMonthName(selectedMonth.year, selectedMonth.month)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateMonth('prev')}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[150px] text-center font-medium">
                    {getMonthName(selectedMonth.year, selectedMonth.month)}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateMonth('next')}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <LineChart
                title=""
                data={dailyDataForMonth}
                xAxisKey="name"
                lines={[
                  { dataKey: 'Medición', name: 'Medición', color: 'var(--chart-1)' },
                  { dataKey: 'Fitting', name: 'Fitting', color: 'var(--chart-2)' },
                  { dataKey: 'Total', name: 'Total', color: 'var(--chart-3)' },
                  { dataKey: 'Canceladas', name: 'Canceladas', color: 'var(--destructive)', strokeWidth: 2, dashed: true },
                ]}
                formatValue={(v) => formatNumber(v)}
                height={300}
              />
            </CardContent>
          </Card>
        )}

        {/* Sección de 3 columnas: Horas, Días, Tipos de Medición */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Horas Preferidas */}
          <Card>
            <CardHeader>
              <CardTitle>Tendencias de Horas Preferidas</CardTitle>
              <CardDescription>Distribución de citas por hora del día</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyData.length > 0 ? (
                <BarChart
                  title=""
                  data={hourlyData}
                  formatValue={(v) => formatNumber(v)}
                  height={250}
                  color="#8B0000"
                />
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Días Preferidos */}
          <Card>
            <CardHeader>
              <CardTitle>Tendencias de Días Preferidos</CardTitle>
              <CardDescription>Distribución de citas por día de la semana</CardDescription>
            </CardHeader>
            <CardContent>
              {dayOfWeekData.length > 0 ? (
                <BarChart
                  title=""
                  data={dayOfWeekData}
                  formatValue={(v) => formatNumber(v)}
                  height={250}
                  color="#8B0000"
                />
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tipos de Citas de Medición */}
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Citas - Medición</CardTitle>
              <CardDescription>Variaciones de citas de medición</CardDescription>
            </CardHeader>
            <CardContent>
              {medicionTypeData.length > 0 ? (
                <BarChart
                  title=""
                  data={medicionTypeData}
                  formatValue={(v) => formatNumber(v)}
                  height={250}
                  color="#8B0000"
                />
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Gráfica de Tendencia Mensual */}
        {monthlyData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tendencia Mensual</CardTitle>
              <CardDescription>Evolución de citas por mes</CardDescription>
            </CardHeader>
            <CardContent>
              <LineChart
                title=""
                data={monthlyData}
                xAxisKey="name"
                lines={[
                  { dataKey: 'Medición', name: 'Medición', color: 'var(--chart-1)' },
                  { dataKey: 'Fitting', name: 'Fitting', color: 'var(--chart-2)' },
                  { dataKey: 'Total', name: 'Total', color: 'var(--chart-3)' },
                  { dataKey: 'Canceladas', name: 'Canceladas', color: 'var(--destructive)', strokeWidth: 2, dashed: true },
                ]}
                formatValue={(v) => formatNumber(v)}
                height={400}
              />
            </CardContent>
          </Card>
        )}

        {/* Comparación en 2 columnas: Medición vs Fitting y Reservadas vs Canceladas */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Comparación Medición vs Fitting */}
          {storeData.upcoming && (
            <Card>
              <CardHeader>
                <CardTitle>Comparación Medición vs Fitting</CardTitle>
                <CardDescription>Distribución de citas por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  title=""
                  data={[
                    { name: 'Medición', value: storeData.upcoming.medición },
                    { name: 'Fitting', value: storeData.upcoming.fitting },
                  ]}
                  formatValue={(v) => formatNumber(v)}
                  height={300}
                  color="#8B0000"
                />
              </CardContent>
            </Card>
          )}

          {/* Comparación Reservadas vs Canceladas */}
          {stats.cancellations && (
            <Card>
              <CardHeader>
                <CardTitle>Comparación Reservadas vs Canceladas</CardTitle>
                <CardDescription>Distribución de citas reservadas y canceladas</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  title=""
                  data={[
                    { name: 'Reservadas', value: storeData.upcoming?.total || 0 },
                    { name: 'Canceladas', value: stats.cancellations.byCategory.total.canceled },
                  ]}
                  formatValue={(v) => formatNumber(v)}
                  height={300}
                  color="#8B0000"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabla de Empleados */}
        {storeData.upcoming.employees && storeData.upcoming.employees.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rendimiento por Empleado</CardTitle>
              <CardDescription>Desglose de citas por empleado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Empleado</th>
                      <th className="text-right p-2 font-medium">Medición</th>
                      <th className="text-right p-2 font-medium">Fitting</th>
                      <th className="text-right p-2 font-medium">Total</th>
                      <th className="text-right p-2 font-medium">% Ocupación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeData.upcoming.employees.map((employee) => {
                      const employeeOccupation = storeData.occupation?.employees.find(
                        e => e.employeeName === employee.employeeName
                      )
                      return (
                        <tr key={employee.employeeName} className="border-b">
                          <td className="p-2 font-medium">{employee.employeeName}</td>
                          <td className="p-2 text-right">
                            <Badge variant="outline">
                              <Ruler className="h-3 w-3 mr-1" />
                              {formatNumber(employee.medición)}
                            </Badge>
                          </td>
                          <td className="p-2 text-right">
                            <Badge variant="outline">
                              <Scissors className="h-3 w-3 mr-1" />
                              {formatNumber(employee.fitting)}
                            </Badge>
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {formatNumber(employee.total)}
                          </td>
                          <td className="p-2 text-right">
                            <Badge
                              variant={employeeOccupation?.overall.percentage && employeeOccupation.overall.percentage > 80 ? 'destructive' : 'secondary'}
                            >
                              {employeeOccupation?.overall.percentage || 0}%
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Análisis de Cancelaciones */}
        {stats.cancellations && (
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Cancelaciones</CardTitle>
              <CardDescription>Cancelaciones y reagendamientos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Total Canceladas</div>
                  <div className="text-3xl font-bold">{formatNumber(stats.cancellations.byCategory.total.canceled)}</div>
                  <div className="text-sm">
                    Medición: {formatNumber(stats.cancellations.byCategory.medición.canceled)} • 
                    Fitting: {formatNumber(stats.cancellations.byCategory.fitting.canceled)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Total Reagendadas</div>
                  <div className="text-3xl font-bold">{formatNumber(stats.cancellations.byCategory.total.rescheduled)}</div>
                  <div className="text-sm">
                    Medición: {formatNumber(stats.cancellations.byCategory.medición.rescheduled)} • 
                    Fitting: {formatNumber(stats.cancellations.byCategory.fitting.rescheduled)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

