'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { KPIHorizontalCard } from '@/components/dashboard/KPIHorizontalCard'
import { OccupationCard } from '@/components/dashboard/OccupationCard'
import { IntelligentAlerts } from '@/components/dashboard/IntelligentAlerts'
import { VIPCustomersTable } from '@/components/dashboard/VIPCustomersTable'
import { OrdersBreakdownSankey } from '@/components/dashboard/OrdersBreakdownSankey'
import { CTRByCitasChart } from '@/components/dashboard/CTRByCitasChart'
import { AreaChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'
import { DollarSign, Megaphone, Calendar, Target } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface DashboardData {
  kpis: {
    salesYesterday: number
    salesMonth: number
    adsSpendYesterday: number
    adsSpendMonth: number
    appointmentsYesterday: number
    appointmentsMonth: number
    roasAccumulated: number
  }
  dailyRevenue: Array<{ date: string; value: number }>
  salesVsInvestment: Array<{ date: string; ventas: number; inversion: number }>
  storeOccupation: Array<{
    storeName: string
    medicion: { booked: number; total: number; percentage: number }
    fitting: { booked: number; total: number; percentage: number }
  }>
  topVIPCustomers: Array<{
    email: string
    name: string
    city: string | null
    ltv: number
    orderCount: number
    hasNextAppointment: boolean
    nextAppointmentDate?: string
  }>
  alerts: Array<{ type: 'success' | 'warning' | 'info' | 'error'; message: string }>
  period: 'daily' | 'weekly' | 'monthly'
  ctrByCitasCampaigns: Array<{
    campaignName: string
    ctr: number
    impressions: number
    clicks: number
  }>
  ordersBreakdown: {
    totalOrders: number
    ordersOnline: number
    ordersFromMedicion: number
    ordersFromFitting: number
    ordersWithoutAppointment: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[Dashboard] Loading data')
      const response = await fetch(`/api/dashboard`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Dashboard] API Error:', response.status, errorText)
        throw new Error(`Error al cargar datos del dashboard (${response.status})`)
      }

      const result = await response.json()
      console.log('[Dashboard] API Response:', result)
      
      if (result.success) {
        console.log('[Dashboard] Store occupation data received:', {
          count: result.data?.storeOccupation?.length || 0,
          stores: result.data?.storeOccupation?.map((s: any) => s.storeName) || [],
        })
        setData(result.data)
      } else {
        throw new Error(result.error || 'Error desconocido')
      }
    } catch (err: any) {
      console.error('[Dashboard] Error loading dashboard data:', err)
      setError(err.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Dashboard" subtitle="Vista general del rendimiento" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Cargando datos del dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col">
        <Header title="Dashboard" subtitle="Vista general del rendimiento" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <p className="text-sm text-red-600 mb-2 font-semibold">Error al cargar datos</p>
            <p className="text-xs text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground mb-4">
              Abre la consola del navegador (F12) para ver más detalles del error.
            </p>
            <button
              onClick={() => loadData()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col">
        <Header title="Dashboard" subtitle="Vista general del rendimiento" />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">No hay datos disponibles</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" subtitle="Vista general del rendimiento" />

      <div className="flex-1 space-y-6 p-6">
        {/* Barra Horizontal Superior - 4 KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPIHorizontalCard
            title="Ventas Totales"
            valueYesterday={data.kpis.salesYesterday}
            valueMonth={data.kpis.salesMonth}
            icon={<span className="text-base">💰</span>}
            iconBgColor="bg-emerald-100"
            formatValue={formatCurrency}
          />
          <KPIHorizontalCard
            title="Coste en Ads"
            valueYesterday={data.kpis.adsSpendYesterday}
            valueMonth={data.kpis.adsSpendMonth}
            icon={<span className="text-base">🛒</span>}
            iconBgColor="bg-blue-100"
            formatValue={formatCurrency}
          />
          <KPIHorizontalCard
            title="Citas Agendadas"
            valueYesterday={data.kpis.appointmentsYesterday}
            valueMonth={data.kpis.appointmentsMonth}
            icon={<span className="text-base">📅</span>}
            iconBgColor="bg-amber-100"
            formatValue={formatNumber}
          />
          <KPIHorizontalCard
            title="ROAS Acumulado"
            valueYesterday={data.kpis.roasAccumulated}
            valueMonth={data.kpis.roasAccumulated}
            icon={<span className="text-base">📈</span>}
            iconBgColor="bg-rose-100"
            formatValue={(v) => v.toFixed(2)}
          />
        </div>

        {/* Gráficas Principales */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Gráfica de Ingresos Diarios del Mes en Curso */}
          {data.dailyRevenue.length > 0 ? (
            <AreaChart
              title={`Ingresos Diarios - ${format(new Date(), 'MMM yyyy', { locale: es })}`}
              data={data.dailyRevenue.map(d => ({ date: d.date, value: d.value }))}
              height={400}
              formatValue={(v) => formatCurrency(v)}
              color="#10b981"
              gradientColor="#059669"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">
                  Ingresos Diarios - {format(new Date(), 'MMM yyyy', { locale: es })}
                </CardTitle>
                <CardDescription>Sin datos. Sincroniza Shopify para ver el histórico.</CardDescription>
              </CardHeader>
            </Card>
          )}
          {/* Sankey de Desglose de Pedidos */}
          <OrdersBreakdownSankey
            totalOrders={data.ordersBreakdown.totalOrders}
            ordersOnline={data.ordersBreakdown.ordersOnline}
            ordersFromMedicion={data.ordersBreakdown.ordersFromMedicion}
            ordersFromFitting={data.ordersBreakdown.ordersFromFitting}
            ordersWithoutAppointment={data.ordersBreakdown.ordersWithoutAppointment}
          />
        </div>

        {/* KPI Cards de Ocupación por Tienda */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Ocupación por Tienda (Hoy)</h2>
          {data.storeOccupation.length > 0 ? (
            <div className="space-y-3">
              {/* Primera fila: Madrid, Sevilla, Málaga, Barcelona, Murcia */}
              <div className="grid grid-cols-5 gap-3">
                {data.storeOccupation.slice(0, 5).map((store) => {
                  const hasData = store.medicion.total > 0 || store.fitting.total > 0
                  return (
                    <OccupationCard
                      key={store.storeName}
                      storeName={store.storeName}
                      medicion={store.medicion}
                      fitting={store.fitting}
                      isClosed={!hasData}
                    />
                  )
                })}
              </div>
              {/* Segunda fila: CDMX, Bilbao, Zaragoza, Valencia, Próximamente */}
              <div className="grid grid-cols-5 gap-3">
                {data.storeOccupation.slice(5, 9).map((store) => {
                  const hasData = store.medicion.total > 0 || store.fitting.total > 0
                  return (
                    <OccupationCard
                      key={store.storeName}
                      storeName={store.storeName}
                      medicion={store.medicion}
                      fitting={store.fitting}
                      isClosed={!hasData}
                    />
                  )
                })}
                {/* Card "Próximamente" */}
                <OccupationCard
                  key="proximamente"
                  storeName="Próximamente"
                  medicion={{ booked: 0, total: 0, percentage: 0 }}
                  fitting={{ booked: 0, total: 0, percentage: 0 }}
                  isClosed={true}
                />
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Cargando datos de ocupación...
            </div>
          )}
        </div>

        {/* Gráfica de CTR - Ancho completo */}
        <CTRByCitasChart data={data.ctrByCitasCampaigns} />

        {/* Bloque Inferior: Alertas y Tabla VIP */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Alertas Inteligentes */}
          <div className="lg:col-span-1">
            <IntelligentAlerts alerts={data.alerts} />
          </div>

          {/* Tabla Top 10 Clientes VIP */}
          <div className="lg:col-span-2">
            <VIPCustomersTable customers={data.topVIPCustomers} />
          </div>
        </div>
      </div>
    </div>
  )
}
