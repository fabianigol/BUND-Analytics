'use client'

import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart, PieChart, LineChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Users,
  Eye,
  Clock,
  MousePointer,
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  Loader2,
  Calendar,
  X,
} from 'lucide-react'
import { formatNumber, formatCompactNumber, formatPercentage, formatDuration } from '@/lib/utils/format'
import { subDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// Función para obtener el emoji según la hora del día
function getHourEmoji(hour: number): string {
  if (hour >= 6 && hour < 9) {
    return '🌅' // Amanecer
  } else if (hour >= 9 && hour < 18) {
    return '☀️' // Día
  } else if (hour >= 18 && hour < 21) {
    return '🌆' // Atardecer
  } else {
    return '🌙' // Noche
  }
}

// Función para obtener el emoji de la bandera de un país
function getCountryFlag(countryName: string): string {
  const countryToCode: Record<string, string> = {
    'Spain': 'ES',
    'United States': 'US',
    'United States of America': 'US',
    'Mexico': 'MX',
    'United Kingdom': 'GB',
    'France': 'FR',
    'Germany': 'DE',
    'Italy': 'IT',
    'Brazil': 'BR',
    'Argentina': 'AR',
    'Chile': 'CL',
    'Colombia': 'CO',
    'Peru': 'PE',
    'China': 'CN',
    'Japan': 'JP',
    'India': 'IN',
    'Australia': 'AU',
    'Canada': 'CA',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Portugal': 'PT',
    'Switzerland': 'CH',
    'Austria': 'AT',
    'Sweden': 'SE',
    'Norway': 'NO',
    'Denmark': 'DK',
    'Poland': 'PL',
    'Russia': 'RU',
    'Singapore': 'SG',
    'South Korea': 'KR',
    'Thailand': 'TH',
    'Indonesia': 'ID',
    'Philippines': 'PH',
    'Malaysia': 'MY',
    'Vietnam': 'VN',
    'Turkey': 'TR',
    'Saudi Arabia': 'SA',
    'United Arab Emirates': 'AE',
    'South Africa': 'ZA',
    'Egypt': 'EG',
    'Israel': 'IL',
    'New Zealand': 'NZ',
    'Ireland': 'IE',
    'Greece': 'GR',
    'Czech Republic': 'CZ',
    'Romania': 'RO',
    'Hungary': 'HU',
    'Finland': 'FI',
    'Ukraine': 'UA',
    'Ecuador': 'EC',
    'Venezuela': 'VE',
    'Uruguay': 'UY',
    'Paraguay': 'PY',
    'Bolivia': 'BO',
    'Costa Rica': 'CR',
    'Panama': 'PA',
    'Dominican Republic': 'DO',
    'Guatemala': 'GT',
    'Honduras': 'HN',
    'El Salvador': 'SV',
    'Nicaragua': 'NI',
  }

  const code = countryToCode[countryName] || countryName.substring(0, 2).toUpperCase()
  
  // Convertir código ISO a emoji de bandera
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0))
  
  return String.fromCodePoint(...codePoints)
}

interface AnalyticsData {
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  totalNewUsers: number
  avgBounceRate: number
  avgSessionDuration: number
  latest: {
    sessions: number
    users: number
    new_users: number
    page_views: number
    bounce_rate: number
    avg_session_duration: number
    traffic_sources: Array<{ source: string; medium: string; sessions: number; users: number; percentage: number }>
    top_pages: Array<{ page_path: string; page_title: string; page_views: number; avg_time_on_page: number }>
  } | null
  sessionsData: Array<{ date: string; value: number }>
  usersData: Array<{ date: string; usuarios: number; nuevos: number }>
  trafficSources: Array<{ source: string; medium: string; sessions: number; users: number }>
  topPages: Array<{ pagePath: string; pageTitle: string; pageViews: number; avgTimeOnPage: number }>
  deviceData: Array<{ name: string; value: number; color: string }>
  geographicData: Array<{ country: string; sessions: number; users: number }>
  cityData: Array<{ city: string; country: string; sessions: number; users: number }>
  hourlyData: Array<{ hour: number; sessions: number; users: number }>
}

type DateFilterType = 'last28' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('last28')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [isMobile, setIsMobile] = useState(false)
  const [tooltipData, setTooltipData] = useState<{
    day: string
    hour: number
    sessions: number
    users: number
    x: number
    y: number
  } | null>(null)

  // Detectar tamaño de pantalla
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Calcular fechas según el tipo de filtro
  const dateRange = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    switch (dateFilterType) {
      case 'last7': {
        const start = subDays(today, 6)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
      case 'last28': {
        const start = subDays(today, 27)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
      case 'last30': {
        const start = subDays(today, 29)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
      case 'thisMonth': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
      case 'lastMonth': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
        return { start: format(lastMonth, 'yyyy-MM-dd'), end: format(lastDayOfLastMonth, 'yyyy-MM-dd') }
      }
      case 'custom': {
        if (startDate && endDate) {
          return { start: startDate, end: endDate }
        }
        return null
      }
      default:
        return null
    }
  }, [dateFilterType, startDate, endDate])

  // Formatear el período visible
  const periodLabel = useMemo(() => {
    if (!dateRange) return 'Sin filtro'
    
    try {
      const start = parseISO(dateRange.start)
      const end = parseISO(dateRange.end)
      return `${format(start, 'd MMM', { locale: es })} - ${format(end, 'd MMM yyyy', { locale: es })}`
    } catch {
      return `${dateRange.start} - ${dateRange.end}`
    }
  }, [dateRange])

  useEffect(() => {
    loadAnalyticsData()
  }, [dateRange])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      let url = '/api/analytics'
      if (dateRange) {
        url += `?startDate=${dateRange.start}&endDate=${dateRange.end}`
      }
      
      const response = await fetch(url)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load analytics data')
      }

      console.log('[Analytics Page] Loaded data:', result.data)
      console.log('[Analytics Page] Device data:', result.data?.deviceData)
      setAnalyticsData(result.data)
    } catch (err) {
      console.error('Error loading analytics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleResetFilter = () => {
    setDateFilterType('last28')
    setStartDate('')
    setEndDate('')
  }

  const hasAnalytics = analyticsData && analyticsData.latest !== null
  if (loading) {
    return (
      <div className="flex flex-col">
        <Header
          title="Analytics"
          subtitle="Datos de Google Analytics 4"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col">
        <Header
          title="Analytics"
          subtitle="Datos de Google Analytics 4"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-600">Error al cargar datos: {error}</p>
              <button
                onClick={loadAnalyticsData}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Reintentar
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Analytics"
        subtitle="Datos de Google Analytics 4"
      />
      
      {/* Filtro de fechas */}
      <Card className="mx-3 sm:mx-6 mt-3 sm:mt-6">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Período:</span>
              <span className="text-sm text-muted-foreground">{periodLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateFilterType} onValueChange={(value) => setDateFilterType(value as DateFilterType)}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7">Últimos 7 días</SelectItem>
                  <SelectItem value="last28">Últimos 28 días</SelectItem>
                  <SelectItem value="last30">Últimos 30 días</SelectItem>
                  <SelectItem value="thisMonth">Este mes</SelectItem>
                  <SelectItem value="lastMonth">Mes pasado</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              
              {dateFilterType === 'custom' && (
                <>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full sm:w-[140px]"
                    placeholder="Desde"
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-[140px]"
                    placeholder="Hasta"
                  />
                </>
              )}
              
              {(dateFilterType !== 'last28' || startDate || endDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilter}
                  className="gap-2 w-full sm:w-auto"
                >
                  <X className="h-4 w-4" />
                  Resetear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 space-y-4 sm:space-y-6 p-3 sm:p-6">
        {/* KPIs - Responsive grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600">
                <Eye className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Sesiones</p>
                <p className="text-sm font-semibold truncate">
                  {analyticsData?.totalSessions ? formatCompactNumber(analyticsData.totalSessions) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600">
                <Users className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Usuarios</p>
                <p className="text-sm font-semibold truncate">
                  {analyticsData?.totalUsers ? formatCompactNumber(analyticsData.totalUsers) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600">
                <Globe className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Páginas Vistas</p>
                <p className="text-sm font-semibold truncate">
                  {analyticsData?.totalPageViews ? formatCompactNumber(analyticsData.totalPageViews) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600">
                <MousePointer className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Tasa Rebote</p>
                <p className="text-sm font-semibold truncate">
                  {analyticsData?.avgBounceRate ? formatPercentage(analyticsData.avgBounceRate) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-600">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Duración Media</p>
                <p className="text-sm font-semibold truncate">
                  {analyticsData?.avgSessionDuration
                    ? formatDuration(analyticsData.avgSessionDuration)
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-pink-100 p-1.5 text-pink-600">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Nuevos Usuarios</p>
                <p className="text-sm font-semibold truncate">
                  {analyticsData?.totalNewUsers ? formatNumber(analyticsData.totalNewUsers) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-cyan-100 p-1.5 text-cyan-600">
                <Eye className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Páginas/Sesión</p>
                <p className="text-sm font-semibold truncate">
                  {analyticsData?.totalPageViews && analyticsData?.totalSessions
                    ? (analyticsData.totalPageViews / analyticsData.totalSessions).toFixed(2)
                    : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row - Embudo y Heatmap */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Embudo de Conversión */}
          <Card>
            <CardHeader>
              <CardTitle>Embudo de Conversión</CardTitle>
              <CardDescription>Flujo de usuarios desde visitas hasta nuevos usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData ? (
                <div className="space-y-4">
                  {(() => {
                    const pageViews = analyticsData.totalPageViews || 0
                    const sessions = analyticsData.totalSessions || 0
                    const users = analyticsData.totalUsers || 0
                    const newUsers = analyticsData.totalNewUsers || 0
                    
                    const steps = [
                      { label: 'Páginas Vistas', value: pageViews, color: '#3b82f6' },
                      { label: 'Sesiones', value: sessions, color: '#10b981' },
                      { label: 'Usuarios', value: users, color: '#8b5cf6' },
                      { label: 'Nuevos Usuarios', value: newUsers, color: '#f59e0b' },
                    ]
                    
                    const maxValue = Math.max(...steps.map(s => s.value), 1)
                    
                    return steps.map((step, index) => {
                      const width = (step.value / maxValue) * 100
                      const conversionRate = index > 0 
                        ? ((step.value / steps[index - 1].value) * 100).toFixed(1)
                        : '100'
                      
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{step.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{formatCompactNumber(step.value)}</span>
                              {index > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  ({conversionRate}%)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="relative h-8 rounded-md overflow-hidden bg-muted">
                            <div
                              className="h-full flex items-center justify-end pr-2 transition-all"
                              style={{
                                width: `${width}%`,
                                backgroundColor: step.color,
                              }}
                            >
                              {width > 15 && (
                                <span className="text-xs font-medium text-white">
                                  {formatCompactNumber(step.value)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Sin datos. Conecta GA4 y sincroniza.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Heatmap de Actividad */}
          <Card>
            <CardHeader>
              <CardTitle>Heatmap de Actividad</CardTitle>
              <CardDescription>Distribución de tráfico por día y hora</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.hourlyData && analyticsData.hourlyData.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    // Agrupar datos por día de la semana (asumiendo que tenemos datos de múltiples días)
                    // Por ahora, vamos a mostrar un heatmap basado en las horas del día
                    // y simular días de la semana basado en los datos horarios
                    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
                    const hours = Array.from({ length: 24 }, (_, i) => i)
                    
                    // Crear un mapa de datos por hora con sesiones y usuarios
                    const hourlyMap = new Map<number, { sessions: number; users: number }>()
                    analyticsData.hourlyData.forEach(item => {
                      hourlyMap.set(item.hour, {
                        sessions: item.sessions || 0,
                        users: item.users || 0,
                      })
                    })
                    
                    const maxSessions = Math.max(...Array.from(hourlyMap.values()).map(d => d.sessions), 1)
                    
                    // Para el heatmap, vamos a usar los datos horarios y distribuirlos por días
                    // Como no tenemos datos por día de la semana, vamos a crear un heatmap
                    // que muestre la distribución promedio por hora
                    return (
                      <div className="space-y-2 overflow-x-auto relative">
                        {/* Tooltip personalizado */}
                        {tooltipData && (
                          <div
                            className="fixed z-50 rounded-lg border bg-background p-3 shadow-lg pointer-events-none"
                            style={{
                              left: `${tooltipData.x}px`,
                              top: `${tooltipData.y}px`,
                              transform: 'translate(-50%, calc(-100% - 8px))',
                            }}
                          >
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              {tooltipData.day} {tooltipData.hour.toString().padStart(2, '0')}:00
                            </p>
                            <div className="space-y-1">
                              <p className="text-sm font-semibold">
                                {formatCompactNumber(tooltipData.sessions)} sesiones
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCompactNumber(tooltipData.users)} usuarios
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {/* Header con horas */}
                        <div className="flex gap-1 min-w-[600px]">
                          <div className="w-12 flex-shrink-0 text-xs text-muted-foreground text-center">Hora</div>
                          {hours.map(hour => (
                            <div key={hour} className="flex-1 text-xs text-muted-foreground text-center min-w-[20px]">
                              {hour}
                            </div>
                          ))}
                        </div>
                        
                        {/* Filas por día */}
                        {days.map((day, dayIndex) => {
                          // Usar los mismos datos horarios para cada día (promedio)
                          // En una implementación real, esto vendría de datos agrupados por día de semana
                          return (
                            <div key={dayIndex} className="flex gap-1 items-center min-w-[600px]">
                              <div className="w-12 flex-shrink-0 text-xs font-medium">{day}</div>
                              {hours.map(hour => {
                                const data = hourlyMap.get(hour) || { sessions: 0, users: 0 }
                                const sessions = data.sessions
                                const users = data.users
                                const intensity = (sessions / maxSessions) * 100
                                
                                // Calcular color basado en intensidad
                                const getColor = (intensity: number) => {
                                  if (intensity === 0) return 'bg-muted'
                                  if (intensity < 20) return 'bg-blue-100'
                                  if (intensity < 40) return 'bg-blue-300'
                                  if (intensity < 60) return 'bg-blue-500'
                                  if (intensity < 80) return 'bg-blue-700'
                                  return 'bg-blue-900'
                                }
                                
                                return (
                                  <div
                                    key={hour}
                                    className={`flex-1 h-6 rounded-sm ${getColor(intensity)} border border-background min-w-[20px] cursor-pointer hover:opacity-80 transition-opacity`}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setTooltipData({
                                        day,
                                        hour,
                                        sessions,
                                        users,
                                        x: rect.left + rect.width / 2,
                                        y: rect.top,
                                      })
                                    }}
                                    onMouseLeave={() => setTooltipData(null)}
                                    onMouseMove={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setTooltipData({
                                        day,
                                        hour,
                                        sessions,
                                        users,
                                        x: rect.left + rect.width / 2,
                                        y: rect.top,
                                      })
                                    }}
                                  />
                                )
                              })}
                            </div>
                          )
                        })}
                        
                        {/* Leyenda */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t">
                          <span>Menos tráfico</span>
                          <div className="flex gap-1">
                            <div className="w-3 h-3 rounded-sm bg-muted" />
                            <div className="w-3 h-3 rounded-sm bg-blue-100" />
                            <div className="w-3 h-3 rounded-sm bg-blue-300" />
                            <div className="w-3 h-3 rounded-sm bg-blue-500" />
                            <div className="w-3 h-3 rounded-sm bg-blue-700" />
                            <div className="w-3 h-3 rounded-sm bg-blue-900" />
                          </div>
                          <span>Más tráfico</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Sin datos. Conecta GA4 y sincroniza.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch">
          <Card className="flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Fuentes de Tráfico</CardTitle>
              <CardDescription>
                {analyticsData?.trafficSources && analyticsData.trafficSources.length > 0
                  ? `${analyticsData.trafficSources.length} fuentes`
                  : 'Sin datos. Conecta GA4 y sincroniza.'}
              </CardDescription>
            </CardHeader>
            {analyticsData?.trafficSources && analyticsData.trafficSources.length > 0 ? (
              <CardContent className="flex-1 flex flex-col">
                <PieChart
                  title=""
                  data={analyticsData.trafficSources
                    .sort((a, b) => b.sessions - a.sessions) // Ordenar por sesiones descendente
                    .map((source, index) => {
                      const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1']
                      return {
                        name: `${source.source} (${source.medium})`,
                        value: source.sessions,
                        color: colors[index % colors.length],
                      }
                    })}
                  height={isMobile ? 220 : 250}
                  innerRadius={40}
                  outerRadius={80}
                  showLegend={true}
                />
              </CardContent>
            ) : null}
          </Card>
          <Card className="flex flex-col">
            <CardHeader className="flex-shrink-0">
              <CardTitle>Dispositivos</CardTitle>
              <CardDescription>
                {analyticsData?.deviceData && analyticsData.deviceData.length > 0
                  ? `${analyticsData.deviceData.length} tipos de dispositivos`
                  : 'Sin datos. Conecta GA4 y sincroniza.'}
              </CardDescription>
            </CardHeader>
            {analyticsData?.deviceData && analyticsData.deviceData.length > 0 ? (
              <CardContent className="flex-1 flex flex-col">
                <PieChart
                  title=""
                  data={[...analyticsData.deviceData].sort((a, b) => b.value - a.value)}
                  height={isMobile ? 220 : 250}
                  innerRadius={40}
                  outerRadius={80}
                  showLegend={true}
                />
              </CardContent>
            ) : null}
          </Card>

          {/* Top Pages */}
          {analyticsData?.topPages && analyticsData.topPages.length > 0 ? (
            <Card className="flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Páginas Más Visitadas</CardTitle>
                <CardDescription>{`${analyticsData.topPages.length} páginas`}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <BarChart
                  title=""
                  description=""
                  data={analyticsData.topPages.map((page, index) => {
                    // Paleta de colores similar a las otras gráficas
                    const colors = [
                      '#3b82f6', // azul
                      '#10b981', // verde
                      '#8b5cf6', // morado
                      '#f59e0b', // naranja
                      '#ef4444', // rojo
                      '#06b6d4', // cyan
                      '#ec4899', // rosa
                      '#84cc16', // lime
                      '#6366f1', // indigo
                      '#14b8a6', // teal
                    ]
                    
                    return {
                      name: page.pageTitle, // Nombre completo, se truncará en la leyenda
                      value: page.pageViews,
                      color: colors[index % colors.length],
                    }
                  })}
                  height={isMobile ? 220 : 250}
                  formatValue={(v) => formatCompactNumber(v)}
                  showLegend={true}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-base font-medium">Páginas Más Visitadas</CardTitle>
                <CardDescription>Sin datos. Conecta GA4 y sincroniza.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Sin páginas aún.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Geographic Data - 3 columns */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Países */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tráfico por País</CardTitle>
              <CardDescription className="text-xs">
                {analyticsData?.geographicData && analyticsData.geographicData.length > 0
                  ? `${analyticsData.geographicData.length} países`
                  : 'Sin datos'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {analyticsData?.geographicData && analyticsData.geographicData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-1 py-1 text-xs">País</TableHead>
                        <TableHead className="text-right px-1 py-1 text-xs">Ses.</TableHead>
                        <TableHead className="text-right px-1 py-1 text-xs">%</TableHead>
                        <TableHead className="w-[80px] px-1 py-1 text-xs">Dist.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const totalSessions = analyticsData.geographicData.reduce((sum, item) => sum + item.sessions, 0)
                        const maxSessions = analyticsData.geographicData[0]?.sessions || 1
                        
                        return analyticsData.geographicData.map((country, index) => {
                          const percentage = totalSessions > 0 ? (country.sessions / totalSessions) * 100 : 0
                          const barWidth = (country.sessions / maxSessions) * 100
                          
                          return (
                            <TableRow key={index} className="hover:bg-muted/50">
                              <TableCell className="px-1 py-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">{getCountryFlag(country.country)}</span>
                                  <span className="font-medium text-xs truncate max-w-[60px]">{country.country}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-1 py-1 text-xs">{formatCompactNumber(country.sessions)}</TableCell>
                              <TableCell className="text-right px-1 py-1 text-xs">{formatPercentage(percentage)}</TableCell>
                              <TableCell className="px-1 py-1">
                                <Progress value={barWidth} className="h-1" />
                              </TableCell>
                            </TableRow>
                          )
                        })
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Sin datos
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ciudades */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tráfico por Ciudad</CardTitle>
              <CardDescription className="text-xs">
                {analyticsData?.cityData && analyticsData.cityData.length > 0
                  ? `${analyticsData.cityData.length} ciudades`
                  : 'Sin datos'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {analyticsData?.cityData && analyticsData.cityData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-1 py-1 text-xs">Ciudad</TableHead>
                        <TableHead className="text-right px-1 py-1 text-xs">Ses.</TableHead>
                        <TableHead className="text-right px-1 py-1 text-xs">%</TableHead>
                        <TableHead className="w-[80px] px-1 py-1 text-xs">Dist.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const totalSessions = analyticsData.cityData.reduce((sum, item) => sum + item.sessions, 0)
                        const maxSessions = analyticsData.cityData[0]?.sessions || 1
                        
                        return analyticsData.cityData.map((city, index) => {
                          const percentage = totalSessions > 0 ? (city.sessions / totalSessions) * 100 : 0
                          const barWidth = (city.sessions / maxSessions) * 100
                          
                          return (
                            <TableRow key={index} className="hover:bg-muted/50">
                              <TableCell className="px-1 py-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">{getCountryFlag(city.country)}</span>
                                  <span className="font-medium text-xs truncate max-w-[60px]" title={`${city.city}, ${city.country}`}>
                                    {city.city}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-1 py-1 text-xs">{formatCompactNumber(city.sessions)}</TableCell>
                              <TableCell className="text-right px-1 py-1 text-xs">{formatPercentage(percentage)}</TableCell>
                              <TableCell className="px-1 py-1">
                                <Progress value={barWidth} className="h-1" />
                              </TableCell>
                            </TableRow>
                          )
                        })
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Sin datos
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Horas del día */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tráfico por Hora</CardTitle>
              <CardDescription className="text-xs">
                {analyticsData?.hourlyData && analyticsData.hourlyData.length > 0
                  ? 'Distribución horaria'
                  : 'Sin datos'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3">
              {analyticsData?.hourlyData && analyticsData.hourlyData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-1 py-1 text-xs">Hora</TableHead>
                        <TableHead className="text-right px-1 py-1 text-xs">Ses.</TableHead>
                        <TableHead className="text-right px-1 py-1 text-xs">%</TableHead>
                        <TableHead className="w-[80px] px-1 py-1 text-xs">Dist.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const totalSessions = analyticsData.hourlyData.reduce((sum, item) => sum + item.sessions, 0)
                        // Ordenar por sesiones de mayor a menor
                        const sortedHourlyData = [...analyticsData.hourlyData].sort((a, b) => b.sessions - a.sessions)
                        // Obtener el máximo de sesiones para la barra de progreso
                        const maxSessions = sortedHourlyData[0]?.sessions || 1
                        
                        return sortedHourlyData.map((hourData, index) => {
                          const percentage = totalSessions > 0 ? (hourData.sessions / totalSessions) * 100 : 0
                          // La barra debe ser proporcional al máximo, no al porcentaje del total
                          const barWidth = (hourData.sessions / maxSessions) * 100
                          const hourLabel = `${hourData.hour.toString().padStart(2, '0')}:00`
                          const emoji = getHourEmoji(hourData.hour)
                          
                          return (
                            <TableRow key={index} className="hover:bg-muted/50">
                              <TableCell className="px-1 py-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">{emoji}</span>
                                  <span className="font-medium text-xs">{hourLabel}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-1 py-1 text-xs">{formatCompactNumber(hourData.sessions)}</TableCell>
                              <TableCell className="text-right px-1 py-1 text-xs">{formatPercentage(percentage)}</TableCell>
                              <TableCell className="px-1 py-1">
                                <Progress value={barWidth} className="h-1" />
                              </TableCell>
                            </TableRow>
                          )
                        })
                      })()}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground">
                  Sin datos
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

