'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  UserCheck,
} from 'lucide-react'
import { formatNumber, formatPercentage, formatDateTime, formatDate } from '@/lib/utils/format'
import { subDays, format } from 'date-fns'

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

export default function CitasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [loadingUpcoming, setLoadingUpcoming] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingCharts, setLoadingCharts] = useState(false)
  const [monthlyMetrics, setMonthlyMetrics] = useState<{
    total_events: number
    active_events: number
    canceled_events: number
    by_store?: Record<string, { count: number; active: number; canceled: number }>
    by_event_type_category?: Record<string, { count: number; active: number; canceled: number }>
    by_room?: Record<string, { count: number; active: number; canceled: number }>
  } | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<
    Array<{
      id: string
      name: string
      status: string
      start_time: string
      end_time: string
      event_type: string
      invitee_name?: string
      invitee_email?: string
      store?: string | null
      event_type_category?: 'Fitting' | 'Medición' | null
      room?: 'I' | 'II' | null
    }>
  >([])
  const [historyEvents, setHistoryEvents] = useState<
    Array<{
      id: string
      event_type_name: string
      start_time: string
      invitee_name: string
      invitee_email: string
      status: string
    }>
  >([])
  const [chartData, setChartData] = useState<{
    daily_data: Array<{ date: string; value: number; completadas: number; canceladas: number }>
    by_type: Array<{ name: string; value: number; color: string }>
  } | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    // Carga de métricas del mes seleccionado, próximas citas, historial y gráficos
    const loadData = async () => {
      try {
        setApiError(null)
        setLoadingMetrics(true)
        setLoadingUpcoming(true)
        setLoadingHistory(true)
        setLoadingCharts(true)

        const [metricsRes, upcomingRes, historyRes, chartsRes] = await Promise.all([
          fetch(
            `/api/calendly/metrics/monthly?year=${selectedYear}&month=${selectedMonth}`
          ),
          fetch('/api/calendly/upcoming?days=7'),
          fetch('/api/calendly/events?limit=100&days=90'),
          fetch('/api/calendly/charts?days=30'),
        ])

        // Manejar respuestas - si no están ok, pero no tienen error, puede ser que no esté conectado
        const metricsJson = await metricsRes.json().catch(() => ({ total_events: 0, active_events: 0, canceled_events: 0, by_store: {}, by_event_type_category: {}, by_room: {}, message: 'Calendly no está conectado' }))
        const upcomingJson = await upcomingRes.json().catch(() => ({ events: [], total: 0, message: 'Calendly no está conectado' }))
        
        // Si hay un mensaje indicando que no está conectado, no lanzar error, solo usar valores por defecto
        if (metricsJson.message && metricsJson.message.includes('no está conectado')) {
          console.warn('[Citas] Calendly no está conectado:', metricsJson.message)
        }
        if (upcomingJson.message && upcomingJson.message.includes('no está conectado')) {
          console.warn('[Citas] Calendly no está conectado:', upcomingJson.message)
        }

        // historyJson y chartsJson ya están manejados arriba
        const historyJson = await historyRes.json().catch(() => ({ events: [] }))
        const chartsJson = await chartsRes.json().catch(() => ({ daily_data: [], by_type: [] }))

        setMonthlyMetrics({
          total_events: metricsJson.total_events ?? 0,
          active_events: metricsJson.active_events ?? 0,
          canceled_events: metricsJson.canceled_events ?? 0,
          by_store: metricsJson.by_store ?? {},
          by_event_type_category: metricsJson.by_event_type_category ?? {},
          by_room: metricsJson.by_room ?? {},
        })
        setUpcomingEvents(upcomingJson.events ?? [])
        setHistoryEvents(historyJson.events ?? [])
        setChartData({
          daily_data: chartsJson.daily_data ?? [],
          by_type: chartsJson.by_type ?? [],
        })
      } catch (err) {
        console.error(err)
        setApiError(
          'No se pudo cargar la información en tiempo real de Calendly. Revisa que Calendly esté conectado desde la página de Integraciones.'
        )
      } finally {
        setLoadingMetrics(false)
        setLoadingUpcoming(false)
        setLoadingHistory(false)
        setLoadingCharts(false)
      }
    }

    loadData()
  }, [selectedYear, selectedMonth])

  // Cargar próximas citas con filtros
  useEffect(() => {
    const loadUpcoming = async () => {
      try {
        setLoadingUpcoming(true)
        setApiError(null)

        const params = new URLSearchParams()
        params.set('days', '7')
        if (storeFilter !== 'all') params.set('store', storeFilter)
        if (eventTypeFilter !== 'all') params.set('event_type', eventTypeFilter)
        if (roomFilter !== 'all') params.set('room', roomFilter)

        const res = await fetch(`/api/calendly/upcoming?${params.toString()}`)
        const body = await res.json().catch(() => ({ events: [], total: 0, message: 'Error al cargar próximas citas' }))
        
        // Si hay un mensaje indicando que no está conectado, no lanzar error, solo usar valores por defecto
        if (body.message && (body.message.includes('no está conectado') || body.message.includes('autenticación'))) {
          console.warn('[Citas] Calendly no está conectado:', body.message)
          setUpcomingEvents([])
          return
        }
        
        if (!res.ok && body.error) {
          throw new Error(body.error || 'Error al cargar próximas citas de Calendly')
        }
        const json = await res.json()
        setUpcomingEvents(json.events ?? [])
      } catch (err) {
        console.error(err)
        setApiError('No se pudieron recargar las próximas citas desde Calendly.')
      } finally {
        setLoadingUpcoming(false)
      }
    }

    loadUpcoming()
  }, [storeFilter, eventTypeFilter, roomFilter])

  const filteredEvents = historyEvents.filter((event) => {
    const matchesSearch =
      event.invitee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.invitee_email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Programada</Badge>
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completada</Badge>
      case 'canceled':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelada</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Citas"
        subtitle="Gestión y análisis de citas de Calendly"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Estado de integración en tiempo real */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Integración Calendly (tiempo real)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {apiError && (
              <p className="text-sm text-red-600">
                {apiError}
              </p>
            )}
            {!apiError && (
              <p className="text-sm text-muted-foreground">
                Mostrando datos en tiempo real desde la API de Calendly para
                probar la integración (sin guardar nada en la base de datos).
              </p>
            )}
          </CardContent>
        </Card>
        {/* Filtros de periodo para métricas mensuales */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Selecciona mes y año para ver las métricas de citas de Calendly.
          </p>
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(Number(value))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(Number(value))}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }).map((_, index) => {
                  const year = now.getFullYear() - index
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Citas (Mes - Calendly)"
            value={
              loadingMetrics
                ? 'Cargando...'
                : monthlyMetrics
                ? formatNumber(monthlyMetrics.total_events)
                : '—'
            }
            change={0}
            icon={Calendar}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Completadas/Activas (Calendly)"
            value={
              loadingMetrics
                ? 'Cargando...'
                : monthlyMetrics
                ? formatNumber(monthlyMetrics.active_events)
                : '—'
            }
            subtitle={
              monthlyMetrics && monthlyMetrics.total_events > 0
                ? formatPercentage(
                    monthlyMetrics.active_events / monthlyMetrics.total_events
                  )
                : undefined
            }
            icon={CheckCircle}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Canceladas (Calendly)"
            value={
              loadingMetrics
                ? 'Cargando...'
                : monthlyMetrics
                ? formatNumber(monthlyMetrics.canceled_events)
                : '—'
            }
            subtitle={
              monthlyMetrics && monthlyMetrics.total_events > 0
                ? formatPercentage(
                    monthlyMetrics.canceled_events / monthlyMetrics.total_events
                  )
                : undefined
            }
            icon={XCircle}
            iconColor="bg-red-100 text-red-600"
          />
          <MetricCard
            title="Tasa Conversión"
            value={
              monthlyMetrics && monthlyMetrics.total_events > 0
                ? formatPercentage(monthlyMetrics.active_events / monthlyMetrics.total_events)
                : '0.0%'
            }
            change={0}
            icon={UserCheck}
            iconColor="bg-purple-100 text-purple-600"
          />
        </div>

        {/* Métricas segmentadas por tienda */}
        {monthlyMetrics && monthlyMetrics.by_store && Object.keys(monthlyMetrics.by_store).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Citas por Tienda - {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(monthlyMetrics.by_store).map(([store, metrics]) => (
                  <div key={store} className="rounded-lg border p-4">
                    <h4 className="font-semibold text-sm mb-2">{store}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-medium">{formatNumber(metrics.count)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Activas:</span>
                        <span className="font-medium text-emerald-600">{formatNumber(metrics.active)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Canceladas:</span>
                        <span className="font-medium text-red-600">{formatNumber(metrics.canceled)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas por tipo de evento (Fitting/Medición) */}
        {monthlyMetrics && monthlyMetrics.by_event_type_category && Object.keys(monthlyMetrics.by_event_type_category).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Citas por Tipo de Evento - {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(monthlyMetrics.by_event_type_category).map(([type, metrics]) => (
                  <div key={type} className="rounded-lg border p-4">
                    <h4 className="font-semibold text-sm mb-2">{type}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-medium">{formatNumber(metrics.count)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Activas:</span>
                        <span className="font-medium text-emerald-600">{formatNumber(metrics.active)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Canceladas:</span>
                        <span className="font-medium text-red-600">{formatNumber(metrics.canceled)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AreaChart
            title="Citas por Día - Últimos 30 días"
            data={
              loadingCharts
                ? []
                : chartData?.daily_data || []
            }
            color="var(--chart-2)"
          />
          <BarChart
            title="Citas por Tipo"
            data={
              loadingCharts
                ? []
                : chartData?.by_type || []
            }
            horizontal
            height={280}
          />
        </div>

        {/* Próximas citas desde Calendly */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-medium">
                  Próximas citas (siguientes 7 días)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      setLoadingUpcoming(true)
                      setApiError(null)
                      const params = new URLSearchParams()
                      params.set('days', '7')
                      if (storeFilter !== 'all') params.set('store', storeFilter)
                      if (eventTypeFilter !== 'all') params.set('event_type', eventTypeFilter)
                      if (roomFilter !== 'all') params.set('room', roomFilter)
                      const res = await fetch(`/api/calendly/upcoming?${params.toString()}`)
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}))
                        throw new Error(
                          body.error || 'Error al recargar próximas citas de Calendly'
                        )
                      }
                      const json = await res.json()
                      setUpcomingEvents(json.events ?? [])
                    } catch (err) {
                      console.error(err)
                      setApiError(
                        'No se pudieron recargar las próximas citas desde Calendly.'
                      )
                    } finally {
                      setLoadingUpcoming(false)
                    }
                  }}
                  disabled={loadingUpcoming}
                >
                  {loadingUpcoming ? 'Actualizando...' : 'Actualizar'}
                </Button>
              </div>
              {/* Filtros */}
              <div className="flex flex-wrap gap-2">
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tienda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                    {monthlyMetrics?.by_store &&
                      Object.keys(monthlyMetrics.by_store).map((store) => (
                        <SelectItem key={store} value={store}>
                          {store}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="Fitting">Fitting</SelectItem>
                    <SelectItem value="Medición">Medición</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={roomFilter} onValueChange={setRoomFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Sala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las salas</SelectItem>
                    <SelectItem value="I">Sala I</SelectItem>
                    <SelectItem value="II">Sala II</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitado</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sala</TableHead>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingEvents.length === 0 && !loadingUpcoming && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground"
                    >
                      Sin próximas citas en los próximos 7 días o integración no
                      configurada.
                    </TableCell>
                  </TableRow>
                )}
                {upcomingEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {event.invitee_name || 'Sin nombre'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {event.invitee_email || 'Sin email'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{event.store || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{event.event_type_category || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell>
                      {event.room ? (
                        <Badge variant="outline">Sala {event.room}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {formatDate(event.start_time, 'dd MMM yyyy')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(event.start_time, 'HH:mm')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(event.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Historial de Citas desde la base de datos */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-medium">Historial de Citas</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    setLoadingHistory(true)
                    setApiError(null)
                    const res = await fetch('/api/calendly/events?limit=100&days=90')
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({}))
                      throw new Error(body.error || 'Error al recargar historial de Calendly')
                    }
                    const json = await res.json()
                    setHistoryEvents(json.events ?? [])
                  } catch (err) {
                    console.error(err)
                    setApiError('No se pudieron recargar el historial desde Calendly.')
                  } finally {
                    setLoadingHistory(false)
                  }
                }}
                disabled={loadingHistory}
              >
                {loadingHistory ? 'Actualizando...' : 'Actualizar'}
              </Button>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64 pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Programadas</SelectItem>
                    <SelectItem value="completed">Completadas</SelectItem>
                    <SelectItem value="canceled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invitado</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Cargando historial...
                    </TableCell>
                  </TableRow>
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No hay eventos en el historial. Sincroniza eventos de Calendly para ver el historial.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{event.invitee_name || 'Sin nombre'}</p>
                          <p className="text-sm text-muted-foreground">{event.invitee_email || 'Sin email'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{event.event_type_name || 'N/A'}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{formatDate(event.start_time, 'dd MMM yyyy')}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(event.start_time, 'HH:mm')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(event.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          Ver detalles
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

