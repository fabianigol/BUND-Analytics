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
import { mockDashboardMetrics, mockCalendlyEvents } from '@/lib/utils/mock-data'
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

// Generate mock appointment data for chart
const appointmentChartData = Array.from({ length: 30 }, (_, i) => {
  const date = subDays(new Date(), 29 - i)
  return {
    date: format(date, 'dd MMM'),
    value: Math.floor(Math.random() * 8) + 2,
    completadas: Math.floor(Math.random() * 6) + 1,
    canceladas: Math.floor(Math.random() * 2),
  }
})

const appointmentsByType = [
  { name: 'Consulta Inicial', value: 45, color: 'var(--chart-1)' },
  { name: 'Seguimiento', value: 38, color: 'var(--chart-2)' },
  { name: 'Demo Producto', value: 28, color: 'var(--chart-3)' },
  { name: 'Revisión', value: 22, color: 'var(--chart-4)' },
  { name: 'Otros', value: 15, color: 'var(--chart-5)' },
]

// Extended mock events
const extendedEvents = [
  ...mockCalendlyEvents,
  {
    id: '3',
    event_type: 'demo',
    event_type_name: 'Demo Producto',
    start_time: new Date(Date.now() - 86400000).toISOString(),
    end_time: new Date(Date.now() - 86400000 + 3600000).toISOString(),
    invitee_email: 'demo@empresa.com',
    invitee_name: 'Ana Martínez',
    status: 'completed' as const,
    metadata: {},
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '4',
    event_type: 'consultation',
    event_type_name: 'Consulta Inicial',
    start_time: new Date(Date.now() - 172800000).toISOString(),
    end_time: new Date(Date.now() - 172800000 + 1800000).toISOString(),
    invitee_email: 'cancelado@test.com',
    invitee_name: 'Pedro Sánchez',
    status: 'canceled' as const,
    canceled_at: new Date(Date.now() - 180000000).toISOString(),
    cancellation_reason: 'Conflicto de horario',
    metadata: {},
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: '5',
    event_type: 'follow-up',
    event_type_name: 'Seguimiento',
    start_time: new Date(Date.now() + 172800000).toISOString(),
    end_time: new Date(Date.now() + 172800000 + 1800000).toISOString(),
    invitee_email: 'futuro@cliente.com',
    invitee_name: 'Laura Gómez',
    status: 'active' as const,
    metadata: {},
    created_at: new Date().toISOString(),
  },
]

export default function CitasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [loadingUpcoming, setLoadingUpcoming] = useState(false)
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
  const [apiError, setApiError] = useState<string | null>(null)
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all')
  const [roomFilter, setRoomFilter] = useState<string>('all')

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  useEffect(() => {
    // Carga de métricas del mes seleccionado y próximas citas para la demo
    const loadData = async () => {
      try {
        setApiError(null)
        setLoadingMetrics(true)
        setLoadingUpcoming(true)

        const [metricsRes, upcomingRes] = await Promise.all([
          fetch(
            `/api/calendly/metrics/monthly?year=${selectedYear}&month=${selectedMonth}`
          ),
          fetch('/api/calendly/upcoming?days=7'),
        ])

        if (!metricsRes.ok) {
          const body = await metricsRes.json().catch(() => ({}))
          throw new Error(body.error || 'Error al cargar métricas de Calendly')
        }
        if (!upcomingRes.ok) {
          const body = await upcomingRes.json().catch(() => ({}))
          throw new Error(body.error || 'Error al cargar próximas citas de Calendly')
        }

        const metricsJson = await metricsRes.json()
        const upcomingJson = await upcomingRes.json()

        setMonthlyMetrics({
          total_events: metricsJson.total_events ?? 0,
          active_events: metricsJson.active_events ?? 0,
          canceled_events: metricsJson.canceled_events ?? 0,
          by_store: metricsJson.by_store ?? {},
          by_event_type_category: metricsJson.by_event_type_category ?? {},
          by_room: metricsJson.by_room ?? {},
        })
        setUpcomingEvents(upcomingJson.events ?? [])
      } catch (err) {
        console.error(err)
        setApiError(
          'No se pudo cargar la información en tiempo real de Calendly. Revisa que CALENDLY_API_KEY esté configurado.'
        )
      } finally {
        setLoadingMetrics(false)
        setLoadingUpcoming(false)
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
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
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

  const filteredEvents = extendedEvents.filter((event) => {
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
            value={formatPercentage(mockDashboardMetrics.appointmentConversionRate)}
            change={2.3}
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
            data={appointmentChartData}
            color="var(--chart-2)"
          />
          <BarChart
            title="Citas por Tipo"
            data={appointmentsByType}
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

        {/* Table mock de historial (se mantiene para diseño) */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-medium">Historial de Citas</CardTitle>
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
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{event.invitee_name}</p>
                        <p className="text-sm text-muted-foreground">{event.invitee_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{event.event_type_name}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

