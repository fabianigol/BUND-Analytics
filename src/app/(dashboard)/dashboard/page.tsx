'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { KPIHorizontalCard } from '@/components/dashboard/KPIHorizontalCard'
import { OccupationCard } from '@/components/dashboard/OccupationCard'
import { IntelligentAlerts } from '@/components/dashboard/IntelligentAlerts'
import { VIPCustomersTable } from '@/components/dashboard/VIPCustomersTable'
import { FunnelSankeyChart } from '@/components/dashboard/FunnelSankeyChart'
import { SalesVsInvestmentChart } from '@/components/dashboard/SalesVsInvestmentChart'
import { RefreshCw } from 'lucide-react'
import { DollarSign, Megaphone, Calendar, Target } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'

interface DashboardData {
  kpis: {
    salesToday: number
    salesMonth: number
    adsSpendToday: number
    adsSpendMonth: number
    appointmentsToday: number
    appointmentsMonth: number
    roasAccumulated: number
  }
  funnel: {
    nodes: Array<{ id: string; name: string; value: number; level: number; color?: string }>
    links: Array<{ source: string; target: string; value: number }>
  }
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
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  const loadData = async (selectedPeriod: 'daily' | 'weekly' | 'monthly' = period) => {
    try {
      setLoading(true)
      setError(null)

      console.log('[Dashboard] Loading data for period:', selectedPeriod)
      const response = await fetch(`/api/dashboard?period=${selectedPeriod}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Dashboard] API Error:', response.status, errorText)
        throw new Error(`Error al cargar datos del dashboard (${response.status})`)
      }

      const result = await response.json()
      console.log('[Dashboard] API Response:', result)
      
      if (result.success) {
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

  const handlePeriodChange = (newPeriod: 'daily' | 'weekly' | 'monthly') => {
    setPeriod(newPeriod)
    loadData(newPeriod)
  }

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
            valueYesterday={data.kpis.salesToday}
            valueMonth={data.kpis.salesMonth}
            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
            iconBgColor="bg-emerald-100"
            formatValue={formatCurrency}
          />
          <KPIHorizontalCard
            title="Coste en Ads"
            valueYesterday={data.kpis.adsSpendToday}
            valueMonth={data.kpis.adsSpendMonth}
            icon={<Megaphone className="h-5 w-5 text-blue-600" />}
            iconBgColor="bg-blue-100"
            formatValue={formatCurrency}
          />
          <KPIHorizontalCard
            title="Citas Agendadas"
            valueYesterday={data.kpis.appointmentsToday}
            valueMonth={data.kpis.appointmentsMonth}
            icon={<Calendar className="h-5 w-5 text-amber-600" />}
            iconBgColor="bg-amber-100"
            formatValue={formatNumber}
          />
          <KPIHorizontalCard
            title="ROAS Acumulado"
            valueYesterday={data.kpis.roasAccumulated}
            valueMonth={data.kpis.roasAccumulated}
            icon={<Target className="h-5 w-5 text-purple-600" />}
            iconBgColor="bg-purple-100"
            formatValue={(v) => `${v.toFixed(2)}x`}
          />
        </div>

        {/* Gráficas Principales */}
        <div className="grid gap-6 lg:grid-cols-2">
          <FunnelSankeyChart
            nodes={data.funnel.nodes}
            links={data.funnel.links}
            currentPeriod={period}
            onPeriodChange={handlePeriodChange}
          />
          <SalesVsInvestmentChart data={data.salesVsInvestment} />
        </div>

        {/* KPI Cards de Ocupación por Tienda */}
        {data.storeOccupation.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Ocupación por Tienda (Hoy)</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.storeOccupation.map((store) => (
                <OccupationCard
                  key={store.storeName}
                  storeName={store.storeName}
                  medicion={store.medicion}
                  fitting={store.fitting}
                />
              ))}
            </div>
          </div>
        )}

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
