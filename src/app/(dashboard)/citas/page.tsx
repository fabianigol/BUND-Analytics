'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { formatNumber, formatCompactNumber } from '@/lib/utils/format'

type CategoryFilter = 'all' | 'medición' | 'fitting'

interface AppointmentStats {
  upcoming: {
    total: number
    byCategory: { medición: number; fitting: number }
    byCalendar: Array<{ calendarName: string; medición: number; fitting: number; total: number }>
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
  const [syncing, setSyncing] = useState(false)
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

  const handleSync = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/sync/acuity', { method: 'POST' })
      if (response.ok) {
        await fetchStats()
      }
    } catch (error) {
      console.error('Error syncing:', error)
    } finally {
      setSyncing(false)
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
            medición: medicionData.byCalendar?.map((cal: any) => ({
              name: cal.calendarName,
              value: cal.medición || cal.total || 0,
            })) || [],
            fitting: fittingData.byCalendar?.map((cal: any) => ({
              name: cal.calendarName,
              value: cal.fitting || cal.total || 0,
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
  const upcomingByCalendarData = filteredStats.upcoming?.byCalendar.map(cal => ({
    name: cal.calendarName,
    'Medición': cal.medición,
    'Fitting': cal.fitting,
    total: cal.total,
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
        {/* Botón de sincronización */}
        <div className="flex justify-end">
          <Button
            onClick={handleSync}
            disabled={syncing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
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
                  />
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    No hay datos para este mes
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : upcomingByCalendarData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Citas Reservadas por Tienda</CardTitle>
              <CardDescription>Todas las citas futuras</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                title=""
                data={upcomingByCalendarData.map(d => ({ name: d.name, value: d[categoryFilter === 'medición' ? 'Medición' : 'Fitting'] }))}
                formatValue={(v) => formatNumber(v)}
                height={300}
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
        {filteredStats.upcoming?.byCalendar && filteredStats.upcoming.byCalendar.length > 0 && (
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
                    {filteredStats.upcoming.byCalendar.map((cal) => {
                      const occupation = filteredStats.occupation?.byCalendar.find(
                        o => o.calendarName === cal.calendarName
                      )
                      return (
                        <tr key={cal.calendarName} className="border-b">
                          <td className="p-2 font-medium">{cal.calendarName}</td>
                          <td className="p-2 text-right">
                            <Badge variant="outline" className="mr-2">
                              <Ruler className="h-3 w-3 mr-1" />
                              {formatNumber(cal.medición)}
                            </Badge>
                          </td>
                          <td className="p-2 text-right">
                            <Badge variant="outline" className="mr-2">
                              <Scissors className="h-3 w-3 mr-1" />
                              {formatNumber(cal.fitting)}
                            </Badge>
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {formatNumber(cal.total)}
                          </td>
                          <td className="p-2 text-right">
                            <Badge
                              variant={occupation?.overall.percentage && occupation.overall.percentage > 80 ? 'destructive' : 'secondary'}
                            >
                              {occupation?.overall.percentage || 0}%
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

        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
