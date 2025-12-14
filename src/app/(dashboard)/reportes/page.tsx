'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  Download,
  Calendar,
  Clock,
  Plus,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { formatDate, formatRelativeTime } from '@/lib/utils/format'

// Mock saved reports
const savedReports = [
  {
    id: '1',
    name: 'Informe Semanal de Ventas',
    description: 'Resumen de ventas, pedidos y productos top',
    type: 'scheduled',
    frequency: 'weekly',
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    metrics: ['revenue', 'orders', 'aov'],
  },
  {
    id: '2',
    name: 'Rendimiento Meta Ads',
    description: 'ROAS, CPA y conversiones por campaña',
    type: 'scheduled',
    frequency: 'daily',
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    metrics: ['spend', 'roas', 'conversions'],
  },
  {
    id: '3',
    name: 'Análisis de Citas vs Ventas',
    description: 'Correlación entre citas completadas y ventas',
    type: 'manual',
    lastRun: new Date(Date.now() - 604800000).toISOString(),
    metrics: ['appointments', 'conversion_rate', 'revenue'],
  },
]

// Mock insights
const insights = [
  {
    id: '1',
    type: 'success',
    title: 'ROAS en máximos',
    description: 'El ROAS alcanzó 3.45x, el mejor resultado en 3 meses.',
    date: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'warning',
    title: 'Tasa de cancelación alta',
    description: 'Las cancelaciones de citas subieron 15% esta semana.',
    date: new Date().toISOString(),
  },
  {
    id: '3',
    type: 'info',
    title: 'Correlación detectada',
    description: 'Las campañas de Meta tienen mayor conversión los martes.',
    date: new Date().toISOString(),
  },
  {
    id: '4',
    type: 'success',
    title: 'Objetivo cumplido',
    description: 'Se alcanzó el objetivo de ventas mensuales antes de tiempo.',
    date: new Date().toISOString(),
  },
]

export default function ReportesPage() {
  const [isCreatingReport, setIsCreatingReport] = useState(false)

  return (
    <div className="flex flex-col">
      <Header
        title="Reportes"
        subtitle="Genera y programa informes personalizados"
      />

      <div className="flex-1 space-y-6 p-6">
        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList>
            <TabsTrigger value="reports">Informes</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
            <TabsTrigger value="correlations">Correlaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="space-y-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-4">
              <Dialog open={isCreatingReport} onOpenChange={setIsCreatingReport}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Informe
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Informe</DialogTitle>
                    <DialogDescription>
                      Configura las métricas y frecuencia del informe
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Nombre del informe</Label>
                      <Input placeholder="Ej: Informe mensual de marketing" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select defaultValue="manual">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="scheduled">Programado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Métricas a incluir</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar métricas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="revenue">Ingresos</SelectItem>
                          <SelectItem value="orders">Pedidos</SelectItem>
                          <SelectItem value="roas">ROAS</SelectItem>
                          <SelectItem value="appointments">Citas</SelectItem>
                          <SelectItem value="sessions">Sesiones</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Período</Label>
                      <Select defaultValue="30d">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7d">Últimos 7 días</SelectItem>
                          <SelectItem value="30d">Últimos 30 días</SelectItem>
                          <SelectItem value="90d">Últimos 90 días</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreatingReport(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => setIsCreatingReport(false)}>
                      Crear Informe
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar Todo
              </Button>
            </div>

            {/* Saved Reports */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {savedReports.map((report) => (
                <Card key={report.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">
                            {report.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {report.description}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {report.type === 'scheduled' && (
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          {report.frequency === 'daily' ? 'Diario' : 'Semanal'}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="mr-1 h-3 w-3" />
                        {formatRelativeTime(report.lastRun)}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Generar
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Insights Automáticos
                </CardTitle>
                <CardDescription>
                  Análisis y descubrimientos generados automáticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="flex items-start gap-4 rounded-lg border p-4"
                  >
                    <div
                      className={`rounded-lg p-2 ${
                        insight.type === 'success'
                          ? 'bg-emerald-100 text-emerald-600'
                          : insight.type === 'warning'
                          ? 'bg-amber-100 text-amber-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {insight.type === 'success' && <CheckCircle className="h-4 w-4" />}
                      {insight.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
                      {insight.type === 'info' && <TrendingUp className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{insight.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {insight.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(insight.date)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="correlations" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    Gasto Meta vs Ventas Shopify
                  </CardTitle>
                  <CardDescription>
                    Correlación entre inversión publicitaria e ingresos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-emerald-100 p-3 text-emerald-600">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">0.78</p>
                      <p className="text-sm text-muted-foreground">
                        Correlación positiva fuerte
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Por cada €1 invertido en Meta Ads, se generan aproximadamente €3.24 en ventas.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    Citas Completadas vs Conversiones
                  </CardTitle>
                  <CardDescription>
                    Relación entre citas y ventas cerradas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-blue-600">0.65</p>
                      <p className="text-sm text-muted-foreground">
                        Correlación positiva moderada
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    El 68.5% de las citas completadas resultan en una venta en los siguientes 7 días.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    Tráfico Orgánico vs Sesiones Totales
                  </CardTitle>
                  <CardDescription>
                    Impacto del SEO en el tráfico general
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-purple-100 p-3 text-purple-600">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">0.42</p>
                      <p className="text-sm text-muted-foreground">
                        Correlación positiva moderada
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    El tráfico orgánico representa el 38% de las sesiones totales del sitio.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-medium">
                    Día de la Semana vs Conversiones
                  </CardTitle>
                  <CardDescription>
                    Patrones de conversión por día
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Martes</span>
                      <span className="font-medium text-emerald-600">+23% conversiones</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Jueves</span>
                      <span className="font-medium text-emerald-600">+18% conversiones</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Domingo</span>
                      <span className="font-medium text-red-600">-15% conversiones</span>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Los mejores días para campañas son martes y jueves entre 10-14h.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

