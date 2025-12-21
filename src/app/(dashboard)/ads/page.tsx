'use client'

import { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/dashboard/Header'
import { AreaChart, BarChart, LineChart, PieChart } from '@/components/dashboard/Charts'

// Cargar SankeyChart dinámicamente para evitar problemas de SSR
const SankeyChart = dynamic(() => import('@/components/dashboard/Charts').then(mod => ({ default: mod.SankeyChart })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px]">
      <p className="text-sm text-muted-foreground">Cargando diagrama...</p>
    </div>
  ),
})
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

  // Calcular datos para el diagrama de Sankey
  const sankeyData = useMemo(() => {
    const totalSpend = filteredCampaigns.reduce((sum, c) => sum + c.spend, 0)
    
    // Agrupar campañas por conjunto (case insensitive)
    const citasCampaigns: Array<{ name: string; spend: number }> = []
    const leadsCampaigns: Array<{ name: string; spend: number }> = []
    const onlineCampaigns: Array<{ name: string; spend: number }> = []
    
    filteredCampaigns.forEach((campaign) => {
      const nameUpper = campaign.campaign_name.toUpperCase()
      
      if (nameUpper.includes('BUNDCLUB') || nameUpper.includes('THEBUNDCLUB')) {
        citasCampaigns.push({ name: campaign.campaign_name, spend: campaign.spend })
      } else if (nameUpper.includes('LEAD')) {
        leadsCampaigns.push({ name: campaign.campaign_name, spend: campaign.spend })
      } else if (nameUpper.includes('ECOM')) {
        onlineCampaigns.push({ name: campaign.campaign_name, spend: campaign.spend })
      }
    })
    
    // Ordenar campañas de mayor a menor gasto dentro de cada conjunto
    const sortedCitasCampaigns = [...citasCampaigns].sort((a, b) => b.spend - a.spend)
    const sortedLeadsCampaigns = [...leadsCampaigns].sort((a, b) => b.spend - a.spend)
    const sortedOnlineCampaigns = [...onlineCampaigns].sort((a, b) => b.spend - a.spend)
    
    // Calcular gasto por conjunto
    const citasSpend = citasCampaigns.reduce((sum, c) => sum + c.spend, 0)
    const leadsSpend = leadsCampaigns.reduce((sum, c) => sum + c.spend, 0)
    const onlineSpend = onlineCampaigns.reduce((sum, c) => sum + c.spend, 0)
    
    // Crear nodos
    const nodes = [
      // Nivel 0: Gasto Total
      {
        id: 'total',
        name: 'Gasto Total',
        value: totalSpend,
        level: 0,
        color: '#DC2626', // Rojo
      },
      // Nivel 1: Conjuntos
      {
        id: 'citas',
        name: 'Citas',
        value: citasSpend,
        level: 1,
        color: '#3b82f6',
      },
      {
        id: 'leads',
        name: 'Leads',
        value: leadsSpend,
        level: 1,
        color: '#f59e0b',
      },
      {
        id: 'online',
        name: 'Online',
        value: onlineSpend,
        level: 1,
        color: '#10b981',
      },
      // Nivel 2: Campañas específicas (ordenadas de mayor a menor)
      ...sortedCitasCampaigns.map((campaign, index) => ({
        id: `citas-${index}`,
        name: campaign.name,
        value: campaign.spend,
        level: 2,
        color: '#60a5fa',
      })),
      ...sortedLeadsCampaigns.map((campaign, index) => ({
        id: `leads-${index}`,
        name: campaign.name,
        value: campaign.spend,
        level: 2,
        color: '#fbbf24',
      })),
      ...sortedOnlineCampaigns.map((campaign, index) => ({
        id: `online-${index}`,
        name: campaign.name,
        value: campaign.spend,
        level: 2,
        color: '#34d399',
      })),
    ]
    
    // Crear links
    const links = [
      // Links desde Gasto Total a Conjuntos
      {
        source: 'total',
        target: 'citas',
        value: citasSpend,
        color: '#3b82f6',
      },
      {
        source: 'total',
        target: 'leads',
        value: leadsSpend,
        color: '#f59e0b',
      },
      {
        source: 'total',
        target: 'online',
        value: onlineSpend,
        color: '#10b981',
      },
      // Links desde Conjuntos a Campañas (usando campañas ordenadas)
      ...sortedCitasCampaigns.map((campaign, index) => ({
        source: 'citas',
        target: `citas-${index}`,
        value: campaign.spend,
        color: '#60a5fa',
      })),
      ...sortedLeadsCampaigns.map((campaign, index) => ({
        source: 'leads',
        target: `leads-${index}`,
        value: campaign.spend,
        color: '#fbbf24',
      })),
      ...sortedOnlineCampaigns.map((campaign, index) => ({
        source: 'online',
        target: `online-${index}`,
        value: campaign.spend,
        color: '#34d399',
      })),
    ]
    
    return { nodes, links }
  }, [filteredCampaigns])

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

        {/* KPIs y Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-rose-100 p-1.5 text-rose-600">
                <DollarSign className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Gasto Total</p>
                <p className="text-sm font-semibold truncate">
                  {totalSpend ? formatCurrency(totalSpend) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600">
                <Target className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">ROAS Promedio</p>
                <p className="text-sm font-semibold truncate">
                  {avgRoas ? `${avgRoas.toFixed(2)}x` : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Conversiones</p>
                <p className="text-sm font-semibold truncate">
                  {totalConversions > 0 ? formatNumber(totalConversions) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-purple-100 p-1.5 text-purple-600">
                <Eye className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Impresiones</p>
                <p className="text-sm font-semibold truncate">
                  {totalImpressions ? formatCompactNumber(totalImpressions) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Citas Confirmadas</p>
                <p className="text-sm font-semibold truncate">
                  {formatNumber(conversionsByType.citas)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-amber-100 p-1.5 text-amber-600">
                <Target className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Leads</p>
                <p className="text-sm font-semibold truncate">
                  {formatNumber(conversionsByType.leads)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="flex items-center gap-2 p-0">
              <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-600">
                <ShoppingBag className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Ventas Online</p>
                <p className="text-sm font-semibold truncate">
                  {formatNumber(conversionsByType.ventas)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Diagrama de Sankey - Distribución del Gasto */}
        {sankeyData.nodes.length > 0 && sankeyData.links.length > 0 && (
          <SankeyChart
            title="Distribución del Gasto"
            description="Flujo de gasto desde el total hacia conjuntos y campañas específicas"
            nodes={sankeyData.nodes}
            links={sankeyData.links}
            height={500}
          />
        )}

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

