'use client'

import { useMemo, useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { QuickStatCard } from '@/components/dashboard/QuickStatCard'
import { AreaChart, BarChart } from '@/components/dashboard/Charts'
import { LocationBentoCard } from '@/components/dashboard/LocationBentoCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Search,
  Filter,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/format'
import { ShopifyOrder, ShopifyCustomer, ShopifyCustomerMetrics, ShopifyLocationMetrics } from '@/types'
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { Label } from '@/components/ui/label'
import { Calendar, Users, MapPin } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Metrics {
  totalRevenue: number
  revenueChange: number
  revenueChangeHistorical?: number
  historicalRevenue?: number | null
  previousRevenue?: number | null
  totalOrders: number
  ordersChange: number
  ordersChangeHistorical?: number
  historicalOrders?: number | null
  previousOrdersCount?: number | null
  ordersFromMedicion?: number
  ordersFromFitting?: number
  ordersWithoutAppointment?: number
  averageOrderValue: number
  aovChange: number
  aovChangeHistorical?: number
  historicalAOV?: number | null
  previousAOV?: number | null
  totalProductsSold: number
  productsSoldChangeHistorical?: number
  historicalProductsSold?: number | null
  roas?: number
  roasChange?: number
  previousROAS?: number | null
  metaSpend?: number
  previousMetaSpend?: number | null
}

type DateFilterType = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'custom'

export default function VentasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [topProducts, setTopProducts] = useState<Array<{ name: string; sales: number; revenue: number }>>([])
  const [salesChartData, setSalesChartData] = useState<{ date: string; value: number }[]>([])
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<{ date: string; value: number }[]>([])
  const [topComplements, setTopComplements] = useState<Array<{ name: string; sales: number; revenue: number }>>([])
  const [productsFilterType, setProductsFilterType] = useState<'monthly' | 'total'>('monthly')
  const [complementsFilterType, setComplementsFilterType] = useState<'monthly' | 'total'>('monthly')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
  // Estados para pestaña de Clientes
  const [customers, setCustomers] = useState<ShopifyCustomer[]>([])
  const [customerMetrics, setCustomerMetrics] = useState<ShopifyCustomerMetrics | null>(null)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customerEmailFilter, setCustomerEmailFilter] = useState('')
  const [customerPage, setCustomerPage] = useState(0)
  const [top10CustomersMonth, setTop10CustomersMonth] = useState<ShopifyCustomer[]>([])
  const [top10CustomersHistorical, setTop10CustomersHistorical] = useState<ShopifyCustomer[]>([])
  const customersPerPage = 50

  // Estados para pestaña de Ubicaciones
  const [locations, setLocations] = useState<ShopifyLocationMetrics[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  
  // Estados para filtro de fechas - Por defecto: desde el día 1 del mes actual hasta hoy
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('thisMonth')
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const today = new Date()
    const firstDay = startOfMonth(today)
    return format(firstDay, 'yyyy-MM-dd')
  })
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const today = new Date()
    return format(today, 'yyyy-MM-dd')
  })

  // Calcular rango de fechas según el tipo de filtro
  const dateRange = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    switch (dateFilterType) {
      case 'last7': {
        const start = subDays(today, 6)
        start.setHours(0, 0, 0, 0)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
      case 'last30': {
        const start = subDays(today, 29)
        start.setHours(0, 0, 0, 0)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
      case 'last90': {
        const start = subDays(today, 89)
        start.setHours(0, 0, 0, 0)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
      case 'thisMonth': {
        const start = startOfMonth(today)
        start.setHours(0, 0, 0, 0)
        const end = new Date(today)
        end.setHours(23, 59, 59, 999)
        return { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') }
      }
      case 'lastMonth': {
        const lastMonth = startOfMonth(subMonths(today, 1))
        const lastDayOfLastMonth = endOfMonth(subMonths(today, 1))
        return { start: format(lastMonth, 'yyyy-MM-dd'), end: format(lastDayOfLastMonth, 'yyyy-MM-dd') }
      }
      case 'custom': {
        // Si no hay fechas personalizadas, usar el día 1 del mes actual hasta hoy
        if (!customStartDate || !customEndDate) {
          const start = startOfMonth(today)
          return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
        }
        return { start: customStartDate, end: customEndDate }
      }
      default:
        return null
    }
  }, [dateFilterType, customStartDate, customEndDate])

  // Formatear el período visible
  const periodLabel = useMemo(() => {
    if (!dateRange) return 'Sin filtro'
    
    try {
      const start = parseISO(dateRange.start)
      const end = parseISO(dateRange.end)
      return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
    } catch {
      return `${dateRange.start} - ${dateRange.end}`
    }
  }, [dateRange])

  // Cargar datos cuando cambie el rango de fechas o filtros
  useEffect(() => {
    if (dateRange || dateFilterType !== 'custom') {
      loadData()
    }
  }, [dateRange, productsFilterType, complementsFilterType])

  // Cargar datos de clientes cuando cambie el filtro o rango de fechas
  useEffect(() => {
    if (isConnected) {
      loadCustomersData()
      loadLocationsData()
    }
  }, [dateRange, customerEmailFilter, customerPage, isConnected])

  // Cargar datos de Ubicaciones
  const loadLocationsData = async () => {
    try {
      setLocationsLoading(true)
      const dateParams = dateRange 
        ? `&startDate=${dateRange.start}&endDate=${dateRange.end}`
        : ''

      const locationsRes = await fetch(`/api/shopify?type=locations${dateParams}`)

      if (locationsRes.ok) {
        const locationsData = await locationsRes.json()
        if (locationsData.success) {
          setLocations(locationsData.data || [])
        }
      }
    } catch (err) {
      console.error('Error loading locations:', err)
    } finally {
      setLocationsLoading(false)
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/integrations/shopify')
      if (response.ok) {
        const data = await response.json()
        setIsConnected(data.connected || false)
      }
    } catch (err) {
      console.error('Error checking Shopify connection:', err)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Construir parámetros de fecha para las peticiones
      const dateParams = dateRange 
        ? `&startDate=${dateRange.start}&endDate=${dateRange.end}`
        : ''

      // Calcular días para el gráfico
      let days = 30
      if (dateRange) {
        const start = parseISO(dateRange.start)
        const end = parseISO(dateRange.end)
        days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Cargar métricas, pedidos, productos, gráficos, datos mensuales y complementos
      const productsFilter = productsFilterType === 'monthly' ? dateParams : ''
      const complementsFilter = complementsFilterType === 'monthly' ? dateParams : ''
      
      const [metricsRes, ordersRes, productsRes, chartsRes, monthlyRes, complementsRes] = await Promise.all([
        fetch(`/api/shopify?type=metrics${dateParams}`),
        fetch(`/api/shopify?type=orders&limit=100${dateParams}`),
        fetch(`/api/shopify?type=products&limit=10${productsFilter}&filterType=${productsFilterType}`),
        fetch(`/api/shopify?type=charts${dateParams}&days=${days}`),
        fetch(`/api/shopify?type=monthly-revenue&months=12`),
        fetch(`/api/shopify?type=complements&limit=10${complementsFilter}&filterType=${complementsFilterType}`),
      ])

      if (!metricsRes.ok || !ordersRes.ok || !productsRes.ok || !chartsRes.ok) {
        throw new Error('Error al cargar datos de Shopify')
      }

      const [metricsData, ordersData, productsData, chartsData, monthlyData, complementsData] = await Promise.all([
        metricsRes.json(),
        ordersRes.json(),
        productsRes.json(),
        chartsRes.json(),
        monthlyRes.ok ? monthlyRes.json() : Promise.resolve({ success: true, data: [] }),
        complementsRes.ok ? complementsRes.json() : Promise.resolve({ success: true, data: [] }),
      ])

      if (metricsData.success) {
        setMetrics(metricsData.data)
      }
      if (ordersData.success) {
        setOrders(ordersData.data || [])
      }
      if (productsData.success) {
        setTopProducts(productsData.data || [])
      }
      if (chartsData.success) {
        setSalesChartData(chartsData.data || [])
      }
      if (monthlyData.success) {
        setMonthlyRevenueData(monthlyData.data || [])
      }
      if (complementsData.success) {
        setTopComplements(complementsData.data || [])
      }
    } catch (err: any) {
      console.error('Error loading sales data:', err)
      setError(err.message || 'Error al cargar datos de ventas')
    } finally {
      setLoading(false)
    }
  }

  // Cargar datos de clientes
  const loadCustomersData = async () => {
    try {
      setCustomersLoading(true)
      
      const dateParams = dateRange 
        ? `&startDate=${dateRange.start}&endDate=${dateRange.end}`
        : ''

      const emailParam = customerEmailFilter ? `&email=${encodeURIComponent(customerEmailFilter)}` : ''
      const offset = customerPage * customersPerPage
      const limit = customersPerPage

      // Cargar clientes paginados, métricas, top 10 del mes e histórico
      const [customersRes, metricsRes, top10MonthRes, top10HistoricalRes] = await Promise.all([
        fetch(`/api/shopify?type=customers${dateParams}${emailParam}&limit=${limit}&offset=${offset}`),
        fetch(`/api/shopify?type=customer-metrics${dateParams}`),
        fetch(`/api/shopify?type=customers${dateParams}&limit=10&offset=0`), // Top 10 del período
        fetch(`/api/shopify?type=customers&limit=10&offset=0`), // Top 10 histórico (sin filtro de fechas)
      ])

      if (!customersRes.ok || !metricsRes.ok) {
        throw new Error('Error al cargar datos de clientes')
      }

      const [customersData, metricsData, top10MonthData, top10HistoricalData] = await Promise.all([
        customersRes.json(),
        metricsRes.json(),
        top10MonthRes.ok ? top10MonthRes.json() : Promise.resolve({ success: true, data: [] }),
        top10HistoricalRes.ok ? top10HistoricalRes.json() : Promise.resolve({ success: true, data: [] }),
      ])

      if (customersData.success) {
        setCustomers(customersData.data || [])
      }
      if (metricsData.success) {
        setCustomerMetrics(metricsData.data)
      }
      if (top10MonthData.success) {
        setTop10CustomersMonth(top10MonthData.data || [])
      }
      if (top10HistoricalData.success) {
        setTop10CustomersHistorical(top10HistoricalData.data || [])
      }
    } catch (err: any) {
      console.error('Error loading customers data:', err)
      setError(err.message || 'Error al cargar datos de clientes')
    } finally {
      setCustomersLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)

      const response = await fetch('/api/sync/shopify', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al sincronizar')
      }

      const data = await response.json()
      
      // Recargar datos después de sincronizar
      await loadData()
      await loadCustomersData()
      
      alert(`Sincronización completada: ${data.records_synced} pedidos sincronizados`)
    } catch (err: any) {
      console.error('Error syncing Shopify:', err)
      setError(err.message || 'Error al sincronizar datos')
    } finally {
      setSyncing(false)
    }
  }

  const hasOrders = orders.length > 0
  const hasProducts = topProducts.length > 0
  const hasChartData = salesChartData.length > 0

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || order.financial_status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orders, searchTerm, statusFilter])

  // Colores verdes para las gráficas
  const greenColors = [
    '#10b981', // emerald-500
    '#059669', // emerald-600
    '#047857', // emerald-700
    '#065f46', // emerald-800
    '#064e3b', // emerald-900
    '#34d399', // emerald-400
    '#6ee7b7', // emerald-300
  ]

  const topProductsChart = topProducts.map((p, index) => ({
    name: p.name, // No truncar, dejar que el gráfico maneje el espacio
    value: p.revenue,
    color: greenColors[index % greenColors.length],
  }))

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Pagado</Badge>
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendiente</Badge>
      case 'refunded':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Reembolsado</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getFulfillmentBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Sin enviar</Badge>
    switch (status) {
      case 'fulfilled':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Enviado</Badge>
      case 'pending':
        return <Badge variant="outline">Pendiente</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header
          title="Ventas"
          subtitle="Análisis de ventas e ingresos de Shopify"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando datos de ventas...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col">
        <Header
          title="Ventas"
          subtitle="Análisis de ventas e ingresos de Shopify"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Shopify no está conectado
              </CardTitle>
              <CardDescription>
                Conecta tu tienda de Shopify para ver datos de ventas en tiempo real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href="/integraciones">Ir a Integraciones</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Ventas"
        subtitle="Análisis de ventas e ingresos de Shopify"
      />

      <div className="flex-1 space-y-6 p-6">
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sistema de Pestañas */}
        <Tabs defaultValue="pedidos" className="w-full">
          <TabsList>
            <TabsTrigger value="pedidos">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="clientes">
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="ubicaciones">
              <MapPin className="h-4 w-4 mr-2" />
              Ubicaciones
            </TabsTrigger>
          </TabsList>

        {/* Filtro de Fechas - Compartido entre pestañas */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Button
                  variant={dateFilterType === 'last7' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setDateFilterType('last7')}
                >
                  7 días
                </Button>
                <Button
                  variant={dateFilterType === 'last30' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setDateFilterType('last30')}
                >
                  30 días
                </Button>
                <Button
                  variant={dateFilterType === 'last90' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setDateFilterType('last90')}
                >
                  90 días
                </Button>
                <Button
                  variant={dateFilterType === 'thisMonth' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setDateFilterType('thisMonth')}
                >
                  Este mes
                </Button>
                <Button
                  variant={dateFilterType === 'lastMonth' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => setDateFilterType('lastMonth')}
                >
                  Mes anterior
                </Button>
                <Button
                  variant={dateFilterType === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => {
                    // Al seleccionar personalizado, inicializar con día 1 del mes actual hasta hoy
                    const today = new Date()
                    const firstDay = startOfMonth(today)
                    setCustomStartDate(format(firstDay, 'yyyy-MM-dd'))
                    setCustomEndDate(format(today, 'yyyy-MM-dd'))
                    setDateFilterType('custom')
                  }}
                >
                  Personalizado
                </Button>
                {dateRange && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {periodLabel}
                  </span>
                )}
              </div>

              {dateFilterType === 'custom' && (
                <div className="flex gap-3 items-end pt-2 border-t">
                  <div className="space-y-1">
                    <Label htmlFor="customStartDate" className="text-xs">Inicio</Label>
                    <Input
                      id="customStartDate"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="customEndDate" className="text-xs">Fin</Label>
                    <Input
                      id="customEndDate"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      max={format(new Date(), 'yyyy-MM-dd')}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

          {/* Pestaña: Pedidos */}
          <TabsContent value="pedidos" className="space-y-6 mt-6">
            {/* Quick Stats */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <QuickStatCard
                title="Ingresos Totales"
                value={metrics?.totalRevenue ? formatCurrency(metrics.totalRevenue) : '—'}
                emoji="💰"
                emojiBgColor="bg-emerald-100"
                previousPeriodValue={metrics?.previousRevenue || null}
                previousPeriodChange={metrics?.revenueChange}
                historicalValue={metrics?.historicalRevenue || null}
                historicalChange={metrics?.revenueChangeHistorical}
                formatValue={(v) => formatCurrency(v)}
              />
              <QuickStatCard
                title="Total Pedidos"
                value={metrics?.totalOrders ? formatNumber(metrics.totalOrders) : '—'}
                emoji="🛒"
                emojiBgColor="bg-blue-100"
                previousPeriodValue={metrics?.previousOrdersCount || null}
                previousPeriodChange={metrics?.ordersChange}
                historicalValue={metrics?.historicalOrders || null}
                historicalChange={metrics?.ordersChangeHistorical}
                formatValue={(v) => formatNumber(v)}
              />
              <QuickStatCard
                title="Valor Medio Pedido"
                value={metrics?.averageOrderValue ? formatCurrency(metrics.averageOrderValue) : '—'}
                emoji="📊"
                emojiBgColor="bg-purple-100"
                previousPeriodValue={metrics?.previousAOV || null}
                previousPeriodChange={metrics?.aovChange}
                historicalValue={metrics?.historicalAOV || null}
                historicalChange={metrics?.aovChangeHistorical}
                formatValue={(v) => formatCurrency(v)}
              />
              <QuickStatCard
                title="ROAS"
                value={metrics?.roas ? metrics.roas.toFixed(2) : '—'}
                emoji="📈"
                emojiBgColor="bg-rose-100"
                previousPeriodValue={metrics?.previousROAS || null}
                previousPeriodChange={metrics?.roasChange}
                historicalValue={null}
                historicalChange={undefined}
                formatValue={(v) => v.toFixed(2)}
              />
            </div>

        {/* Charts - Diario y Mensual Anual */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Gráfica de Evolución Diaria */}
          {hasChartData ? (
            <AreaChart
              title={`Ingresos Diarios - ${periodLabel}`}
              data={salesChartData.map(d => ({ date: d.date, value: d.value }))}
              height={280}
              formatValue={(v) => formatCurrency(v)}
              color="#10b981"
              gradientColor="#059669"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Ingresos Diarios - {periodLabel}</CardTitle>
                <CardDescription>Sin datos. Sincroniza Shopify para ver el histórico.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Gráfica de Evolución Mensual Anual (Barras) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Evolución Mensual de Ventas (Últimos 12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyRevenueData.length > 0 ? (
                <BarChart
                  title=""
                  data={monthlyRevenueData.map(d => ({ name: d.date, value: d.value }))}
                  height={280}
                  formatValue={(v) => formatCurrency(v)}
                  color="#10b981"
                  horizontal={false}
                  xAxisKey="name"
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Sin datos. Sincroniza Shopify para ver el histórico.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Productos y Top Complementos */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Productos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Top Productos por Ingresos</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={productsFilterType === 'monthly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setProductsFilterType('monthly')}
                  >
                    Mensual
                  </Button>
                  <Button
                    variant={productsFilterType === 'total' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setProductsFilterType('total')}
                  >
                    Total
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {hasProducts ? (
                <BarChart
                  title=""
                  data={topProductsChart}
                  horizontal
                  height={280}
                  formatValue={(v) => formatCurrency(v)}
                  color="#10b981"
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Sin datos de productos. Sincroniza Shopify.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Complementos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Top Complementos por Ingresos</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={complementsFilterType === 'monthly' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setComplementsFilterType('monthly')}
                  >
                    Mensual
                  </Button>
                  <Button
                    variant={complementsFilterType === 'total' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setComplementsFilterType('total')}
                  >
                    Total
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2">
              {topComplements.length > 0 ? (
                <BarChart
                  title=""
                  data={topComplements.map((c, index) => ({
                    name: c.name,
                    value: c.revenue,
                    color: greenColors[index % greenColors.length],
                  }))}
                  horizontal
                  height={280}
                  formatValue={(v) => formatCurrency(v)}
                  color="#10b981"
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Sin datos de complementos. Sincroniza Shopify.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-medium">Pedidos Recientes</CardTitle>
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
                    <SelectItem value="paid">Pagados</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="refunded">Reembolsados</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing}
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
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
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Envío</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">
                        {(order.line_items || []).slice(0, 2).map((item) => item.title).join(', ')}
                        {(order.line_items || []).length > 2 && ` +${(order.line_items || []).length - 2} más`}
                      </p>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(order.total_price)}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.financial_status)}</TableCell>
                    <TableCell>{getFulfillmentBadge(order.fulfillment_status)}</TableCell>
                    <TableCell>{formatDate(order.created_at, 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!hasOrders && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Sin pedidos aún. Conecta Shopify para ver ventas reales.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Pestaña: Clientes */}
          <TabsContent value="clientes" className="space-y-6 mt-6">
            {customersLoading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Quick Stats de Clientes */}
                {customerMetrics && (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <QuickStatCard
                      title="Total Clientes"
                      value={formatNumber(customerMetrics.totalCustomers)}
                      emoji="👥"
                      emojiBgColor="bg-blue-100"
                      previousPeriodValue={customerMetrics.previousTotalCustomers || null}
                      previousPeriodChange={customerMetrics.totalCustomersChange}
                      historicalValue={customerMetrics.historicalTotalCustomers || null}
                      historicalChange={customerMetrics.totalCustomersChangeHistorical}
                      formatValue={(v) => formatNumber(v)}
                    />
                    <QuickStatCard
                      title="Nuevos Clientes"
                      value={formatNumber(customerMetrics.newCustomers)}
                      emoji="🆕"
                      emojiBgColor="bg-emerald-100"
                      previousPeriodValue={customerMetrics.previousNewCustomers || null}
                      previousPeriodChange={customerMetrics.newCustomersChange}
                      historicalValue={null}
                      historicalChange={undefined}
                      formatValue={(v) => formatNumber(v)}
                    />
                    <QuickStatCard
                      title="Clientes Recurrentes"
                      value={formatNumber(customerMetrics.recurringCustomers)}
                      emoji="♻️"
                      emojiBgColor="bg-purple-100"
                      previousPeriodValue={customerMetrics.previousRecurringCustomers || null}
                      previousPeriodChange={customerMetrics.recurringCustomersChange}
                      historicalValue={null}
                      historicalChange={undefined}
                      formatValue={(v) => formatNumber(v)}
                    />
                    <QuickStatCard
                      title="Tasa de Retención"
                      value={`${customerMetrics.retentionRate.toFixed(1)}%`}
                      emoji="📈"
                      emojiBgColor="bg-amber-100"
                      previousPeriodValue={customerMetrics.previousRetentionRate || null}
                      previousPeriodChange={customerMetrics.retentionRateChange}
                      historicalValue={null}
                      historicalChange={undefined}
                      formatValue={(v) => `${v.toFixed(1)}%`}
                    />
                    <QuickStatCard
                      title="Valor Promedio"
                      value={formatCurrency(customerMetrics.averageCustomerValue)}
                      emoji="💰"
                      emojiBgColor="bg-green-100"
                      previousPeriodValue={customerMetrics.previousAverageCustomerValue || null}
                      previousPeriodChange={customerMetrics.averageCustomerValueChange}
                      historicalValue={null}
                      historicalChange={undefined}
                      formatValue={(v) => formatCurrency(v)}
                    />
                  </div>
                )}

                {/* Top 10 Clientes del Mes e Histórico */}
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Top 10 Clientes del Período</CardTitle>
                      <CardDescription>Según período seleccionado</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Ciudad</TableHead>
                            <TableHead className="text-right">LTV</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {top10CustomersMonth.map((customer, index) => {
                            const historicalIndex = top10CustomersHistorical.findIndex(c => c.email === customer.email)
                            const positionChange = historicalIndex !== -1 ? historicalIndex - index : null
                            const getPositionIcon = (pos: number) => {
                              if (pos === 0) return '🥇'
                              if (pos === 1) return '🥈'
                              if (pos === 2) return '🥉'
                              return null
                            }
                            const positionIcon = getPositionIcon(index)
                            return (
                              <TableRow key={customer.email} className="hover:bg-muted/50">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-base">
                                      {positionIcon || <span className="text-sm font-semibold text-primary">{index + 1}</span>}
                                    </div>
                                    <div>
                                      <p className="font-medium">{customer.name || customer.email}</p>
                                      <p className="text-xs text-muted-foreground">{customer.orderCount} pedido{customer.orderCount !== 1 ? 's' : ''}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {customer.city ? (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      {customer.city}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      N/A
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className="font-semibold">{formatCurrency(customer.totalSpent)}</span>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {top10CustomersMonth.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                                Sin datos
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-medium">Top 10 Clientes Histórico</CardTitle>
                      <CardDescription>De todos los tiempos</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Ciudad</TableHead>
                            <TableHead className="text-right">LTV</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {top10CustomersHistorical.map((customer, index) => {
                            const monthIndex = top10CustomersMonth.findIndex(c => c.email === customer.email)
                            const positionChange = monthIndex !== -1 ? index - monthIndex : null
                            const getPositionIcon = (pos: number) => {
                              if (pos === 0) return '🥇'
                              if (pos === 1) return '🥈'
                              if (pos === 2) return '🥉'
                              return null
                            }
                            const positionIcon = getPositionIcon(index)
                            return (
                              <TableRow key={customer.email} className="hover:bg-muted/50">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-base">
                                      {positionIcon || <span className="text-sm font-semibold text-primary">{index + 1}</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium">{customer.name || customer.email}</p>
                                          {positionChange !== null && positionChange !== 0 && (
                                            positionChange > 0 ? (
                                              <TrendingDown className="h-4 w-4 text-red-600" />
                                            ) : (
                                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                                            )
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{customer.orderCount} pedido{customer.orderCount !== 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {customer.city ? (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      {customer.city}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      N/A
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className="font-semibold">{formatCurrency(customer.totalSpent)}</span>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                          {top10CustomersHistorical.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                                Sin datos
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                {/* Segmentación */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="overflow-hidden border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">👑</span>
                        <div>
                          <CardTitle className="text-base font-bold text-purple-900">Clientes VIP</CardTitle>
                          <CardDescription className="text-purple-700">LTV &gt; €2,000</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-purple-900 mb-1">{customerMetrics?.vipCustomersCount || 0}</div>
                      {customerMetrics && customerMetrics.totalCustomers > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-purple-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-600 rounded-full transition-all"
                              style={{ width: `${((customerMetrics.vipCustomersCount / customerMetrics.totalCustomers) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-purple-700">
                            {((customerMetrics.vipCustomersCount / customerMetrics.totalCustomers) * 100).toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="overflow-hidden border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">✅</span>
                        <div>
                          <CardTitle className="text-base font-bold text-emerald-900">Estado</CardTitle>
                          <CardDescription className="text-emerald-700">Activos vs Inactivos</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-100/50">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-600" />
                            <span className="text-sm font-medium text-emerald-900">Activos</span>
                          </div>
                          <span className="text-xl font-bold text-emerald-900">
                            {customers.filter(c => c.status === 'active').length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-gray-100/50">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gray-400" />
                            <span className="text-sm font-medium text-gray-700">Inactivos</span>
                          </div>
                          <span className="text-xl font-bold text-gray-700">
                            {customers.filter(c => c.status === 'inactive').length}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="overflow-hidden border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🔄</span>
                        <div>
                          <CardTitle className="text-base font-bold text-blue-900">Tipo</CardTitle>
                          <CardDescription className="text-blue-700">Nuevos vs Recurrentes</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-blue-100/50">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🆕</span>
                            <span className="text-sm font-medium text-blue-900">Nuevos</span>
                          </div>
                          <span className="text-xl font-bold text-blue-900">
                            {customers.filter(c => c.isNew).length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-purple-100/50">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">♻️</span>
                            <span className="text-sm font-medium text-purple-900">Recurrentes</span>
                          </div>
                          <span className="text-xl font-bold text-purple-900">
                            {customers.filter(c => c.isRecurring).length}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabla de Clientes */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-base font-medium">Clientes</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Buscar por email..."
                            value={customerEmailFilter}
                            onChange={(e) => {
                              setCustomerEmailFilter(e.target.value)
                              setCustomerPage(0) // Reset paginación al filtrar
                            }}
                            className="w-64 pl-9"
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Total Gastado (LTV)</TableHead>
                          <TableHead>Pedidos</TableHead>
                          <TableHead>Último Pedido</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.email}>
                            <TableCell className="font-medium">{customer.name || customer.email}</TableCell>
                            <TableCell>{customer.email}</TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(customer.totalSpent)}
                              {customer.isVip && (
                                <Badge className="ml-2 bg-purple-100 text-purple-700">VIP</Badge>
                              )}
                            </TableCell>
                            <TableCell>{customer.orderCount}</TableCell>
                            <TableCell>{formatDate(customer.lastOrderDate, 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                              <Badge className={customer.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}>
                                {customer.status === 'active' ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {customers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                              {customerEmailFilter ? 'No se encontraron clientes con ese email' : 'Sin clientes aún'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    {customers.length > 0 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Página {customerPage + 1}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCustomerPage(p => Math.max(0, p - 1))}
                            disabled={customerPage === 0}
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCustomerPage(p => p + 1)}
                            disabled={customers.length < customersPerPage}
                          >
                            Siguiente
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

              </>
            )}
          </TabsContent>

          {/* Pestaña: Ubicaciones */}
          <TabsContent value="ubicaciones" className="mt-6">
            {locationsLoading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : locations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {locations.map((location) => (
                  <LocationBentoCard key={location.location} location={location} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Sin datos de ubicaciones. Asegúrate de que los pedidos tengan tags con información de tienda.
                    </p>
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

