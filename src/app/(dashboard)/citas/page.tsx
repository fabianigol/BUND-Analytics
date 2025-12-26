'use client'

import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { BarChart, LineChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  ChevronDown,
} from 'lucide-react'
import { formatNumber, formatCompactNumber } from '@/lib/utils/format'
import Link from 'next/link'
import { storeNameToSlug } from '@/lib/utils/storeHelpers'
import Image from 'next/image'

type CategoryFilter = 'all' | 'medición' | 'fitting'

/**
 * Convierte el nombre completo de una tienda a su acrónimo
 */
function getStoreAcronym(storeName: string): string {
  const storeLower = storeName.toLowerCase()
  
  // Mapeo de tiendas a acrónimos
  const acronymMap: Record<string, string> = {
    'madrid': 'MAD',
    'málaga': 'MLG',
    'malaga': 'MLG',
    'sevilla': 'SEV',
    'bilbao': 'BIL',
    'barcelona': 'BCN',
    'valencia': 'VAL',
    'murcia': 'MUR',
    'zaragoza': 'ZAR',
    'cdmx': 'CDMX',
    'polanco': 'CDMX',
  }
  
  // Buscar coincidencias en el nombre
  for (const [key, acronym] of Object.entries(acronymMap)) {
    if (storeLower.includes(key)) {
      return acronym
    }
  }
  
  // Si no hay coincidencia, intentar extraer las iniciales de "The Bundclub [Ciudad]"
  const match = storeName.match(/The Bundclub\s+([A-Za-z]+)/i)
  if (match && match[1]) {
    const city = match[1].toUpperCase()
    // Si la ciudad tiene 3 o menos letras, usar directamente
    if (city.length <= 3) {
      return city
    }
    // Si no, usar las primeras 3 letras
    return city.substring(0, 3)
  }
  
  // Fallback: usar las primeras 3 letras del nombre
  return storeName.substring(0, 3).toUpperCase()
}

interface AppointmentStats {
  upcoming: {
    total: number
    byCategory: { medición: number; fitting: number }
    byCalendar: Array<{ calendarName: string; medición: number; fitting: number; total: number }>
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
    byCalendar: Array<{
      calendarName: string
      medición: { total: number; available: number; booked: number }
      fitting: { total: number; available: number; booked: number }
    }>
    byStore: Array<{
      storeName: string
      medición: { total: number; available: number; booked: number }
      fitting: { total: number; available: number; booked: number }
      employees: Array<{
        employeeName: string
        medición: { total: number; available: number; booked: number }
        fitting: { total: number; available: number; booked: number }
      }>
    }>
  }
  occupation: {
    byCategory: {
      medición: { booked: number; total: number; percentage: number }
      fitting: { booked: number; total: number; percentage: number }
      overall: { booked: number; total: number; percentage: number }
    }
    byCalendar: Array<{
      calendarName: string
      medición: { booked: number; total: number; percentage: number }
      fitting: { booked: number; total: number; percentage: number }
      overall: { booked: number; total: number; percentage: number }
    }>
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
    byDay: Array<{ name: string; 'Medición': number; 'Fitting': number; 'Total': number }>
  }
  cancellations: {
    byCategory: {
      medición: { canceled: number; rescheduled: number }
      fitting: { canceled: number; rescheduled: number }
      total: { canceled: number; rescheduled: number }
    }
  }
}

export default function CitasPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Partial<AppointmentStats>>({})
  const [dailyStats, setDailyStats] = useState<Partial<AppointmentStats['daily']>>({})
  
  // Estado para el mes seleccionado en el histórico mensual
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  
  // Estado para filtros de período (fecha de inicio y fin)
  const [periodStartDate, setPeriodStartDate] = useState<string>(format(today, 'yyyy-MM-dd'))
  const [periodEndDate, setPeriodEndDate] = useState<string>('')
  
  // Estado para el mes seleccionado en los gráficos de barras
  const [barsSelectedMonth, setBarsSelectedMonth] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  
  // Estado para controlar qué tiendas están expandidas en la tabla jerárquica
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set())

  // Ajustar mes seleccionado cuando cambian los datos
  useEffect(() => {
    if (stats.monthly?.byMonth && stats.monthly.byMonth.length > 0) {
      const availableMonths = stats.monthly.byMonth
        .map(m => ({ year: m.year, month: m.month }))
        .filter((m, index, self) => 
          index === self.findIndex(t => t.year === m.year && t.month === m.month)
        )
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.month - b.month
        })

      if (availableMonths.length > 0) {
        // Si el mes seleccionado no está en los datos disponibles, seleccionar el más reciente
        const currentExists = availableMonths.some(
          m => m.year === selectedMonth.year && m.month === selectedMonth.month
        )
        
        if (!currentExists) {
          // Seleccionar el mes más reciente (último en el array ordenado)
          setSelectedMonth(availableMonths[availableMonths.length - 1])
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.monthly])

  // Fetch datos diarios cuando cambia el mes seleccionado
  useEffect(() => {
    const fetchDailyStats = async () => {
      try {
        const response = await fetch(
          `/api/acuity/stats?type=daily&year=${selectedMonth.year}&month=${selectedMonth.month}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.type === 'daily') {
            setDailyStats(data)
          } else {
            setDailyStats({})
          }
        } else {
          setDailyStats({})
        }
      } catch (error) {
        console.error('Error fetching daily stats:', error)
        setDailyStats({})
      }
    }

    fetchDailyStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  const fetchStats = async () => {
    try {
      setLoading(true)
      
      // Construir parámetros de fecha para el período seleccionado
      const dateParams = periodEndDate 
        ? `&startDate=${periodStartDate}&endDate=${periodEndDate}`
        : ''
      
      const [upcomingRes, availabilityRes, occupationRes, monthlyRes, cancellationsRes] = await Promise.all([
        fetch(`/api/acuity/stats?type=upcoming&days=21${dateParams}`),
        fetch(`/api/acuity/stats?type=availability&days=21${dateParams}`),
        fetch(`/api/acuity/stats?type=occupation&days=21${dateParams}`),
        fetch('/api/acuity/stats?type=monthly&months=12'),
        fetch(`/api/acuity/stats?type=cancellations${dateParams}`),
      ])

      // Verificar que las respuestas sean exitosas
      if (!upcomingRes.ok) {
        const errorText = await upcomingRes.text()
        console.error('Error fetching upcoming:', errorText)
        throw new Error(`Failed to fetch upcoming: ${errorText}`)
      }
      if (!availabilityRes.ok) {
        const errorText = await availabilityRes.text()
        console.error('Error fetching availability:', errorText)
        throw new Error(`Failed to fetch availability: ${errorText}`)
      }
      if (!occupationRes.ok) {
        const errorText = await occupationRes.text()
        console.error('Error fetching occupation:', errorText)
        throw new Error(`Failed to fetch occupation: ${errorText}`)
      }
      if (!monthlyRes.ok) {
        const errorText = await monthlyRes.text()
        console.error('Error fetching monthly:', errorText)
        throw new Error(`Failed to fetch monthly: ${errorText}`)
      }
      if (!cancellationsRes.ok) {
        const errorText = await cancellationsRes.text()
        console.error('Error fetching cancellations:', errorText)
        throw new Error(`Failed to fetch cancellations: ${errorText}`)
      }

      const [upcoming, availability, occupation, monthly, cancellations] = await Promise.all([
        upcomingRes.json(),
        availabilityRes.json(),
        occupationRes.json(),
        monthlyRes.json(),
        cancellationsRes.json(),
      ])

      console.log('Stats fetched:', {
        upcoming: upcoming?.total || 0,
        availability: availability?.byCategory ? 'OK' : 'Missing',
        occupation: occupation?.byCategory ? 'OK' : 'Missing',
        monthly: monthly?.byMonth?.length || 0,
        cancellations: cancellations?.byCategory ? 'OK' : 'Missing',
      })

      setStats({
        upcoming: upcoming.type === 'upcoming' ? upcoming : null,
        availability: availability.type === 'availability' ? availability : null,
        occupation: occupation.type === 'occupation' ? occupation : null,
        monthly: monthly.type === 'monthly' ? monthly : null,
        cancellations: cancellations.type === 'cancellations' ? cancellations : null,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
      // Mostrar error al usuario
      alert(`Error al cargar estadísticas: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  // Fetch datos diarios cuando cambia el mes seleccionado
  useEffect(() => {
    const fetchDailyStats = async () => {
      try {
        const response = await fetch(
          `/api/acuity/stats?type=daily&year=${selectedMonth.year}&month=${selectedMonth.month}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.type === 'daily') {
            setDailyStats(data)
          }
        }
      } catch (error) {
        console.error('Error fetching daily stats:', error)
        setDailyStats({})
      }
    }

    if (stats.monthly?.byMonth && stats.monthly.byMonth.length > 0) {
      fetchDailyStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  // Filtrar datos según categoría seleccionada
  const getFilteredData = () => {
    if (categoryFilter === 'all') return stats

    const filtered = { ...stats }
    
    if (filtered.upcoming) {
      filtered.upcoming = {
        ...filtered.upcoming,
        total: filtered.upcoming.byCategory[categoryFilter],
        byCalendar: filtered.upcoming.byCalendar.map(cal => ({
          ...cal,
          total: cal[categoryFilter],
        })),
        byStore: filtered.upcoming.byStore.map(store => ({
          ...store,
          total: store[categoryFilter],
          employees: store.employees.map(emp => ({
            ...emp,
            total: emp[categoryFilter],
          })),
        })),
      }
    }

    return filtered
  }

  const filteredStats = getFilteredData()

  // Estado para datos de gráficos de barras por mes
  const [barsData, setBarsData] = useState<{
    medición: Array<{ name: string; value: number }>
    fitting: Array<{ name: string; value: number }>
  }>({ medición: [], fitting: [] })
  
  // Fetch datos de barras cuando cambia el mes seleccionado
  useEffect(() => {
    const fetchBarsData = async () => {
      try {
        const monthStart = new Date(barsSelectedMonth.year, barsSelectedMonth.month - 1, 1)
        const monthEnd = new Date(barsSelectedMonth.year, barsSelectedMonth.month, 0)
        const monthStartStr = format(monthStart, 'yyyy-MM-dd')
        const monthEndStr = format(monthEnd, 'yyyy-MM-dd')
        
        const [medicionRes, fittingRes] = await Promise.all([
          fetch(`/api/acuity/stats?type=upcoming&startDate=${monthStartStr}&endDate=${monthEndStr}&category=medición`),
          fetch(`/api/acuity/stats?type=upcoming&startDate=${monthStartStr}&endDate=${monthEndStr}&category=fitting`),
        ])
        
        if (medicionRes.ok && fittingRes.ok) {
          const medicionData = await medicionRes.json()
          const fittingData = await fittingRes.json()
          
          setBarsData({
            medición: medicionData.byStore?.map((store: any) => ({
              name: getStoreAcronym(store.storeName),
              value: store.medición || store.total || 0,
            })) || [],
            fitting: fittingData.byStore?.map((store: any) => ({
              name: getStoreAcronym(store.storeName),
              value: store.fitting || store.total || 0,
            })) || [],
          })
        }
      } catch (error) {
        console.error('Error fetching bars data:', error)
        setBarsData({ medición: [], fitting: [] })
      }
    }
    
    fetchBarsData()
  }, [barsSelectedMonth])

  // Preparar datos para gráficos (datos generales para cuando no hay filtro de mes o cuando categoryFilter != 'all')
  const upcomingByStoreData = filteredStats.upcoming?.byStore.map(store => ({
    name: store.storeName,
    'Medición': store.medición,
    'Fitting': store.fitting,
    total: store.total,
  })) || []

  // Usar datos diarios si están disponibles, sino usar datos mensuales
  const monthlyDataAll = filteredStats.monthly?.byMonth.map(month => ({
    name: `${month.year}-${String(month.month).padStart(2, '0')}`,
    year: month.year,
    month: month.month,
    'Medición': month.medición,
    'Fitting': month.fitting,
    Total: month.total,
  })) || []

  // Si tenemos datos diarios para el mes seleccionado, usarlos
  // Verificar que dailyStats tenga el año y mes correcto
  const isDailyDataForSelectedMonth = dailyStats.year === selectedMonth.year && 
                                      dailyStats.month === selectedMonth.month
  const dailyDataForMonth = (isDailyDataForSelectedMonth && dailyStats.byDay) ? dailyStats.byDay : []
  
  const monthlyData = dailyDataForMonth.length > 0 
    ? dailyDataForMonth 
    : monthlyDataAll.filter(
        m => m.year === selectedMonth.year && m.month === selectedMonth.month
      )

  // Obtener meses disponibles para navegación
  const availableMonths = monthlyDataAll
    .map(m => ({ year: m.year, month: m.month }))
    .filter((m, index, self) => 
      index === self.findIndex(t => t.year === m.year && t.month === m.month)
    )
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })

  // Funciones para navegar entre meses
  const navigateMonth = (direction: 'prev' | 'next') => {
    const currentIndex = availableMonths.findIndex(
      m => m.year === selectedMonth.year && m.month === selectedMonth.month
    )
    if (currentIndex === -1) return

    if (direction === 'prev' && currentIndex > 0) {
      setSelectedMonth(availableMonths[currentIndex - 1])
    } else if (direction === 'next' && currentIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[currentIndex + 1])
    }
  }

  const getMonthName = (year: number, month: number) => {
    const date = new Date(year, month - 1, 1)
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  }

  const occupationByCalendarData = filteredStats.occupation?.byCalendar.map(cal => ({
    name: cal.calendarName,
    value: cal.overall.percentage,
  })) || []

  return (
    <div className="flex flex-col">
      <Header
        title="Citas"
        subtitle="Gestión y análisis de citas Acuity"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Sistema de pestañas */}
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="clubs">Clubs</TabsTrigger>
            <TabsTrigger value="comparativas">Comparativas</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-6">
            {/* Filtros por categoría y período */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar por tipo de cita y período</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="medición">Medición</TabsTrigger>
                <TabsTrigger value="fitting">Fitting</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="periodStartDate">Fecha de inicio</Label>
                <Input
                  id="periodStartDate"
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => {
                    setPeriodStartDate(e.target.value)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEndDate">Fecha de fin (opcional)</Label>
                <Input
                  id="periodEndDate"
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => {
                    setPeriodEndDate(e.target.value)
                  }}
                  placeholder="Dejar vacío para sin límite"
                />
              </div>
            </div>
            <Button 
              onClick={() => fetchStats()} 
              variant="outline" 
              size="sm"
              className="w-full md:w-auto"
            >
              Aplicar filtros
            </Button>
          </CardContent>
        </Card>

        {/* KPIs principales */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Citas Reservadas"
            value={loading ? '—' : formatNumber(filteredStats.upcoming?.total || 0)}
            subtitle={
              categoryFilter === 'all'
                ? `Medición: ${formatNumber(filteredStats.upcoming?.byCategory.medición || 0)} • Fitting: ${formatNumber(filteredStats.upcoming?.byCategory.fitting || 0)}`
                : undefined
            }
            icon={Calendar}
            iconColor="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
          />
          <MetricCard
            title="Citas Disponibles"
            value={loading ? '—' : formatNumber(
              (filteredStats.availability?.byCategory.medición?.available || 0) +
              (filteredStats.availability?.byCategory.fitting?.available || 0)
            )}
            subtitle={
              categoryFilter === 'all'
                ? `Medición: ${formatNumber(filteredStats.availability?.byCategory.medición?.available || 0)} • Fitting: ${formatNumber(filteredStats.availability?.byCategory.fitting?.available || 0)}`
                : undefined
            }
            icon={Clock}
            iconColor="bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
          />
          <MetricCard
            title="% Ocupación"
            value={loading ? '—' : `${filteredStats.occupation?.byCategory.overall?.percentage || 0}%`}
            subtitle={
              categoryFilter === 'all'
                ? `Medición: ${filteredStats.occupation?.byCategory.medición?.percentage || 0}% • Fitting: ${filteredStats.occupation?.byCategory.fitting?.percentage || 0}%`
                : undefined
            }
            icon={TrendingUp}
            iconColor="bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
          />
          <MetricCard
            title={periodEndDate ? "Canceladas" : "Canceladas (este mes)"}
            value={loading ? '—' : formatNumber(filteredStats.cancellations?.byCategory.total?.canceled || 0)}
            subtitle={
              categoryFilter === 'all'
                ? `Medición: ${formatNumber(filteredStats.cancellations?.byCategory.medición?.canceled || 0)} • Fitting: ${formatNumber(filteredStats.cancellations?.byCategory.fitting?.canceled || 0)}`
                : undefined
            }
            icon={XCircle}
            iconColor="bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
          />
        </div>

        {/* Gráficos de barras lado a lado */}
        {categoryFilter === 'all' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Citas Reservadas por Tienda - Medición</CardTitle>
                    <CardDescription>{getMonthName(barsSelectedMonth.year, barsSelectedMonth.month)}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const prevMonth = new Date(barsSelectedMonth.year, barsSelectedMonth.month - 2, 1)
                        setBarsSelectedMonth({ year: prevMonth.getFullYear(), month: prevMonth.getMonth() + 1 })
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[120px] text-center text-sm font-medium">
                      {getMonthName(barsSelectedMonth.year, barsSelectedMonth.month)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const nextMonth = new Date(barsSelectedMonth.year, barsSelectedMonth.month, 1)
                        setBarsSelectedMonth({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 })
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {barsData.medición.length > 0 ? (
                  <BarChart
                    title=""
                    data={barsData.medición}
                    formatValue={(v) => formatNumber(v)}
                    height={300}
                    color="#8B0000"
                    showLegend={false}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    No hay datos para este mes
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Citas Reservadas por Tienda - Fitting</CardTitle>
                    <CardDescription>{getMonthName(barsSelectedMonth.year, barsSelectedMonth.month)}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const prevMonth = new Date(barsSelectedMonth.year, barsSelectedMonth.month - 2, 1)
                        setBarsSelectedMonth({ year: prevMonth.getFullYear(), month: prevMonth.getMonth() + 1 })
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[120px] text-center text-sm font-medium">
                      {getMonthName(barsSelectedMonth.year, barsSelectedMonth.month)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const nextMonth = new Date(barsSelectedMonth.year, barsSelectedMonth.month, 1)
                        setBarsSelectedMonth({ year: nextMonth.getFullYear(), month: nextMonth.getMonth() + 1 })
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {barsData.fitting.length > 0 ? (
                  <BarChart
                    title=""
                    data={barsData.fitting}
                    formatValue={(v) => formatNumber(v)}
                    height={300}
                    color="#8B0000"
                    showLegend={false}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    No hay datos para este mes
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : upcomingByStoreData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Citas Reservadas por Tienda</CardTitle>
              <CardDescription>Todas las citas futuras</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                title=""
                data={upcomingByStoreData.map(d => ({ name: getStoreAcronym(d.name), value: d[categoryFilter === 'medición' ? 'Medición' : 'Fitting'] }))}
                formatValue={(v) => formatNumber(v)}
                height={300}
                color="#8B0000"
                showLegend={false}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Citas Reservadas por Tienda</CardTitle>
              <CardDescription>Sin datos aún. Sincroniza para ver las citas.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Histórico Mensual - Ocupa todo el ancho */}
        {monthlyDataAll.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico Mensual</CardTitle>
                  <CardDescription>Evolución de citas por mes</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => navigateMonth('prev')}
                    disabled={
                      availableMonths.findIndex(
                        m => m.year === selectedMonth.year && m.month === selectedMonth.month
                      ) === 0
                    }
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
                    disabled={
                      availableMonths.findIndex(
                        m => m.year === selectedMonth.year && m.month === selectedMonth.month
                      ) === availableMonths.length - 1
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  {loading ? 'Cargando datos...' : `No hay datos para ${getMonthName(selectedMonth.year, selectedMonth.month)}`}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Histórico Mensual</CardTitle>
              <CardDescription>Sin datos históricos aún.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Ocupación por tienda */}
        {occupationByCalendarData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ocupación por Tienda</CardTitle>
              <CardDescription>Porcentaje de ocupación próximos 21 días</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                title=""
                data={occupationByCalendarData}
                formatValue={(v) => `${v}%`}
                height={300}
              />
            </CardContent>
          </Card>
        )}

        {/* Tabla comparativa por tienda */}
        {filteredStats.upcoming?.byStore && filteredStats.upcoming.byStore.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Desglose por Tienda</CardTitle>
              <CardDescription>Métricas detalladas por ubicación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Tienda</th>
                      <th className="text-right p-2 font-medium">Medición</th>
                      <th className="text-right p-2 font-medium">Fitting</th>
                      <th className="text-right p-2 font-medium">Total</th>
                      <th className="text-right p-2 font-medium">% Ocupación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStats.upcoming.byStore.map((store) => {
                      const isExpanded = expandedStores.has(store.storeName)
                      const storeOccupation = filteredStats.occupation?.byStore.find(
                        s => s.storeName === store.storeName
                      )
                      
                      return (
                        <React.Fragment key={store.storeName}>
                          {/* Fila de tienda */}
                          <tr className="border-b bg-muted/30">
                            <td className="p-2 font-medium">
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedStores)
                                  if (isExpanded) {
                                    newExpanded.delete(store.storeName)
                                  } else {
                                    newExpanded.add(store.storeName)
                                  }
                                  setExpandedStores(newExpanded)
                                }}
                                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span className="font-semibold">{store.storeName}</span>
                              </button>
                            </td>
                            <td className="p-2 text-right">
                              <Badge variant="outline" className="mr-2">
                                <Ruler className="h-3 w-3 mr-1" />
                                {formatNumber(store.medición)}
                              </Badge>
                            </td>
                            <td className="p-2 text-right">
                              <Badge variant="outline" className="mr-2">
                                <Scissors className="h-3 w-3 mr-1" />
                                {formatNumber(store.fitting)}
                              </Badge>
                            </td>
                            <td className="p-2 text-right font-semibold">
                              {formatNumber(store.total)}
                            </td>
                            <td className="p-2 text-right">
                              <Badge
                                variant={storeOccupation?.overall.percentage && storeOccupation.overall.percentage > 80 ? 'destructive' : 'secondary'}
                              >
                                {storeOccupation?.overall.percentage || 0}%
                              </Badge>
                            </td>
                          </tr>
                          {/* Filas de empleados (con sangría) */}
                          {isExpanded && store.employees.map((employee) => {
                            const employeeOccupation = storeOccupation?.employees.find(
                              e => e.employeeName === employee.employeeName
                            )
                            return (
                              <tr key={employee.employeeName} className="border-b">
                                <td className="p-2 pl-8 text-muted-foreground">
                                  {employee.employeeName}
                                </td>
                                <td className="p-2 text-right">
                                  <Badge variant="outline" className="mr-2">
                                    <Ruler className="h-3 w-3 mr-1" />
                                    {formatNumber(employee.medición)}
                                  </Badge>
                                </td>
                                <td className="p-2 text-right">
                                  <Badge variant="outline" className="mr-2">
                                    <Scissors className="h-3 w-3 mr-1" />
                                    {formatNumber(employee.fitting)}
                                  </Badge>
                                </td>
                                <td className="p-2 text-right">
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
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}
          </TabsContent>

          <TabsContent value="clubs" className="space-y-6 mt-6">
            {/* Lista de clubs */}
            <Card>
              <CardHeader>
                <CardTitle>Clubs</CardTitle>
                <CardDescription>Selecciona un club para ver sus estadísticas detalladas</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : stats.upcoming?.byStore && stats.upcoming.byStore.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {stats.upcoming.byStore.map((store) => {
                      const storeSlug = storeNameToSlug(store.storeName)
                      const storeOccupation = stats.occupation?.byStore.find(
                        s => s.storeName === store.storeName
                      )
                      
                      // Función para obtener la ruta de la imagen
                      const getImagePath = (storeSlug: string): string => {
                        const imageMap: Record<string, string> = {
                          'zaragoza': 'ZARAGOZA.jpg',
                          'malaga': 'MALAGA.jpg',
                          'madrid': 'madrid.jpg',
                          'barcelona': 'barcelona.jpg',
                          'bilbao': 'bilbao.jpg',
                          'murcia': 'murcia.jpg',
                          'sevilla': 'sevilla.jpg',
                          'cdmx': 'mexico.jpg',
                        }
                        const mappedName = imageMap[storeSlug.toLowerCase()]
                        if (mappedName) {
                          return `/clubs/${mappedName}`
                        }
                        return `/clubs/${storeSlug.toLowerCase()}.jpg`
                      }

                      const imagePath = getImagePath(storeSlug)
                      const occupationPercentage = storeOccupation?.overall.percentage || 0

                      return (
                        <Card 
                          key={store.storeName} 
                          className="group cursor-pointer overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50"
                        >
                          {/* Imagen horizontal */}
                          <div className="relative w-full h-48 overflow-hidden">
                            <Image
                              src={imagePath}
                              alt={store.storeName}
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-110"
                              onError={(e) => {
                                // Fallback a placeholder si la imagen no existe
                                const target = e.target as HTMLImageElement
                                target.src = `data:image/svg+xml,${encodeURIComponent(`
                                  <svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400">
                                    <defs>
                                      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
                                        <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
                                      </linearGradient>
                                    </defs>
                                    <rect fill="url(#grad)" width="800" height="400"/>
                                    <text fill="white" font-family="sans-serif" font-size="32" font-weight="bold" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">${store.storeName}</text>
                                  </svg>
                                `)}`
                              }}
                              unoptimized
                            />
                            {/* Overlay con gradiente */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            {/* Nombre del club sobre la imagen */}
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <h3 className="text-xl font-bold text-white drop-shadow-lg">
                                {store.storeName.replace('The Bundclub ', '')}
                              </h3>
                            </div>
                          </div>

                          <CardContent className="p-6">
                            <div className="space-y-5">
                              {/* Métricas con iconos */}
                              <div className="grid grid-cols-2 gap-4">
                                <div className="relative p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200/50 dark:border-blue-800/30">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <div className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                                      Total Citas
                                    </div>
                                  </div>
                                  <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                                    {formatNumber(store.total)}
                                  </div>
                                </div>
                                <div className="relative p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-800/30">
                                  <div className="flex items-center gap-2 mb-2">
                                    <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    <div className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                                      Ocupación
                                    </div>
                                  </div>
                                  <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                                    {occupationPercentage}%
                                  </div>
                                </div>
                              </div>

                              {/* Barra de ocupación visual */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Ocupación</span>
                                  <span className="font-medium">{occupationPercentage}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-400 dark:to-purple-500 transition-all duration-500 rounded-full"
                                    style={{ width: `${Math.min(occupationPercentage, 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Botón de acción */}
                              <Link href={`/citas/clubs/${storeSlug}`} className="block w-full">
                                <Button 
                                  className="w-full bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-[1.02]" 
                                  variant="default"
                                >
                                  Ver Detalle
                                  <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No hay datos de clubs disponibles. Sincroniza desde la página de integraciones.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparativas" className="space-y-6 mt-6">
            {/* Vista comparativa - placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Comparativas</CardTitle>
                <CardDescription>Comparación entre clubs y periodos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Vista comparativa en desarrollo...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
