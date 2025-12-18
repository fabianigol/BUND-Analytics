'use client'

import { useMemo, useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart, LineChart, PieChart, FunnelChart } from '@/components/dashboard/Charts'
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
  Megaphone,
  DollarSign,
  Target,
  MousePointer,
  Eye,
  TrendingUp,
  Search,
  Filter,
  Download,
  Play,
  Pause,
  RefreshCw,
  Loader2,
  Calendar,
  ShoppingBag,
  XCircle,
} from 'lucide-react'
import { MetaCampaign } from '@/types'
import { formatCurrency, formatNumber, formatCompactNumber, formatPercentage } from '@/lib/utils/format'
import { createClient } from '@/lib/supabase/client'

type DateFilterType = 'custom' | 'month' | 'year' | 'all'

// Helper function to categorize Meta action types
function categorizeActionType(actionType: string): 'citas' | 'leads' | 'ventas' | null {
  const normalized = actionType.toLowerCase()
  const original = actionType // Mantener original para comparaciones exactas
  
  // Citas: "CITA CONFIRMADA" (exacto o variaciones)
  if (
    original === 'CITA CONFIRMADA' ||
    normalized.includes('cita_confirmada') ||
    normalized.includes('cita confirmada') ||
    normalized.includes('onsite_conversion.cita_confirmada') ||
    normalized.includes('offsite_conversion.cita_confirmada')
  ) {
    return 'citas'
  }
  
  // Ventas: "Website purchases" (exacto o variaciones)
  if (
    original === 'Website purchases' ||
    original === 'Website purchase' ||
    normalized.includes('website_purchase') ||
    normalized.includes('website purchase') ||
    normalized.includes('onsite_conversion.purchase') ||
    normalized.includes('offsite_conversion.purchase') ||
    (normalized.includes('purchase') && normalized.includes('website'))
  ) {
    return 'ventas'
  }
  
  // Leads: "Form1_Short_Completed", "TypeformSubmit", "Leads (Form)" (exactos o variaciones)
  if (
    original === 'Form1_Short_Completed' ||
    original === 'TypeformSubmit' ||
    original === 'Leads (Form)' ||
    normalized.includes('form1_short_completed') ||
    normalized.includes('form1_short') ||
    normalized.includes('typeformsubmit') ||
    normalized.includes('typeform_submit') ||
    normalized.includes('leads (form)') ||
    normalized.includes('leads_form') ||
    // También incluir otros formatos comunes de leads
    (normalized.includes('lead') && (normalized.includes('form') || normalized.includes('submit'))) ||
    (normalized.includes('form') && (normalized.includes('complete') || normalized.includes('submit')))
  ) {
    return 'leads'
  }
  
  // Fallback: intentar reconocer por palabras clave si no coincide exactamente
  if (
    normalized.includes('cita') ||
    normalized.includes('confirmada') ||
    normalized.includes('appointment')
  ) {
    return 'citas'
  }
  
  if (
    normalized.includes('purchase') ||
    normalized.includes('venta') ||
    normalized.includes('sale') ||
    normalized.includes('checkout')
  ) {
    return 'ventas'
  }
  
  if (
    normalized.includes('lead') ||
    normalized.includes('form') ||
    normalized.includes('typeform') ||
    normalized.includes('submit')
  ) {
    return 'leads'
  }
  
  return null
}

export default function AdsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' mostrará solo activas por defecto
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [selectedCampaignsForFunnel, setSelectedCampaignsForFunnel] = useState<string[]>([])

  useEffect(() => {
    loadCampaigns()
    checkIntegrationStatus()
  }, [])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('*')
        .order('date', { ascending: false })

      if (error) {
        console.error('Error loading campaigns:', error)
        return
      }

      // Asegurar que actions sea un array y parsear correctamente desde JSONB
      const campaignsWithActions = (data || []).map((campaign: any): MetaCampaign => {
        let actions: Array<{ action_type: string; value: string }> = []
        
        try {
          if (campaign.actions) {
            if (Array.isArray(campaign.actions)) {
              actions = campaign.actions
            } else if (typeof campaign.actions === 'string') {
              actions = JSON.parse(campaign.actions)
            } else if (typeof campaign.actions === 'object') {
              // Si es un objeto, intentar convertirlo a array
              actions = Object.entries(campaign.actions).map(([key, value]) => ({
                action_type: key,
                value: String(value),
              }))
            }
          }
        } catch (error) {
          console.warn(`[Ads Page] Error parsing actions for campaign ${campaign.campaign_id}:`, error)
          actions = []
        }
        
        return {
          ...campaign,
          actions,
          reach: campaign.reach || 0,
          link_clicks: campaign.link_clicks || 0,
          cost_per_result: campaign.cost_per_result || 0,
        } as MetaCampaign
      })

      setCampaigns(campaignsWithActions)
    } catch (error) {
      console.error('Error loading campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkIntegrationStatus = async () => {
    try {
      const response = await fetch('/api/integrations/meta')
      if (!response.ok) {
        console.error('Error checking integration status:', response.status, response.statusText)
        return
      }
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json()
        setLastSync(data.lastSync || null)
      }
    } catch (error) {
      console.error('Error checking integration status:', error)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      
      // Preparar body con filtros de fecha si están configurados
      const body: { startDate?: string; endDate?: string } = {}
      const dateRange = getDateRange
      if (dateRange && dateRange.start && dateRange.end) {
        body.startDate = dateRange.start
        body.endDate = dateRange.end
        console.log(`[Ads Page] Syncing with date range: ${body.startDate} to ${body.endDate}`)
      }
      
      const response = await fetch('/api/sync/meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        // Verificar si la respuesta es JSON antes de parsear
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          const errorMsg = data.details 
            ? `${data.error}\n\nDetalles: ${data.details}` 
            : data.error || 'Error al sincronizar'
          throw new Error(errorMsg)
        } else {
          // Si no es JSON, leer como texto
          const text = await response.text()
          throw new Error(`Error del servidor (${response.status}): ${text.substring(0, 200)}`)
        }
      }

      // Verificar que la respuesta sea JSON antes de parsear
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(`Respuesta inesperada del servidor: ${text.substring(0, 200)}`)
      }

      const data = await response.json()

      // Recargar campañas
      await loadCampaigns()
      await checkIntegrationStatus()
      
      // Mostrar mensaje detallado
      let message = `Sincronización completada:\n\n`
      message += `✅ ${data.records_synced} campañas sincronizadas`
      if (data.total_campaigns) {
        message += ` de ${data.total_campaigns} totales`
        if (data.pages_processed) {
          message += ` (${data.pages_processed} páginas procesadas)`
        }
      }
      if (data.failed_count > 0) {
        message += `\n⚠️ ${data.failed_count} campañas fallaron`
      }
      if (data.skipped_count > 0) {
        message += `\n⏭️ ${data.skipped_count} campañas sin datos`
      }
      
      alert(message)
    } catch (error) {
      console.error('Error syncing:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      alert(`Error al sincronizar:\n\n${errorMessage}`)
    } finally {
      setSyncing(false)
    }
  }

  // Calcular fechas para filtros
  const getDateRange = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    switch (dateFilterType) {
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        start.setHours(0, 0, 0, 0)
        return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] }
      }
      case 'year': {
        const start = new Date(today.getFullYear(), 0, 1)
        start.setHours(0, 0, 0, 0)
        return { start: start.toISOString().split('T')[0], end: today.toISOString().split('T')[0] }
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

  // Agrupar y filtrar campañas
  const filteredCampaigns = useMemo(() => {
    // Primero filtrar por búsqueda y estado
    let filtered = campaigns.filter((campaign) => {
      const matchesSearch = campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase())
      // Por defecto mostrar solo activas, pero respetar el filtro del usuario
      const matchesStatus = statusFilter === 'all' 
        ? campaign.status === 'ACTIVE' // Si es 'all', mostrar solo activas
        : campaign.status === statusFilter
      
      return matchesSearch && matchesStatus
    })

    // Si hay filtro de fecha, filtrar por fecha
    if (getDateRange) {
      filtered = filtered.filter((campaign) => {
        const campaignDate = new Date(campaign.date)
        const start = new Date(getDateRange.start)
        start.setHours(0, 0, 0, 0)
        const end = new Date(getDateRange.end)
        end.setHours(23, 59, 59, 999)
        return campaignDate >= start && campaignDate <= end
      })
    }

    // Filtrar solo campañas con gasto > 0€
    filtered = filtered.filter((campaign) => campaign.spend > 0)

    // Agrupar por campaign_id y sumar métricas si hay múltiples entradas
    const grouped = new Map<string, MetaCampaign>()
    
    filtered.forEach((campaign) => {
      const existing = grouped.get(campaign.campaign_id)
      
      if (existing) {
        // Sumar métricas
        existing.spend += campaign.spend
        existing.impressions += campaign.impressions
        existing.clicks += campaign.clicks
        existing.conversions += campaign.conversions
        existing.reach = Math.max(existing.reach || 0, campaign.reach || 0) // Reach es único, tomar el máximo
        existing.link_clicks = (existing.link_clicks || 0) + (campaign.link_clicks || 0)
        
        // Combinar actions
        const existingActions = (existing.actions as Array<{ action_type: string; value: string }>) || []
        const campaignActions = (campaign.actions as Array<{ action_type: string; value: string }>) || []
        const actionsMap = new Map<string, number>()
        
        // Sumar acciones existentes
        existingActions.forEach((action) => {
          const value = parseInt(action.value) || 0
          actionsMap.set(action.action_type, (actionsMap.get(action.action_type) || 0) + value)
        })
        
        // Sumar acciones de la campaña actual
        campaignActions.forEach((action) => {
          const value = parseInt(action.value) || 0
          actionsMap.set(action.action_type, (actionsMap.get(action.action_type) || 0) + value)
        })
        
        // Convertir de vuelta a array
        existing.actions = Array.from(actionsMap.entries()).map(([action_type, value]) => ({
          action_type,
          value: value.toString(),
        }))
        
        // Recalcular métricas derivadas
        if (existing.impressions > 0) {
          existing.ctr = (existing.clicks / existing.impressions) * 100
        }
        if (existing.clicks > 0) {
          existing.cpc = existing.spend / existing.clicks
        }
        if (existing.impressions > 0) {
          existing.cpm = (existing.spend / existing.impressions) * 1000
        }
        if (existing.conversions > 0 && existing.spend > 0) {
          existing.cost_per_result = existing.spend / existing.conversions
          existing.roas = (existing.conversions * 50) / existing.spend
        }
      } else {
        // Primera vez que vemos esta campaña, agregarla
        grouped.set(campaign.campaign_id, { ...campaign })
      }
    })
    
    return Array.from(grouped.values())
  }, [campaigns, searchTerm, statusFilter, getDateRange])

  // Calcular métricas basadas en campañas filtradas
  const totalSpend = filteredCampaigns.reduce((sum, c) => sum + c.spend, 0)
  const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + c.impressions, 0)
  const totalClicks = filteredCampaigns.reduce((sum, c) => sum + c.clicks, 0)
  const totalReach = filteredCampaigns.reduce((sum, c) => sum + (c.reach || 0), 0)
  const totalLinkClicks = filteredCampaigns.reduce((sum, c) => sum + (c.link_clicks || 0), 0)
  const avgRoas = filteredCampaigns.length ? filteredCampaigns.reduce((sum, c) => sum + c.roas, 0) / filteredCampaigns.length : 0
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const hasCampaigns = filteredCampaigns.length > 0

  // Calcular conversiones por tipo basado en el nombre de la campaña
  const conversionsByType = useMemo(() => {
    const types: Record<string, number> = {
      citas: 0,
      leads: 0,
      ventas: 0,
    }

    filteredCampaigns.forEach((campaign) => {
      const campaignNameUpper = campaign.campaign_name.toUpperCase()
      
      // Citas: campañas con "Thebundclub" en el nombre
      if (campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('THE BUNDCLUB')) {
        types.citas += campaign.conversions || 0
      }
      // Leads: campañas con "Leads" en el nombre
      else if (campaignNameUpper.includes('LEADS')) {
        types.leads += campaign.conversions || 0
      }
      // Ventas: campañas con "ecom" en el nombre
      else if (campaignNameUpper.includes('ECOM')) {
        types.ventas += campaign.conversions || 0
      }
    })

    return types
  }, [filteredCampaigns])

  // Track if we've logged action types
  const processedCount = useMemo(() => {
    return filteredCampaigns.reduce((count, campaign) => {
      const actions = (campaign.actions as Array<{ action_type: string; value: string }>) || []
      return count + (actions.length > 0 ? 1 : 0)
    }, 0)
  }, [filteredCampaigns])

  const totalConversions = conversionsByType.citas + conversionsByType.leads + conversionsByType.ventas

  // Evolución mensual del Cost per Result para campañas TheBundClub (una línea por campaña)
  const theBundClubMonthlyData = useMemo(() => {
    // Filtrar campañas que contengan "TheBundClub" en el nombre (case insensitive)
    // Usar todas las campañas, no solo las filtradas, para mostrar todo el año
    const theBundClubCampaigns = campaigns.filter((c) => {
      const nameUpper = c.campaign_name.toUpperCase()
      return nameUpper.includes('THEBUNDCLUB') || nameUpper.includes('THE BUNDCLUB')
    })

    // Obtener lista única de campañas
    const uniqueCampaigns = Array.from(
      new Map(theBundClubCampaigns.map(c => [c.campaign_id, c])).values()
    )

    // Agrupar por campaña y mes
    // Estructura: Map<campaign_id, Map<monthKey, { spend, conversions }>>
    const campaignMonthlyData = new Map<string, Map<string, { spend: number; conversions: number }>>()
    
    theBundClubCampaigns.forEach((campaign) => {
      const date = new Date(campaign.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!campaignMonthlyData.has(campaign.campaign_id)) {
        campaignMonthlyData.set(campaign.campaign_id, new Map())
      }
      
      const campaignData = campaignMonthlyData.get(campaign.campaign_id)!
      if (!campaignData.has(monthKey)) {
        campaignData.set(monthKey, { spend: 0, conversions: 0 })
      }
      
      const monthData = campaignData.get(monthKey)!
      monthData.spend += campaign.spend || 0
      monthData.conversions += campaign.conversions || 0
    })

    // Generar todos los meses del año actual
    const currentYear = new Date().getFullYear()
    const allMonths: string[] = []
    for (let month = 1; month <= 12; month++) {
      const monthKey = `${currentYear}-${String(month).padStart(2, '0')}`
      allMonths.push(monthKey)
    }

    // Crear estructura de datos para el gráfico
    // Cada objeto representa un mes y tiene un campo por cada campaña
    const chartData = allMonths.map((monthKey) => {
      const date = new Date(monthKey + '-01')
      const monthLabel = date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      
      const monthData: Record<string, string | number> = {
        month: monthLabel,
        monthKey,
      }
      
      // Para cada campaña, calcular su Cost per Result en este mes
      uniqueCampaigns.forEach((campaign) => {
        const campaignData = campaignMonthlyData.get(campaign.campaign_id)
        const monthDataForCampaign = campaignData?.get(monthKey) || { spend: 0, conversions: 0 }
        
        let costPerResult = 0
        if (monthDataForCampaign.conversions > 0 && monthDataForCampaign.spend > 0) {
          costPerResult = monthDataForCampaign.spend / monthDataForCampaign.conversions
        }
        
        // Usar el campaign_id como clave (sanitizado para ser válido como key de objeto)
        const safeKey = `campaign_${campaign.campaign_id.replace(/[^a-zA-Z0-9]/g, '_')}`
        monthData[safeKey] = costPerResult
      })
      
      return monthData
    })

    // Crear array de líneas para el LineChart
    const lines = uniqueCampaigns.map((campaign, index) => {
      // Paleta de colores burdeos
      const colors = [
        '#7C2D12', '#991B1B', '#B91C1C', '#DC2626', '#EF4444',
        '#F87171', '#722F37', '#5C2E37', '#4A1F1F', '#6B1F1F',
      ]
      const safeKey = `campaign_${campaign.campaign_id.replace(/[^a-zA-Z0-9]/g, '_')}`
      
      return {
        dataKey: safeKey,
        name: campaign.campaign_name.length > 30 
          ? `${campaign.campaign_name.substring(0, 30)}...` 
          : campaign.campaign_name,
        color: colors[index % colors.length],
        strokeWidth: 2,
      }
    })

    return {
      data: chartData,
      lines,
      campaigns: uniqueCampaigns,
    }
  }, [campaigns])

  // Campañas activas ordenadas por presupuesto (mayor a menor)
  // Usar todas las campañas, no solo las filtradas, para la distribución del presupuesto
  const activeCampaignsBySpend = useMemo(() => {
    return campaigns
      .filter((c) => c.status === 'ACTIVE')
      .sort((a, b) => b.spend - a.spend)
  }, [campaigns])
  
  // También crear una versión que muestre las campañas con más gasto independientemente del estado
  const topCampaignsBySpend = useMemo(() => {
    return campaigns
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 20) // Top 20 campañas por gasto
  }, [campaigns])

  // Calcular métricas de cambio (comparar con período anterior)
  const spendChange = useMemo(() => {
    if (getDateRange) {
      // Calcular período anterior de la misma duración
      const start = new Date(getDateRange.start)
      const end = new Date(getDateRange.end)
      const duration = end.getTime() - start.getTime()
      
      const prevEnd = new Date(start)
      prevEnd.setTime(prevEnd.getTime() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setTime(prevStart.getTime() - duration)
      
      const currentSpend = filteredCampaigns.reduce((sum, c) => sum + c.spend, 0)
      const previousCampaigns = campaigns.filter((c) => {
        const campaignDate = new Date(c.date)
        return campaignDate >= prevStart && campaignDate <= prevEnd
      })
      const previousSpend = previousCampaigns.reduce((sum, c) => sum + c.spend, 0)
      
      return previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0
    }
    return 0
  }, [filteredCampaigns, campaigns, getDateRange])

  const impressionsChange = useMemo(() => {
    if (getDateRange) {
      const start = new Date(getDateRange.start)
      const end = new Date(getDateRange.end)
      const duration = end.getTime() - start.getTime()
      
      const prevEnd = new Date(start)
      prevEnd.setTime(prevEnd.getTime() - 1)
      const prevStart = new Date(prevEnd)
      prevStart.setTime(prevStart.getTime() - duration)
      
      const currentImpressions = filteredCampaigns.reduce((sum, c) => sum + c.impressions, 0)
      const previousCampaigns = campaigns.filter((c) => {
        const campaignDate = new Date(c.date)
        return campaignDate >= prevStart && campaignDate <= prevEnd
      })
      const previousImpressions = previousCampaigns.reduce((sum, c) => sum + c.impressions, 0)
      
      return previousImpressions > 0 ? ((currentImpressions - previousImpressions) / previousImpressions) * 100 : 0
    }
    return 0
  }, [filteredCampaigns, campaigns, getDateRange])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <Play className="mr-1 h-3 w-3" /> Activa
          </Badge>
        )
      case 'PAUSED':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            <Pause className="mr-1 h-3 w-3" /> Pausada
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header
          title="Paid Media"
          subtitle="Rendimiento de campañas de Meta Ads"
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Paid Media"
        subtitle="Rendimiento de campañas de Meta Ads"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Sync Button y Filtros de Fecha */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {lastSync && (
              <p className="text-sm text-muted-foreground">
                Última sincronización: {new Date(lastSync).toLocaleString('es-ES')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={dateFilterType} onValueChange={(value) => setDateFilterType(value as DateFilterType)}>
              <SelectTrigger className="w-48">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el período</SelectItem>
                <SelectItem value="month">Mes hasta la fecha</SelectItem>
                <SelectItem value="year">Año hasta la fecha</SelectItem>
                <SelectItem value="custom">Intervalo personalizado</SelectItem>
              </SelectContent>
            </Select>
            {dateFilterType === 'custom' && (
              <>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Desde"
                  className="w-40"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Hasta"
                  className="w-40"
                />
              </>
            )}
            <Button onClick={handleSync} disabled={syncing} variant="outline">
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Gasto Total"
            value={totalSpend ? formatCurrency(totalSpend) : '—'}
            change={spendChange}
            icon={DollarSign}
            iconColor="bg-rose-100 text-rose-600"
          />
          <MetricCard
            title="ROAS Promedio"
            value={avgRoas ? `${avgRoas.toFixed(2)}x` : '—'}
            change={0}
            icon={Target}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Conversiones"
            value={totalConversions > 0 ? formatNumber(totalConversions) : '—'}
            change={0}
            icon={TrendingUp}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Impresiones"
            value={totalImpressions ? formatCompactNumber(totalImpressions) : '—'}
            change={impressionsChange}
            icon={Eye}
            iconColor="bg-purple-100 text-purple-600"
          />
        </div>

        {/* Quick Stats de Conversiones por Tipo */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-blue-100 p-2">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(conversionsByType.citas)}</p>
                <p className="text-sm text-muted-foreground">Citas Confirmadas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-amber-100 p-2">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(conversionsByType.leads)}</p>
                <p className="text-sm text-muted-foreground">Leads</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-lg bg-emerald-100 p-2">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(conversionsByType.ventas)}</p>
                <p className="text-sm text-muted-foreground">Ventas Online</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
          {/* Columna izquierda: Embudo de Conversión (altura completa) */}
          <Card className="flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div>
                  <CardTitle className="text-base font-medium">Embudo de Conversión</CardTitle>
                  <CardDescription>
                    Comparación de flujo de impresiones a resultados por campaña
                  </CardDescription>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selecciona campañas para comparar:</label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (!selectedCampaignsForFunnel.includes(value)) {
                        setSelectedCampaignsForFunnel([...selectedCampaignsForFunnel, value])
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={`${selectedCampaignsForFunnel.length > 0 ? `${selectedCampaignsForFunnel.length} campaña(s) seleccionada(s)` : 'Selecciona campañas'}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCampaigns
                        .filter(c => c && c.spend > 0 && !selectedCampaignsForFunnel.includes(c.id))
                        .sort((a, b) => a.campaign_name.localeCompare(b.campaign_name))
                        .map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.campaign_name}
                          </SelectItem>
                        ))}
                      {filteredCampaigns.filter(c => c && c.spend > 0 && !selectedCampaignsForFunnel.includes(c.id)).length === 0 && (
                        <SelectItem value="" disabled>Todas las campañas están seleccionadas</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedCampaignsForFunnel.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedCampaignsForFunnel.map((campaignId) => {
                        const campaign = filteredCampaigns.find(c => c.id === campaignId)
                        if (!campaign) return null
                        return (
                          <Badge
                            key={campaignId}
                            variant="secondary"
                            className="flex items-center gap-1 pr-1"
                          >
                            <span className="text-xs">{campaign.campaign_name.length > 25 ? `${campaign.campaign_name.substring(0, 25)}...` : campaign.campaign_name}</span>
                            <button
                              onClick={() => {
                                setSelectedCampaignsForFunnel(selectedCampaignsForFunnel.filter(id => id !== campaignId))
                              }}
                              className="ml-1 rounded-full hover:bg-muted p-0.5"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          </Badge>
                        )
                      })}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCampaignsForFunnel([])}
                        className="h-6 text-xs"
                      >
                        Limpiar todo
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {selectedCampaignsForFunnel.length > 0 ? (
                (() => {
                  const selectedCampaigns = filteredCampaigns.filter(c => 
                    selectedCampaignsForFunnel.includes(c.id)
                  )

                  if (selectedCampaigns.length === 0) {
                    return (
                      <div className="flex h-[400px] items-center justify-center">
                        <p className="text-sm text-muted-foreground">Campañas no encontradas</p>
                      </div>
                    )
                  }

                  // Paleta de colores basada en la imagen proporcionada
                  // Colores más vibrantes y diferenciados para mejor visualización
                  // Paleta de colores burdeos para cada campaña
                  // Cada campaña tiene un gradiente de burdeos a través de las etapas
                  const campaignColorPalettes = [
                    // Paleta 1: Burdeos oscuro a claro
                    ['#7C2D12', '#991B1B', '#B91C1C', '#DC2626'],
                    // Paleta 2: Burdeos medio oscuro
                    ['#991B1B', '#B91C1C', '#DC2626', '#EF4444'],
                    // Paleta 3: Burdeos rojizo
                    ['#B91C1C', '#DC2626', '#EF4444', '#F87171'],
                    // Paleta 4: Burdeos vino
                    ['#6B1F1F', '#8B2A2A', '#A83A3A', '#C94A4A'],
                    // Paleta 5: Burdeos granate
                    ['#722F37', '#8B3A42', '#A44A52', '#BD5A62'],
                    // Paleta 6: Burdeos terroso
                    ['#5C2E37', '#6D3E47', '#7E4E57', '#8F5E67'],
                    // Paleta 7: Burdeos profundo
                    ['#4A1F1F', '#5A2F2F', '#6A3F3F', '#7A4F4F'],
                  ]

                  // Preparar datos para FunnelGraph.js con formato 2D para comparación
                  // Para múltiples campañas, necesitamos un array de colores por etapa
                  const numStages = 4
                  const colors: string[][] = []
                  
                  // Para cada etapa, crear un array de colores (uno por campaña)
                  for (let stage = 0; stage < numStages; stage++) {
                    const stageColors: string[] = []
                    selectedCampaigns.forEach((_, campaignIndex) => {
                      const palette = campaignColorPalettes[campaignIndex % campaignColorPalettes.length]
                      stageColors.push(palette[stage % palette.length])
                    })
                    colors.push(stageColors)
                  }

                  const funnelData = {
                    labels: ['Impresiones', 'Alcance (Reach)', 'Link Clicks', 'Results'],
                    subLabels: selectedCampaigns.map(c => c.campaign_name.length > 20 
                      ? `${c.campaign_name.substring(0, 20)}...` 
                      : c.campaign_name),
                    colors: colors,
                    values: [
                      // Impresiones (valores de cada campaña)
                      selectedCampaigns.map(c => c.impressions || 0),
                      // Alcance (Reach) (valores de cada campaña)
                      selectedCampaigns.map(c => c.reach || 0),
                      // Link Clicks (valores de cada campaña)
                      selectedCampaigns.map(c => c.link_clicks || c.clicks || 0),
                      // Results (valores de cada campaña)
                      selectedCampaigns.map(c => c.conversions || 0),
                    ],
                  }

                  return (
                    <FunnelChart
                      title=""
                      data={funnelData}
                      direction="horizontal"
                      displayPercent={true}
                      height={600}
                      campaignNames={selectedCampaigns.map(c => c.campaign_name)}
                    />
                  )
                })()
              ) : (
                <div className="flex h-[400px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">Selecciona al menos una campaña para ver el embudo comparativo</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Columna derecha: Presupuesto y Cost per Result */}
          <div className="flex flex-col gap-6">
            {/* Presupuesto (mitad superior) */}
            <Card className="flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Distribución del Presupuesto</CardTitle>
              <CardDescription>
                {filteredCampaigns.length > 0
                  ? `${filteredCampaigns.length} campañas en el período seleccionado`
                  : 'Sin datos para el período seleccionado.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredCampaigns.length > 0 ? (
                <div className="space-y-6">
                  {/* Gráfico Circular */}
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={filteredCampaigns
                            .filter(c => c && c.spend > 0)
                            .sort((a, b) => (b?.spend || 0) - (a?.spend || 0))
                            .map((campaign, index) => {
                            if (!campaign) return null
                            
                            const totalFilteredSpend = filteredCampaigns
                              .filter(c => c && c.spend > 0)
                              .reduce((sum, c) => sum + (c?.spend || 0), 0)
                            const percentage = totalFilteredSpend > 0 ? ((campaign.spend || 0) / totalFilteredSpend) * 100 : 0
                            
                            // Colores alternados para mejor visualización
                            const colors = [
                              '#7C2D12', '#991B1B', '#B91C1C', '#DC2626', '#EF4444',
                              '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FEF2F2',
                              '#DC143C', '#C41E3A', '#8B0000', '#800020', '#722F37',
                              '#5C2E37', '#4A2C2A', '#3D1E1E', '#2D1B1B', '#1A0F0F',
                            ]
                            const color = colors[index % colors.length]
                            
                            return {
                              name: (campaign.campaign_name || 'Sin nombre').length > 25 
                                ? `${(campaign.campaign_name || 'Sin nombre').substring(0, 25)}...` 
                                : (campaign.campaign_name || 'Sin nombre'),
                              value: campaign.spend || 0,
                              color,
                              fullName: campaign.campaign_name || 'Sin nombre',
                              percentage: percentage.toFixed(1),
                            }
                          })
                          .filter(item => item !== null)}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={140}
                          paddingAngle={2}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {filteredCampaigns
                            .filter(c => c && c.spend > 0)
                            .sort((a, b) => (b?.spend || 0) - (a?.spend || 0))
                            .map((_, index) => {
                            const colors = [
                              '#7C2D12', '#991B1B', '#B91C1C', '#DC2626', '#EF4444',
                              '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FEF2F2',
                              '#DC143C', '#C41E3A', '#8B0000', '#800020', '#722F37',
                              '#5C2E37', '#4A2C2A', '#3D1E1E', '#2D1B1B', '#1A0F0F',
                            ]
                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                          })}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length && payload[0]?.payload) {
                              const item = payload[0].payload
                              const total = filteredCampaigns
                                .filter(c => c && c.spend > 0)
                                .reduce((sum, c) => sum + (c?.spend || 0), 0)
                              const percentage = total > 0 ? ((item.value || 0) / total) * 100 : 0
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-lg">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="h-3 w-3 rounded-full"
                                      style={{ backgroundColor: item.color || '#7C2D12' }}
                                    />
                                    <span className="font-medium text-sm">{item.fullName || 'Sin nombre'}</span>
                                  </div>
                                  <p className="mt-1 text-lg font-semibold">
                                    {formatCurrency(item.value || 0)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {percentage.toFixed(1)}% del total
                                  </p>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Legend
                          layout="vertical"
                          verticalAlign="middle"
                          align="right"
                          content={({ payload }) => {
                            if (!payload || payload.length === 0) return null
                            
                            const sortedCampaigns = [...filteredCampaigns].sort((a, b) => b.spend - a.spend)
                            const total = sortedCampaigns.reduce((sum, c) => sum + (c?.spend || 0), 0)
                            
                            return (
                              <div className="flex flex-col gap-2 pl-4 max-h-[350px] overflow-y-auto">
                                {payload.map((entry, index) => {
                                  if (!entry || !entry.payload) return null
                                  
                                  const item = entry.payload
                                  const campaign = sortedCampaigns.find(c => c?.campaign_name === item.fullName) || sortedCampaigns[index]
                                  
                                  if (!campaign) return null
                                  
                                  const percentage = total > 0 ? ((campaign.spend / total) * 100).toFixed(1) : '0'
                                  return (
                                    <div key={index} className="flex items-center gap-2 text-xs">
                                      <div
                                        className="h-3 w-3 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: entry.color || '#7C2D12' }}
                                      />
                                      <span className="text-muted-foreground truncate flex-1">
                                        {campaign.campaign_name && campaign.campaign_name.length > 20 
                                          ? `${campaign.campaign_name.substring(0, 20)}...` 
                                          : campaign.campaign_name || 'Sin nombre'}
                                      </span>
                                      <span className="font-medium whitespace-nowrap">{percentage}%</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay campañas en el período seleccionado.</p>
              )}
            </CardContent>
            </Card>
            
            {/* Cost per Result (mitad inferior) */}
            {theBundClubMonthlyData.lines && theBundClubMonthlyData.lines.length > 0 ? (
              <LineChart
                title="Evolución Cost per Result - TheBundClub"
                data={theBundClubMonthlyData.data}
                lines={theBundClubMonthlyData.lines}
                xAxisKey="month"
                height={300}
                formatValue={(v) => formatCurrency(v)}
              />
            ) : (
              <Card className="flex-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium">Evolución Cost per Result - TheBundClub</CardTitle>
                  <CardDescription>
                    Evolución mensual del Cost per Result de las campañas TheBundClub durante el año
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    No hay datos de campañas TheBundClub para mostrar.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Campaigns Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-medium">Campañas</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar campaña..."
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
                    <SelectItem value="all">Activas</SelectItem>
                    <SelectItem value="ACTIVE">Solo Activas</SelectItem>
                    <SelectItem value="PAUSED">Pausadas</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={handleSync} disabled={syncing}>
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
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
                  <TableHead>Campaña</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Amount Spent</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Link Clicks</TableHead>
                  <TableHead className="text-right">Cost per Result</TableHead>
                  <TableHead className="text-right">Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => {
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.campaign_name}</p>
                          <p className="text-xs text-muted-foreground">{campaign.objective}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(campaign.spend)}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.reach ? formatCompactNumber(campaign.reach) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCompactNumber(campaign.impressions)}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.link_clicks ? formatCompactNumber(campaign.link_clicks) : formatCompactNumber(campaign.clicks)}
                      </TableCell>
                      <TableCell className="text-right">
                        {campaign.cost_per_result && campaign.cost_per_result > 0
                          ? formatCurrency(campaign.cost_per_result)
                          : campaign.conversions > 0 && campaign.spend > 0
                          ? formatCurrency(campaign.spend / campaign.conversions)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(campaign.conversions)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!hasCampaigns && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Sin campañas aún. Conecta la API de Meta Ads para ver datos reales.
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

