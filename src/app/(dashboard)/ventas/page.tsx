'use client'

import { useMemo, useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart } from '@/components/dashboard/Charts'
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
  Package,
  Search,
  Filter,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/format'
import { ShopifyOrder } from '@/types'
import { format, subDays, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { Label } from '@/components/ui/label'
import { Calendar } from 'lucide-react'

interface Metrics {
  totalRevenue: number
  revenueChange: number
  totalOrders: number
  ordersChange: number
  averageOrderValue: number
  aovChange: number
  totalProductsSold: number
}

type DateFilterType = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'custom'

export default function VentasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [topProducts, setTopProducts] = useState<Array<{ name: string; sales: number; revenue: number }>>([])
  const [salesChartData, setSalesChartData] = useState<{ date: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  
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

  // Cargar datos cuando cambie el rango de fechas
  useEffect(() => {
    if (dateRange || dateFilterType !== 'custom') {
      loadData()
    }
  }, [dateRange])

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

      // Cargar métricas, pedidos, productos y gráficos en paralelo
      const [metricsRes, ordersRes, productsRes, chartsRes] = await Promise.all([
        fetch(`/api/shopify?type=metrics${dateParams}`),
        fetch(`/api/shopify?type=orders&limit=100${dateParams}`),
        fetch(`/api/shopify?type=products&limit=10${dateParams}`),
        fetch(`/api/shopify?type=charts${dateParams}&days=${days}`),
      ])

      if (!metricsRes.ok || !ordersRes.ok || !productsRes.ok || !chartsRes.ok) {
        throw new Error('Error al cargar datos de Shopify')
      }

      const [metricsData, ordersData, productsData, chartsData] = await Promise.all([
        metricsRes.json(),
        ordersRes.json(),
        productsRes.json(),
        chartsRes.json(),
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
    } catch (err: any) {
      console.error('Error loading sales data:', err)
      setError(err.message || 'Error al cargar datos de ventas')
    } finally {
      setLoading(false)
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
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
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

        {/* Filtro de Fechas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Filtro de Período
            </CardTitle>
            <CardDescription>
              Selecciona el período para filtrar los datos de ventas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={dateFilterType === 'last7' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilterType('last7')}
                >
                  Últimos 7 días
                </Button>
                <Button
                  variant={dateFilterType === 'last30' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilterType('last30')}
                >
                  Últimos 30 días
                </Button>
                <Button
                  variant={dateFilterType === 'last90' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilterType('last90')}
                >
                  Últimos 90 días
                </Button>
                <Button
                  variant={dateFilterType === 'thisMonth' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilterType('thisMonth')}
                >
                  Este mes
                </Button>
                <Button
                  variant={dateFilterType === 'lastMonth' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateFilterType('lastMonth')}
                >
                  Mes pasado
                </Button>
                <Button
                  variant={dateFilterType === 'custom' ? 'default' : 'outline'}
                  size="sm"
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
              </div>

              {dateFilterType === 'custom' && (
                <div className="grid gap-4 md:grid-cols-2 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="customStartDate">Fecha de inicio</Label>
                    <Input
                      id="customStartDate"
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customEndDate">Fecha de fin</Label>
                    <Input
                      id="customEndDate"
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      max={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                </div>
              )}

              {dateRange && (
                <div className="text-sm text-muted-foreground">
                  <strong>Período seleccionado:</strong> {periodLabel}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Ingresos Totales"
            value={metrics?.totalRevenue ? formatCurrency(metrics.totalRevenue) : '—'}
            change={metrics?.revenueChange || 0}
            icon={DollarSign}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Total Pedidos"
            value={metrics?.totalOrders ? formatNumber(metrics.totalOrders) : '—'}
            change={metrics?.ordersChange || 0}
            icon={ShoppingCart}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Valor Medio Pedido"
            value={metrics?.averageOrderValue ? formatCurrency(metrics.averageOrderValue) : '—'}
            change={metrics?.aovChange || 0}
            icon={TrendingUp}
            iconColor="bg-purple-100 text-purple-600"
          />
          <MetricCard
            title="Productos Vendidos"
            value={metrics?.totalProductsSold ? formatNumber(metrics.totalProductsSold) : '—'}
            change={0}
            icon={Package}
            iconColor="bg-amber-100 text-amber-600"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
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
          {hasProducts ? (
            <BarChart
              title="Top Productos por Ingresos"
              data={topProductsChart}
              horizontal
              height={280}
              formatValue={(v) => formatCurrency(v)}
              color="#10b981"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Top Productos por Ingresos</CardTitle>
                <CardDescription>Sin datos de productos. Sincroniza Shopify.</CardDescription>
              </CardHeader>
            </Card>
          )}
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
      </div>
    </div>
  )
}

