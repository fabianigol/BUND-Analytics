'use client'

import { useMemo, useState } from 'react'
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
} from 'lucide-react'
import { mockDashboardMetrics, mockShopifyOrders, mockTopProducts } from '@/lib/utils/mock-data'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/format'
const topProductsChart = mockTopProducts.map((p) => ({
  name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
  value: p.revenue,
  color: 'var(--chart-1)',
}))

export default function VentasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const orders = mockShopifyOrders
  const hasOrders = orders.length > 0
  const hasProducts = mockTopProducts.length > 0
  const salesChartData: { date: string; value: number }[] = []

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.order_number.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || order.financial_status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orders, searchTerm, statusFilter])

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

  return (
    <div className="flex flex-col">
      <Header
        title="Ventas"
        subtitle="Análisis de ventas e ingresos de Shopify"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Ingresos Totales"
            value={mockDashboardMetrics.totalRevenue ? formatCurrency(mockDashboardMetrics.totalRevenue) : '—'}
            change={mockDashboardMetrics.revenueChange}
            icon={DollarSign}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Total Pedidos"
            value={mockDashboardMetrics.totalOrders ? formatNumber(mockDashboardMetrics.totalOrders) : '—'}
            change={mockDashboardMetrics.ordersChange}
            icon={ShoppingCart}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Valor Medio Pedido"
            value={mockDashboardMetrics.averageOrderValue ? formatCurrency(mockDashboardMetrics.averageOrderValue) : '—'}
            change={mockDashboardMetrics.aovChange}
            icon={TrendingUp}
            iconColor="bg-purple-100 text-purple-600"
          />
          <MetricCard
            title="Productos Vendidos"
            value="—"
            change={0}
            icon={Package}
            iconColor="bg-amber-100 text-amber-600"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Ingresos Diarios - Últimos 30 días</CardTitle>
              <CardDescription>Sin datos. Conecta Shopify/ventas para ver el histórico.</CardDescription>
            </CardHeader>
          </Card>
          {hasProducts ? (
            <BarChart
              title="Top Productos por Ingresos"
              data={topProductsChart}
              horizontal
              height={280}
              formatValue={(v) => formatCurrency(v)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Top Productos por Ingresos</CardTitle>
                <CardDescription>Sin datos de productos. Conecta Shopify.</CardDescription>
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
                        {order.line_items.map((item) => item.title).join(', ')}
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

