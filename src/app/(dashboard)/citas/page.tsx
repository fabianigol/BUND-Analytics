'use client'

import { useState } from 'react'
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
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Citas (Mes)"
            value={formatNumber(mockDashboardMetrics.totalAppointments)}
            change={mockDashboardMetrics.appointmentsChange}
            icon={Calendar}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Completadas"
            value={formatNumber(mockDashboardMetrics.completedAppointments)}
            subtitle="84.6% del total"
            icon={CheckCircle}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Canceladas"
            value={formatNumber(mockDashboardMetrics.canceledAppointments)}
            subtitle="11.5% del total"
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

        {/* Table */}
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

