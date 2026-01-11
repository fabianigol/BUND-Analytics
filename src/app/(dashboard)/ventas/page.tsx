'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { QuickStatCard } from '@/components/dashboard/QuickStatCard'
import { AreaChart, BarChart } from '@/components/dashboard/Charts'
import { LocationBentoCard } from '@/components/dashboard/LocationBentoCard'
import { ObjetivosTab } from '@/components/dashboard/ObjetivosTab'
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
  Target,
} from 'lucide-react'
import { formatCurrency, formatCurrencyByCountry, formatNumber, formatDate, convertMXNtoEUR } from '@/lib/utils/format'
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

type DateFilterType = 'today' | 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth' | 'custom'

export default function VentasPage() {
  // Obtener país de la URL (ES por defecto)
  const searchParams = useSearchParams()
  const router = useRouter()
  const country = (searchParams.get('country') || 'ES').toUpperCase() as 'ES' | 'MX'
  
  // Redirect a ES si no hay parámetro country
  useEffect(() => {
    if (!searchParams.get('country')) {
      router.replace('/ventas?country=ES')
    }
  }, [searchParams, router])
  
  // Helper para agregar parámetro country a las URLs de API
  const addCountryParam = (url: string) => {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}country=${country}`
  }
  
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
  
  // Estados para pestaña de Pedidos online
  const [ordersOnline, setOrdersOnline] = useState<ShopifyOrder[]>([])
  const [metricsOnline, setMetricsOnline] = useState<Metrics | null>(null)
  const [topProductsOnline, setTopProductsOnline] = useState<Array<{ name: string; sales: number; revenue: number }>>([])
  const [salesChartDataOnline, setSalesChartDataOnline] = useState<{ date: string; value: number }[]>([])
  const [monthlyRevenueDataOnline, setMonthlyRevenueDataOnline] = useState<{ date: string; value: number }[]>([])
  const [topComplementsOnline, setTopComplementsOnline] = useState<Array<{ name: string; sales: number; revenue: number }>>([])
  const [searchTermOnline, setSearchTermOnline] = useState('')
  const [statusFilterOnline, setStatusFilterOnline] = useState('all')
  const [loadingOnline, setLoadingOnline] = useState(false)
  
  // Estados para análisis de horarios y días
  const [timeAnalysisData, setTimeAnalysisData] = useState<{
    hourly: Array<{ hour: number; hourLabel: string; revenue: number; orders: number }>
    daily: Array<{ day: number; dayName: string; revenue: number; orders: number }>
  } | null>(null)
  
  // Estados para segmentación de clientes online
  const [customerSegmentation, setCustomerSegmentation] = useState<{
    totalCustomers: number
    newCustomers: number
    recurringCustomers: number
    retentionRate: number
    newCustomersRevenue: number
    recurringCustomersRevenue: number
    averageNewCustomerValue: number
    averageRecurringCustomerValue: number
    averageLTV: number
  } | null>(null)
  
  // Estados para la calculadora de rentabilidad
  const [calculatorValues, setCalculatorValues] = useState({
    averageOrderValue: 126.00,
    productCost: 12.54,
    paymentCommissions: 2.10, // porcentaje
    shippingCost: 5.00,
    fulfillmentCost: 0.00,
    returnRate: 4.00, // porcentaje
    taxes: 21.00, // porcentaje (IVA)
  })
  
  // Estados para filtro de fechas - INDEPENDIENTES para cada pestaña
  // Filtros para pestaña Pedidos
  const [dateFilterTypePedidos, setDateFilterTypePedidos] = useState<DateFilterType>('thisMonth')
  const [customStartDatePedidos, setCustomStartDatePedidos] = useState<string>(() => {
    const today = new Date()
    const firstDay = startOfMonth(today)
    return format(firstDay, 'yyyy-MM-dd')
  })
  const [customEndDatePedidos, setCustomEndDatePedidos] = useState<string>(() => {
    const today = new Date()
    return format(today, 'yyyy-MM-dd')
  })
  
  // Filtros para pestaña Pedidos Online
  const [dateFilterTypeOnline, setDateFilterTypeOnline] = useState<DateFilterType>('thisMonth')
  const [customStartDateOnline, setCustomStartDateOnline] = useState<string>(() => {
    const today = new Date()
    const firstDay = startOfMonth(today)
    return format(firstDay, 'yyyy-MM-dd')
  })
  const [customEndDateOnline, setCustomEndDateOnline] = useState<string>(() => {
    const today = new Date()
    return format(today, 'yyyy-MM-dd')
  })
  
  // Filtros para pestaña Clientes
  const [dateFilterTypeClientes, setDateFilterTypeClientes] = useState<DateFilterType>('thisMonth')
  const [customStartDateClientes, setCustomStartDateClientes] = useState<string>(() => {
    const today = new Date()
    const firstDay = startOfMonth(today)
    return format(firstDay, 'yyyy-MM-dd')
  })
  const [customEndDateClientes, setCustomEndDateClientes] = useState<string>(() => {
    const today = new Date()
    return format(today, 'yyyy-MM-dd')
  })

  // Función helper para calcular rango de fechas
  const calculateDateRange = (filterType: DateFilterType, customStart: string, customEnd: string) => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    switch (filterType) {
      case 'today': {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
      }
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
        if (!customStart || !customEnd) {
          const start = startOfMonth(today)
          return { start: format(start, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
        }
        return { start: customStart, end: customEnd }
      }
      default:
        return null
    }
  }

  // Calcular rangos de fechas INDEPENDIENTES para cada pestaña
  const dateRangePedidos = useMemo(() => 
    calculateDateRange(dateFilterTypePedidos, customStartDatePedidos, customEndDatePedidos),
    [dateFilterTypePedidos, customStartDatePedidos, customEndDatePedidos]
  )
  
  const dateRangeOnline = useMemo(() => 
    calculateDateRange(dateFilterTypeOnline, customStartDateOnline, customEndDateOnline),
    [dateFilterTypeOnline, customStartDateOnline, customEndDateOnline]
  )
  
  const dateRangeClientes = useMemo(() => 
    calculateDateRange(dateFilterTypeClientes, customStartDateClientes, customEndDateClientes),
    [dateFilterTypeClientes, customStartDateClientes, customEndDateClientes]
  )

  // Formatear el período visible
  // Función helper para crear period labels
  const createPeriodLabel = (dateRange: { start: string; end: string } | null) => {
    if (!dateRange) return 'Sin filtro'
    try {
      const start = parseISO(dateRange.start)
      const end = parseISO(dateRange.end)
      return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
    } catch {
      return `${dateRange.start} - ${dateRange.end}`
    }
  }

  // Period labels independientes para cada pestaña
  const periodLabelPedidos = useMemo(() => createPeriodLabel(dateRangePedidos), [dateRangePedidos])
  const periodLabelOnline = useMemo(() => createPeriodLabel(dateRangeOnline), [dateRangeOnline])
  const periodLabelClientes = useMemo(() => createPeriodLabel(dateRangeClientes), [dateRangeClientes])

  // ========== FUNCIONES DE CARGA DE DATOS ==========
  
  // Cargar datos de Ubicaciones
  const loadLocationsData = async () => {
    try {
      setLocationsLoading(true)
      // Ubicaciones usa el filtro de Pedidos
      const dateParams = dateRangePedidos
        ? `&startDate=${dateRangePedidos.start}&endDate=${dateRangePedidos.end}`
        : ''

      // Para ubicaciones, obtener datos de AMBOS países (no filtrar por country)
      const locationsRes = await fetch(`/api/shopify?type=locations${dateParams}&country=ALL`)

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

  const checkConnection = async () => {
    try {
      const response = await fetch(addCountryParam('/api/integrations/shopify'))
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

      // Construir parámetros de fecha para las peticiones - USA dateRangePedidos
      const dateParams = dateRangePedidos
        ? `&startDate=${dateRangePedidos.start}&endDate=${dateRangePedidos.end}`
        : ''

      // Calcular días para el gráfico
      let days = 30
      if (dateRangePedidos) {
        const start = parseISO(dateRangePedidos.start)
        const end = parseISO(dateRangePedidos.end)
        days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Cargar métricas, pedidos, productos, gráficos, datos mensuales y complementos
      const productsFilter = productsFilterType === 'monthly' ? dateParams : ''
      const complementsFilter = complementsFilterType === 'monthly' ? dateParams : ''
      
      const [metricsRes, ordersRes, productsRes, chartsRes, monthlyRes, complementsRes] = await Promise.all([
        fetch(addCountryParam(`/api/shopify?type=metrics${dateParams}`)),
        fetch(addCountryParam(`/api/shopify?type=orders&limit=100${dateParams}`)),
        fetch(addCountryParam(`/api/shopify?type=products&limit=10${productsFilter}&filterType=${productsFilterType}`)),
        fetch(addCountryParam(`/api/shopify?type=charts${dateParams}&days=${days}`)),
        fetch(addCountryParam(`/api/shopify?type=monthly-revenue&months=12`)),
        fetch(addCountryParam(`/api/shopify?type=complements&limit=10${complementsFilter}&filterType=${complementsFilterType}`)),
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

  // Cargar datos de pedidos online
  const loadDataOnline = async () => {
    try {
      setLoadingOnline(true)
      setError(null)

      // Construir parámetros de fecha para las peticiones - USA dateRangeOnline
      const dateParams = dateRangeOnline
        ? `&startDate=${dateRangeOnline.start}&endDate=${dateRangeOnline.end}`
        : ''

      // Calcular días para el gráfico
      let days = 30
      if (dateRangeOnline) {
        const start = parseISO(dateRangeOnline.start)
        const end = parseISO(dateRangeOnline.end)
        days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // Cargar métricas, pedidos, productos, gráficos, datos mensuales y complementos con onlineOnly=true
      const productsFilter = productsFilterType === 'monthly' ? dateParams : ''
      const complementsFilter = complementsFilterType === 'monthly' ? dateParams : ''
      const onlineParam = '&onlineOnly=true'
      
      const [metricsRes, ordersRes, productsRes, chartsRes, monthlyRes, complementsRes, timeAnalysisRes, segmentationRes] = await Promise.all([
        fetch(addCountryParam(`/api/shopify?type=metrics${dateParams}${onlineParam}`)),
        fetch(addCountryParam(`/api/shopify?type=orders&limit=100${dateParams}${onlineParam}`)),
        fetch(addCountryParam(`/api/shopify?type=products&limit=10${productsFilter}&filterType=${productsFilterType}${onlineParam}`)),
        fetch(addCountryParam(`/api/shopify?type=charts${dateParams}&days=${days}${onlineParam}`)),
        fetch(addCountryParam(`/api/shopify?type=monthly-revenue&months=12${onlineParam}`)),
        fetch(addCountryParam(`/api/shopify?type=complements&limit=10${complementsFilter}&filterType=${complementsFilterType}${onlineParam}`)),
        fetch(addCountryParam(`/api/shopify?type=online-time-analysis${dateParams}`)),
        fetch(addCountryParam(`/api/shopify?type=online-customer-segmentation${dateParams}`)),
      ])

      if (!metricsRes.ok || !ordersRes.ok || !productsRes.ok || !chartsRes.ok) {
        throw new Error('Error al cargar datos de pedidos online')
      }

      const [metricsData, ordersData, productsData, chartsData, monthlyData, complementsData, timeAnalysisDataRes, segmentationDataRes] = await Promise.all([
        metricsRes.json(),
        ordersRes.json(),
        productsRes.json(),
        chartsRes.json(),
        monthlyRes.ok ? monthlyRes.json() : Promise.resolve({ success: true, data: [] }),
        complementsRes.ok ? complementsRes.json() : Promise.resolve({ success: true, data: [] }),
        timeAnalysisRes.ok ? timeAnalysisRes.json() : Promise.resolve({ success: true, data: { hourly: [], daily: [] } }),
        segmentationRes.ok ? segmentationRes.json() : Promise.resolve({ success: true, data: null }),
      ])

      if (metricsData.success) {
        setMetricsOnline(metricsData.data)
      }
      if (ordersData.success) {
        setOrdersOnline(ordersData.data || [])
      }
      if (productsData.success) {
        setTopProductsOnline(productsData.data || [])
      }
      if (chartsData.success) {
        setSalesChartDataOnline(chartsData.data || [])
      }
      if (monthlyData.success) {
        setMonthlyRevenueDataOnline(monthlyData.data || [])
      }
      if (complementsData.success) {
        setTopComplementsOnline(complementsData.data || [])
      }
      if (timeAnalysisDataRes.success) {
        setTimeAnalysisData(timeAnalysisDataRes.data)
      }
      if (segmentationDataRes.success && segmentationDataRes.data) {
        setCustomerSegmentation(segmentationDataRes.data)
      }
    } catch (err: any) {
      console.error('Error loading online orders data:', err)
      setError(err.message || 'Error al cargar datos de pedidos online')
    } finally {
      setLoadingOnline(false)
    }
  }

  // Cargar datos de clientes
  const loadCustomersData = useCallback(async () => {
    try {
      setCustomersLoading(true)

      // Construir parámetros de fecha para las peticiones - USA dateRangeClientes
      const dateParams = dateRangeClientes
        ? `&startDate=${dateRangeClientes.start}&endDate=${dateRangeClientes.end}`
        : ''

      const emailParam = customerEmailFilter ? `&email=${encodeURIComponent(customerEmailFilter)}` : ''
      const offset = customerPage * customersPerPage
      const limit = customersPerPage

      // Cargar clientes paginados, métricas, top 10 del mes e histórico
      const [customersRes, metricsRes, top10MonthRes, top10HistoricalRes] = await Promise.all([
        fetch(addCountryParam(`/api/shopify?type=customers${dateParams}${emailParam}&limit=${limit}&offset=${offset}`)),
        fetch(addCountryParam(`/api/shopify?type=customer-metrics${dateParams}`)),
        fetch(addCountryParam(`/api/shopify?type=customers${dateParams}&limit=10&offset=0&periodBasedLTV=true`)), // Top 10 del período - CON LTV del período
        fetch(addCountryParam(`/api/shopify?type=customers&limit=10&offset=0`)), // Top 10 histórico (sin filtro de fechas)
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
  }, [dateRangeClientes, customerEmailFilter, customerPage])

  // ========== USE EFFECTS ==========
  
  // Cargar datos iniciales
  useEffect(() => {
    checkConnection()
  }, [])

  // useEffect para pestaña Pedidos
  useEffect(() => {
    if (dateRangePedidos || dateFilterTypePedidos !== 'custom') {
      loadData()
    }
  }, [dateRangePedidos, productsFilterType, complementsFilterType, isConnected])

  // useEffect para pestaña Pedidos Online
  useEffect(() => {
    if (dateRangeOnline || dateFilterTypeOnline !== 'custom') {
      loadDataOnline()
    }
  }, [dateRangeOnline, isConnected])

  // useEffect para pestaña Clientes
  useEffect(() => {
    if (isConnected) {
      loadCustomersData()
    }
  }, [isConnected, loadCustomersData])
  
  // useEffect para pestaña Ubicaciones (usa filtro de Pedidos)
  useEffect(() => {
    if (isConnected && dateRangePedidos) {
      loadLocationsData()
    }
  }, [dateRangePedidos, isConnected])

  // ========== OTRAS FUNCIONES ==========

  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)

      const response = await fetch(addCountryParam('/api/sync/shopify'), {
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

  const hasOrdersOnline = ordersOnline.length > 0
  const hasProductsOnline = topProductsOnline.length > 0
  const hasChartDataOnline = salesChartDataOnline.length > 0

  const filteredOrdersOnline = useMemo(() => {
    return ordersOnline.filter((order) => {
      const matchesSearch =
        order.customer_name?.toLowerCase().includes(searchTermOnline.toLowerCase()) ||
        order.order_number?.toLowerCase().includes(searchTermOnline.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(searchTermOnline.toLowerCase())
      const matchesStatus = statusFilterOnline === 'all' || order.financial_status === statusFilterOnline
      return matchesSearch && matchesStatus
    })
  }, [ordersOnline, searchTermOnline, statusFilterOnline])

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

  const topProductsChartOnline = topProductsOnline.map((p, index) => ({
    name: p.name,
    value: p.revenue,
    color: greenColors[index % greenColors.length],
  }))

  // Calcular valores derivados de la calculadora
  const calculatorResults = useMemo(() => {
    const { averageOrderValue, productCost, paymentCommissions, shippingCost, fulfillmentCost, returnRate, taxes } = calculatorValues
    
    // AOV sin IVA
    const aovWithoutTax = averageOrderValue / (1 + taxes / 100)
    
    // IVA a pagar
    const taxAmount = averageOrderValue - aovWithoutTax
    
    // Comisiones de pago en euros
    const paymentCommissionsAmount = averageOrderValue * (paymentCommissions / 100)
    
    // Costo de devoluciones (promedio)
    const returnCost = (productCost + shippingCost + fulfillmentCost) * (returnRate / 100)
    
    // Costos totales
    const totalCosts = productCost + paymentCommissionsAmount + shippingCost + fulfillmentCost + returnCost + taxAmount
    
    // Porcentaje de costo
    const costPercentage = (totalCosts / averageOrderValue) * 100
    
    // Beneficio bruto
    const grossProfit = averageOrderValue - totalCosts
    const grossProfitPercentage = (grossProfit / averageOrderValue) * 100
    
    // ROAS de equilibrio (churn rate)
    const breakEvenROAS = (100 / grossProfitPercentage) || 0
    
    // Por cada 1€ gastado en publicidad debe generar al menos
    const minRevenuePerEuro = breakEvenROAS / 100
    
    // CAC máximo (Customer Acquisition Cost máximo)
    const maxCAC = grossProfit
    
    // ROI (Return on Investment) - asumiendo un ROAS dado
    const currentROAS = metricsOnline?.roas || 0
    const roi = currentROAS > 0 ? ((currentROAS * grossProfitPercentage / 100) - 1) * 100 : 0
    
    return {
      aovWithoutTax,
      taxAmount,
      paymentCommissionsAmount,
      returnCost,
      totalCosts,
      costPercentage,
      grossProfit,
      grossProfitPercentage,
      breakEvenROAS,
      minRevenuePerEuro,
      maxCAC,
      roi,
    }
  }, [calculatorValues, metricsOnline?.roas])

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

  // Obtener nombre del país para mostrar en el header
  const countryName = country === 'MX' ? 'México' : 'España'
  
  if (loading) {
    return (
      <div className="flex flex-col">
        <Header
          title={`Ventas - ${countryName}`}
          subtitle={`Análisis de ventas e ingresos de Shopify ${countryName}`}
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
          title={`Ventas - ${countryName}`}
          subtitle={`Análisis de ventas e ingresos de Shopify ${countryName}`}
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
        title={`Ventas - ${countryName}`}
        subtitle={`Análisis de ventas e ingresos de Shopify ${countryName}`}
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
            <TabsTrigger value="pedidos-online">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Pedidos online
            </TabsTrigger>
            <TabsTrigger value="clientes">
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="ubicaciones">
              <MapPin className="h-4 w-4 mr-2" />
              Ubicaciones
            </TabsTrigger>
            <TabsTrigger value="objetivos">
              <Target className="h-4 w-4 mr-2" />
              Objetivos
            </TabsTrigger>
          </TabsList>

          {/* Pestaña: Pedidos */}
          <TabsContent value="pedidos" className="space-y-6 mt-6">
            {/* Filtro de Fechas para Pedidos */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant={dateFilterTypePedidos === 'today' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypePedidos('today')}
                    >
                      HOY
                    </Button>
                    <Button
                      variant={dateFilterTypePedidos === 'last7' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypePedidos('last7')}
                    >
                      7 días
                    </Button>
                    <Button
                      variant={dateFilterTypePedidos === 'last30' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypePedidos('last30')}
                    >
                      30 días
                    </Button>
                    <Button
                      variant={dateFilterTypePedidos === 'last90' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypePedidos('last90')}
                    >
                      90 días
                    </Button>
                    <Button
                      variant={dateFilterTypePedidos === 'thisMonth' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypePedidos('thisMonth')}
                    >
                      Este mes
                    </Button>
                    <Button
                      variant={dateFilterTypePedidos === 'lastMonth' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypePedidos('lastMonth')}
                    >
                      Mes anterior
                    </Button>
                    <Button
                      variant={dateFilterTypePedidos === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        const today = new Date()
                        const firstDay = startOfMonth(today)
                        setCustomStartDatePedidos(format(firstDay, 'yyyy-MM-dd'))
                        setCustomEndDatePedidos(format(today, 'yyyy-MM-dd'))
                        setDateFilterTypePedidos('custom')
                      }}
                    >
                      Personalizado
                    </Button>
                    {dateRangePedidos && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {periodLabelPedidos}
                      </span>
                    )}
                  </div>

                  {dateFilterTypePedidos === 'custom' && (
                    <div className="flex gap-3 items-end pt-2 border-t">
                      <div className="space-y-1">
                        <Label htmlFor="customStartDatePedidos" className="text-xs">Inicio</Label>
                        <Input
                          id="customStartDatePedidos"
                          type="date"
                          value={customStartDatePedidos}
                          onChange={(e) => setCustomStartDatePedidos(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="customEndDatePedidos" className="text-xs">Fin</Label>
                        <Input
                          id="customEndDatePedidos"
                          type="date"
                          value={customEndDatePedidos}
                          onChange={(e) => setCustomEndDatePedidos(e.target.value)}
                          max={format(new Date(), 'yyyy-MM-dd')}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <QuickStatCard
                title="Ingresos brutos totales"
                value={metrics?.totalRevenue ? formatCurrencyByCountry(metrics.totalRevenue, country) : '—'}
                emoji="💰"
                emojiBgColor="bg-emerald-100"
                previousPeriodValue={metrics?.previousRevenue || null}
                previousPeriodChange={metrics?.revenueChange}
                historicalValue={metrics?.historicalRevenue || null}
                historicalChange={metrics?.revenueChangeHistorical}
                formatValue={(v) => formatCurrencyByCountry(v, country)}
                conversionToEur={country === 'MX' && metrics?.totalRevenue ? convertMXNtoEUR(metrics.totalRevenue) : undefined}
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
                value={metrics?.averageOrderValue ? formatCurrencyByCountry(metrics.averageOrderValue, country) : '—'}
                emoji="📊"
                emojiBgColor="bg-purple-100"
                previousPeriodValue={metrics?.previousAOV || null}
                previousPeriodChange={metrics?.aovChange}
                historicalValue={metrics?.historicalAOV || null}
                historicalChange={metrics?.aovChangeHistorical}
                formatValue={(v) => formatCurrencyByCountry(v, country)}
                conversionToEur={country === 'MX' && metrics?.averageOrderValue ? convertMXNtoEUR(metrics.averageOrderValue) : undefined}
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
              title={`Ingresos Diarios - ${periodLabelPedidos}`}
              data={salesChartData.map(d => ({ date: d.date, value: d.value }))}
              height={280}
              formatValue={(v) => formatCurrencyByCountry(v, country)}
              color="#10b981"
              gradientColor="#059669"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Ingresos Diarios - {periodLabelPedidos}</CardTitle>
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
                  formatValue={(v) => formatCurrencyByCountry(v, country)}
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
                  formatValue={(v) => formatCurrencyByCountry(v, country)}
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
                  formatValue={(v) => formatCurrencyByCountry(v, country)}
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
                      {formatCurrencyByCountry(order.total_price, country)}
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

          {/* Pestaña: Pedidos online */}
          <TabsContent value="pedidos-online" className="space-y-6 mt-6">
            {/* Filtro de Fechas para Pedidos Online */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant={dateFilterTypeOnline === 'today' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeOnline('today')}
                    >
                      HOY
                    </Button>
                    <Button
                      variant={dateFilterTypeOnline === 'last7' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeOnline('last7')}
                    >
                      7 días
                    </Button>
                    <Button
                      variant={dateFilterTypeOnline === 'last30' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeOnline('last30')}
                    >
                      30 días
                    </Button>
                    <Button
                      variant={dateFilterTypeOnline === 'last90' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeOnline('last90')}
                    >
                      90 días
                    </Button>
                    <Button
                      variant={dateFilterTypeOnline === 'thisMonth' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeOnline('thisMonth')}
                    >
                      Este mes
                    </Button>
                    <Button
                      variant={dateFilterTypeOnline === 'lastMonth' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeOnline('lastMonth')}
                    >
                      Mes anterior
                    </Button>
                    <Button
                      variant={dateFilterTypeOnline === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        const today = new Date()
                        const firstDay = startOfMonth(today)
                        setCustomStartDateOnline(format(firstDay, 'yyyy-MM-dd'))
                        setCustomEndDateOnline(format(today, 'yyyy-MM-dd'))
                        setDateFilterTypeOnline('custom')
                      }}
                    >
                      Personalizado
                    </Button>
                    {dateRangeOnline && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {periodLabelOnline}
                      </span>
                    )}
                  </div>

                  {dateFilterTypeOnline === 'custom' && (
                    <div className="flex gap-3 items-end pt-2 border-t">
                      <div className="space-y-1">
                        <Label htmlFor="customStartDateOnline" className="text-xs">Inicio</Label>
                        <Input
                          id="customStartDateOnline"
                          type="date"
                          value={customStartDateOnline}
                          onChange={(e) => setCustomStartDateOnline(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="customEndDateOnline" className="text-xs">Fin</Label>
                        <Input
                          id="customEndDateOnline"
                          type="date"
                          value={customEndDateOnline}
                          onChange={(e) => setCustomEndDateOnline(e.target.value)}
                          max={format(new Date(), 'yyyy-MM-dd')}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <QuickStatCard
                title="Ingresos brutos totales"
                value={metricsOnline?.totalRevenue ? formatCurrency(metricsOnline.totalRevenue) : '—'}
                emoji="💰"
                emojiBgColor="bg-emerald-100"
                previousPeriodValue={metricsOnline?.previousRevenue || null}
                previousPeriodChange={metricsOnline?.revenueChange}
                historicalValue={metricsOnline?.historicalRevenue || null}
                historicalChange={metricsOnline?.revenueChangeHistorical}
                formatValue={(v) => formatCurrencyByCountry(v, country)}
              />
              <QuickStatCard
                title="Total Pedidos"
                value={metricsOnline?.totalOrders ? formatNumber(metricsOnline.totalOrders) : '—'}
                emoji="🛒"
                emojiBgColor="bg-blue-100"
                previousPeriodValue={metricsOnline?.previousOrdersCount || null}
                previousPeriodChange={metricsOnline?.ordersChange}
                historicalValue={metricsOnline?.historicalOrders || null}
                historicalChange={metricsOnline?.ordersChangeHistorical}
                formatValue={(v) => formatNumber(v)}
              />
              <QuickStatCard
                title="Valor Medio Pedido"
                value={metricsOnline?.averageOrderValue ? formatCurrencyByCountry(metricsOnline.averageOrderValue, country) : '—'}
                emoji="📊"
                emojiBgColor="bg-purple-100"
                previousPeriodValue={metricsOnline?.previousAOV || null}
                previousPeriodChange={metricsOnline?.aovChange}
                historicalValue={metricsOnline?.historicalAOV || null}
                historicalChange={metricsOnline?.aovChangeHistorical}
                formatValue={(v) => formatCurrencyByCountry(v, country)}
              />
              <QuickStatCard
                title="ROAS"
                value={metricsOnline?.roas ? metricsOnline.roas.toFixed(2) : '—'}
                emoji="📈"
                emojiBgColor="bg-rose-100"
                previousPeriodValue={metricsOnline?.previousROAS || null}
                previousPeriodChange={metricsOnline?.roasChange}
                historicalValue={null}
                historicalChange={undefined}
                formatValue={(v) => v.toFixed(2)}
              />
            </div>

        {/* Charts - Diario y Mensual Anual */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Gráfica de Evolución Diaria */}
          {hasChartDataOnline ? (
            <AreaChart
              title={`Ingresos Diarios - ${periodLabelOnline}`}
              data={salesChartDataOnline.map(d => ({ date: d.date, value: d.value }))}
              height={280}
              formatValue={(v) => formatCurrencyByCountry(v, country)}
              color="#10b981"
              gradientColor="#059669"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Ingresos Diarios - {periodLabelOnline}</CardTitle>
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
              {monthlyRevenueDataOnline.length > 0 ? (
                <BarChart
                  title=""
                  data={monthlyRevenueDataOnline.map(d => ({ name: d.date, value: d.value }))}
                  height={280}
                  formatValue={(v) => formatCurrencyByCountry(v, country)}
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
              {hasProductsOnline ? (
                <BarChart
                  title=""
                  data={topProductsChartOnline}
                  horizontal
                  height={280}
                  formatValue={(v) => formatCurrencyByCountry(v, country)}
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
              {topComplementsOnline.length > 0 ? (
                <BarChart
                  title=""
                  data={topComplementsOnline.map((c, index) => ({
                    name: c.name,
                    value: c.revenue,
                    color: greenColors[index % greenColors.length],
                  }))}
                  horizontal
                  height={280}
                  formatValue={(v) => formatCurrencyByCountry(v, country)}
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

        {/* Calculadora de Rentabilidad */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Calculadora de Rentabilidad</CardTitle>
              <CardDescription>
                Calcula los costes y beneficios de tus pedidos online. Edita los campos con fondo azul.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Campos Editables */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">COGs y Beneficios</h3>
                
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {/* Valor promedio del pedido */}
                  <div className="space-y-2">
                    <Label htmlFor="aov-online" className="text-sm">Valor promedio del pedido</Label>
                    <Input
                      id="aov-online"
                      type="number"
                      step="0.01"
                      value={calculatorValues.averageOrderValue}
                      onChange={(e) => setCalculatorValues(prev => ({ ...prev, averageOrderValue: parseFloat(e.target.value) || 0 }))}
                      className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                    <p className="text-xs text-muted-foreground">¿Cuál es el valor promedio del pedido en tu e-commerce?</p>
                  </div>

                  {/* Costo de productos */}
                  <div className="space-y-2">
                    <Label htmlFor="productCost-online" className="text-sm">Costo de los productos (promedio)</Label>
                    <Input
                      id="productCost-online"
                      type="number"
                      step="0.01"
                      value={calculatorValues.productCost}
                      onChange={(e) => setCalculatorValues(prev => ({ ...prev, productCost: parseFloat(e.target.value) || 0 }))}
                      className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                    <p className="text-xs text-muted-foreground">¿Cuánto gastas para producir un artículo?</p>
                  </div>

                  {/* Comisiones de pago */}
                  <div className="space-y-2">
                    <Label htmlFor="paymentCommissions-online" className="text-sm">Comisiones promedio de tarjeta/PayPal (%)</Label>
                    <Input
                      id="paymentCommissions-online"
                      type="number"
                      step="0.01"
                      value={calculatorValues.paymentCommissions}
                      onChange={(e) => setCalculatorValues(prev => ({ ...prev, paymentCommissions: parseFloat(e.target.value) || 0 }))}
                      className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                    <p className="text-xs text-muted-foreground">Shopify/Stripe/PayPal fees</p>
                  </div>

                  {/* Costo de envío */}
                  <div className="space-y-2">
                    <Label htmlFor="shippingCost-online" className="text-sm">Costo promedio de envío</Label>
                    <Input
                      id="shippingCost-online"
                      type="number"
                      step="0.01"
                      value={calculatorValues.shippingCost}
                      onChange={(e) => setCalculatorValues(prev => ({ ...prev, shippingCost: parseFloat(e.target.value) || 0 }))}
                      className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>

                  {/* Costo de fulfillment */}
                  <div className="space-y-2">
                    <Label htmlFor="fulfillmentCost-online" className="text-sm">Costo de fulfillment por unidad</Label>
                    <Input
                      id="fulfillmentCost-online"
                      type="number"
                      step="0.01"
                      value={calculatorValues.fulfillmentCost}
                      onChange={(e) => setCalculatorValues(prev => ({ ...prev, fulfillmentCost: parseFloat(e.target.value) || 0 }))}
                      className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                    <p className="text-xs text-muted-foreground">Picking, empaquetado y almacenamiento</p>
                  </div>

                  {/* Tasa de devoluciones */}
                  <div className="space-y-2">
                    <Label htmlFor="returnRate-online" className="text-sm">Tasa de devoluciones (%)</Label>
                    <Input
                      id="returnRate-online"
                      type="number"
                      step="0.01"
                      value={calculatorValues.returnRate}
                      onChange={(e) => setCalculatorValues(prev => ({ ...prev, returnRate: parseFloat(e.target.value) || 0 }))}
                      className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                    <p className="text-xs text-muted-foreground">¿Cuántas personas devuelven tus artículos?</p>
                  </div>

                  {/* Impuestos */}
                  <div className="space-y-2">
                    <Label htmlFor="taxes-online" className="text-sm">Impuestos y aranceles (%)</Label>
                    <Input
                      id="taxes-online"
                      type="number"
                      step="0.01"
                      value={calculatorValues.taxes}
                      onChange={(e) => setCalculatorValues(prev => ({ ...prev, taxes: parseFloat(e.target.value) || 0 }))}
                      className="bg-blue-50 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    />
                    <p className="text-xs text-muted-foreground">Principalmente IVA + fronteras internacionales</p>
                  </div>
                </div>

                {/* Valores Calculados */}
                <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Valor promedio del pedido actualizado (sin IVA)</Label>
                    <p className="text-lg font-semibold">{formatCurrencyByCountry(calculatorResults.aovWithoutTax, country)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">IVA + aranceles a pagar</Label>
                    <p className="text-lg font-semibold">{formatCurrencyByCountry(calculatorResults.taxAmount, country)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultados */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-blue-900 dark:text-blue-100">RESULTADOS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1 p-3 bg-white/50 dark:bg-gray-900/50 rounded-lg">
                  <Label className="text-xs text-muted-foreground">Costos totales de producto, fulfillment e impuestos</Label>
                  <p className="text-xl font-bold">{formatCurrencyByCountry(calculatorResults.totalCosts, country)}</p>
                </div>
                <div className="space-y-1 p-3 bg-white/50 dark:bg-gray-900/50 rounded-lg">
                  <Label className="text-xs text-muted-foreground">Porcentaje de costo</Label>
                  <p className="text-xl font-bold">{calculatorResults.costPercentage.toFixed(2)}%</p>
                </div>
                <div className="space-y-1 p-3 bg-white/50 dark:bg-gray-900/50 rounded-lg">
                  <Label className="text-xs text-muted-foreground">Beneficio bruto</Label>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{calculatorResults.grossProfitPercentage.toFixed(2)}%</p>
                  <p className="text-xs text-muted-foreground">Qué queda después de todos los gastos</p>
                </div>
              </div>

              <div className="pt-4 border-t border-blue-200 dark:border-blue-800">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1 p-3 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <Label className="text-xs text-muted-foreground">ROAS de equilibrio</Label>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{calculatorResults.breakEvenROAS.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">Retorno mínimo para alcanzar el punto de equilibrio</p>
                  </div>
                  <div className="space-y-1 p-3 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <Label className="text-xs text-muted-foreground">Por cada 1€ gastado en publicidad debes generar al menos</Label>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(calculatorResults.minRevenuePerEuro)}</p>
                    <p className="text-xs text-muted-foreground">Para alcanzar el punto de equilibrio</p>
                  </div>
                  <div className="space-y-1 p-3 bg-amber-100/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <Label className="text-xs text-muted-foreground">CAC máximo</Label>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{formatCurrencyByCountry(calculatorResults.maxCAC, country)}</p>
                    <p className="text-xs text-muted-foreground">Costo máximo de adquisición de cliente</p>
                  </div>
                  <div className="space-y-1 p-3 bg-blue-100/50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Label className="text-xs text-muted-foreground">ROI actual</Label>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                      {calculatorResults.roi > 0 ? '+' : ''}{calculatorResults.roi.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Basado en ROAS actual: {metricsOnline?.roas?.toFixed(2) || '—'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Análisis de Horarios y Días de la Semana */}
        {timeAnalysisData && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Análisis por Hora del Día */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Análisis por Hora del Día</CardTitle>
                <CardDescription>Distribución de pedidos e ingresos por hora (24h)</CardDescription>
              </CardHeader>
              <CardContent>
                {timeAnalysisData.hourly && timeAnalysisData.hourly.length > 0 ? (
                  <BarChart
                    title=""
                    data={timeAnalysisData.hourly.map(item => ({
                      name: item.hourLabel,
                      value: item.revenue,
                    }))}
                    height={300}
                    formatValue={(v) => formatCurrencyByCountry(v, country)}
                    color="#6366f1"
                    horizontal={false}
                    xAxisKey="name"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                    Sin datos de horarios
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Análisis por Día de la Semana */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Análisis por Día de la Semana</CardTitle>
                <CardDescription>Distribución de pedidos e ingresos por día</CardDescription>
              </CardHeader>
              <CardContent>
                {timeAnalysisData.daily && timeAnalysisData.daily.length > 0 ? (
                  <BarChart
                    title=""
                    data={timeAnalysisData.daily.map(item => ({
                      name: item.dayName,
                      value: item.revenue,
                    }))}
                    height={300}
                    formatValue={(v) => formatCurrencyByCountry(v, country)}
                    color="#8b5cf6"
                    horizontal={false}
                    xAxisKey="name"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                    Sin datos de días
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Segmentación de Clientes Online */}
        {customerSegmentation && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold">Segmentación de Clientes Online</CardTitle>
              <CardDescription>
                Análisis de nuevos clientes vs clientes recurrentes en pedidos online
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Label className="text-sm text-muted-foreground">Total Clientes Online</Label>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {formatNumber(customerSegmentation.totalCustomers)}
                  </p>
                  <p className="text-xs text-muted-foreground">Clientes con pedidos en el período</p>
                </div>

                <div className="space-y-2 p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <Label className="text-sm text-muted-foreground">Nuevos Clientes</Label>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {formatNumber(customerSegmentation.newCustomers)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {customerSegmentation.totalCustomers > 0
                      ? `${((customerSegmentation.newCustomers / customerSegmentation.totalCustomers) * 100).toFixed(1)}% del total`
                      : '0% del total'}
                  </p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrencyByCountry(customerSegmentation.newCustomersRevenue, country)} en ingresos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    AOV: {formatCurrency(customerSegmentation.averageNewCustomerValue)}
                  </p>
                </div>

                <div className="space-y-2 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <Label className="text-sm text-muted-foreground">Clientes Recurrentes</Label>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    {formatNumber(customerSegmentation.recurringCustomers)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {customerSegmentation.totalCustomers > 0
                      ? `${((customerSegmentation.recurringCustomers / customerSegmentation.totalCustomers) * 100).toFixed(1)}% del total`
                      : '0% del total'}
                  </p>
                  <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    {formatCurrencyByCountry(customerSegmentation.recurringCustomersRevenue, country)} en ingresos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    AOV: {formatCurrency(customerSegmentation.averageRecurringCustomerValue)}
                  </p>
                </div>

                <div className="space-y-2 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Label className="text-sm text-muted-foreground">Tasa de Retención</Label>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {customerSegmentation.retentionRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Clientes que vuelven a comprar</p>
                  <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-muted-foreground mb-1">LTV Promedio</p>
                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrencyByCountry(customerSegmentation.averageLTV, country)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Comparación Visual */}
              <div className="mt-6 pt-6 border-t">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Nuevos Clientes</Label>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrencyByCountry(customerSegmentation.newCustomersRevenue, country)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${customerSegmentation.newCustomersRevenue + customerSegmentation.recurringCustomersRevenue > 0
                            ? (customerSegmentation.newCustomersRevenue / (customerSegmentation.newCustomersRevenue + customerSegmentation.recurringCustomersRevenue)) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Clientes Recurrentes</Label>
                      <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                        {formatCurrencyByCountry(customerSegmentation.recurringCustomersRevenue, country)}
                      </span>
                    </div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all"
                        style={{
                          width: `${customerSegmentation.newCustomersRevenue + customerSegmentation.recurringCustomersRevenue > 0
                            ? (customerSegmentation.recurringCustomersRevenue / (customerSegmentation.newCustomersRevenue + customerSegmentation.recurringCustomersRevenue)) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                    value={searchTermOnline}
                    onChange={(e) => setSearchTermOnline(e.target.value)}
                    className="w-64 pl-9"
                  />
                </div>
                <Select value={statusFilterOnline} onValueChange={setStatusFilterOnline}>
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
                {filteredOrdersOnline.map((order) => (
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
                      {formatCurrencyByCountry(order.total_price, country)}
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
                {!hasOrdersOnline && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Sin pedidos online aún. Conecta Shopify para ver ventas reales.
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
            {/* Filtro de Fechas para Clientes */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Button
                      variant={dateFilterTypeClientes === 'today' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeClientes('today')}
                    >
                      HOY
                    </Button>
                    <Button
                      variant={dateFilterTypeClientes === 'last7' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeClientes('last7')}
                    >
                      7 días
                    </Button>
                    <Button
                      variant={dateFilterTypeClientes === 'last30' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeClientes('last30')}
                    >
                      30 días
                    </Button>
                    <Button
                      variant={dateFilterTypeClientes === 'last90' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeClientes('last90')}
                    >
                      90 días
                    </Button>
                    <Button
                      variant={dateFilterTypeClientes === 'thisMonth' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeClientes('thisMonth')}
                    >
                      Este mes
                    </Button>
                    <Button
                      variant={dateFilterTypeClientes === 'lastMonth' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => setDateFilterTypeClientes('lastMonth')}
                    >
                      Mes anterior
                    </Button>
                    <Button
                      variant={dateFilterTypeClientes === 'custom' ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        const today = new Date()
                        const firstDay = startOfMonth(today)
                        setCustomStartDateClientes(format(firstDay, 'yyyy-MM-dd'))
                        setCustomEndDateClientes(format(today, 'yyyy-MM-dd'))
                        setDateFilterTypeClientes('custom')
                      }}
                    >
                      Personalizado
                    </Button>
                    {dateRangeClientes && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {periodLabelClientes}
                      </span>
                    )}
                  </div>

                  {dateFilterTypeClientes === 'custom' && (
                    <div className="flex gap-3 items-end pt-2 border-t">
                      <div className="space-y-1">
                        <Label htmlFor="customStartDateClientes" className="text-xs">Inicio</Label>
                        <Input
                          id="customStartDateClientes"
                          type="date"
                          value={customStartDateClientes}
                          onChange={(e) => setCustomStartDateClientes(e.target.value)}
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="customEndDateClientes" className="text-xs">Fin</Label>
                        <Input
                          id="customEndDateClientes"
                          type="date"
                          value={customEndDateClientes}
                          onChange={(e) => setCustomEndDateClientes(e.target.value)}
                          max={format(new Date(), 'yyyy-MM-dd')}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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
                      formatValue={(v) => formatCurrencyByCountry(v, country)}
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
                            // Calcular cambio de posición: positivo = mejoró vs histórico, negativo = empeoró vs histórico
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
                                    <div className="flex items-center gap-2">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium">{customer.name || customer.email}</p>
                                          {positionChange !== null && positionChange !== 0 && (
                                            positionChange > 0 ? (
                                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                                            ) : (
                                              <TrendingDown className="h-4 w-4 text-red-600" />
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
                                  <span className="font-semibold">{formatCurrencyByCountry(customer.totalSpent, country)}</span>
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
                            // Calcular cambio de posición: positivo = mejoró en el periodo, negativo = empeoró
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
                                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                                            ) : (
                                              <TrendingDown className="h-4 w-4 text-red-600" />
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
                                  <span className="font-semibold">{formatCurrencyByCountry(customer.totalSpent, country)}</span>
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

          {/* Pestaña: Objetivos */}
          <TabsContent value="objetivos" className="mt-6">
            <ObjetivosTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

