'use client'

import { useMemo, useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart, LineChart } from '@/components/dashboard/Charts'
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
      const response = await fetch('/api/sync/meta', {
        method: 'POST',
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

  // Calcular conversiones por tipo desde actions
  const conversionsByType = useMemo(() => {
    const types: Record<string, number> = {
      citas: 0,
      leads: 0,
      ventas: 0,
    }

    filteredCampaigns.forEach((campaign) => {
      const actions = (campaign.actions as Array<{ action_type: string; value: string }>) || []
      
      // Log action types for debugging (only once)
      if (actions.length > 0) {
        const uniqueTypes = new Set(actions.map(a => a.action_type))
        if (uniqueTypes.size > 0) {
          console.log('[Ads Page] Action types found:', Array.from(uniqueTypes).slice(0, 10))
        }
      }
      
      actions.forEach((action) => {
        const value = parseInt(action.value) || 0
        const category = categorizeActionType(action.action_type)
        
        if (category) {
          types[category] += value
        }
      })
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
            value={totalConversions > 0 ? `${formatNumber(totalConversions)} (${formatNumber(conversionsByType.citas)} citas, ${formatNumber(conversionsByType.leads)} leads, ${formatNumber(conversionsByType.ventas)} ventas)` : '—'}
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
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Gasto vs Conversiones</CardTitle>
              <CardDescription>
                Distribución de gasto y conversiones por tipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredCampaigns.length > 0 ? (
                <div className="space-y-4">
                  <BarChart
                    title=""
                    data={[
                      {
                        name: 'Citas',
                        value: (() => {
                          // Calcular gasto proporcional para citas
                          let totalSpendForCitas = 0
                          filteredCampaigns.forEach((c) => {
                            const actions = (c.actions as Array<{ action_type: string; value: string }>) || []
                            const citasInCampaign = actions
                              .filter(a => categorizeActionType(a.action_type) === 'citas')
                              .reduce((sum, a) => sum + (parseInt(a.value) || 0), 0)
                            if (citasInCampaign > 0 && c.conversions > 0) {
                              totalSpendForCitas += c.spend * (citasInCampaign / c.conversions)
                            } else if (citasInCampaign > 0) {
                              // Si hay citas pero no conversiones totales, usar el gasto completo
                              totalSpendForCitas += c.spend
                            }
                          })
                          return totalSpendForCitas
                        })(),
                        color: '#7C2D12', // Burdeos muy oscuro
                      },
                      {
                        name: 'Leads',
                        value: (() => {
                          let totalSpendForLeads = 0
                          filteredCampaigns.forEach((c) => {
                            const actions = (c.actions as Array<{ action_type: string; value: string }>) || []
                            const leadsInCampaign = actions
                              .filter(a => categorizeActionType(a.action_type) === 'leads')
                              .reduce((sum, a) => sum + (parseInt(a.value) || 0), 0)
                            if (leadsInCampaign > 0 && c.conversions > 0) {
                              totalSpendForLeads += c.spend * (leadsInCampaign / c.conversions)
                            } else if (leadsInCampaign > 0) {
                              totalSpendForLeads += c.spend
                            }
                          })
                          return totalSpendForLeads
                        })(),
                        color: '#991B1B', // Burdeos oscuro
                      },
                      {
                        name: 'Ventas',
                        value: (() => {
                          let totalSpendForVentas = 0
                          filteredCampaigns.forEach((c) => {
                            const actions = (c.actions as Array<{ action_type: string; value: string }>) || []
                            const ventasInCampaign = actions
                              .filter(a => categorizeActionType(a.action_type) === 'ventas')
                              .reduce((sum, a) => sum + (parseInt(a.value) || 0), 0)
                            if (ventasInCampaign > 0 && c.conversions > 0) {
                              totalSpendForVentas += c.spend * (ventasInCampaign / c.conversions)
                            } else if (ventasInCampaign > 0) {
                              totalSpendForVentas += c.spend
                            }
                          })
                          return totalSpendForVentas
                        })(),
                        color: '#B91C1C', // Burdeos medio oscuro
                      },
                    ]}
                    dataKey="value"
                    xAxisKey="name"
                    height={200}
                    formatValue={(v) => formatCurrency(v)}
                  />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold" style={{ color: '#7C2D12' }}>
                        {formatNumber(conversionsByType.citas)}
                      </p>
                      <p className="text-xs text-muted-foreground">Citas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: '#991B1B' }}>
                        {formatNumber(conversionsByType.leads)}
                      </p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: '#B91C1C' }}>
                        {formatNumber(conversionsByType.ventas)}
                      </p>
                      <p className="text-xs text-muted-foreground">Ventas</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[250px] items-center justify-center">
                  <p className="text-sm text-muted-foreground">Sin datos aún</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Distribución del Presupuesto</CardTitle>
              <CardDescription>
                {activeCampaignsBySpend.length > 0
                  ? `${activeCampaignsBySpend.length} campañas activas`
                  : 'Sin datos de campañas activas.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeCampaignsBySpend.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
                  {activeCampaignsBySpend.map((campaign) => {
                    const totalActiveSpend = activeCampaignsBySpend.reduce((sum, c) => sum + c.spend, 0)
                    const percentage = totalActiveSpend > 0 ? (campaign.spend / totalActiveSpend) * 100 : 0
                    return (
                      <div key={campaign.id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium truncate pr-2">{campaign.campaign_name}</span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {formatCurrency(campaign.spend)} ({formatPercentage(percentage, 0)})
                          </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: '#7C2D12', // Burdeos muy oscuro
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No hay campañas activas.</p>
              )}
            </CardContent>
          </Card>
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
                  // Extraer Results por tipo desde actions
                  const actions = (campaign.actions as Array<{ action_type: string; value: string }>) || []
                  const resultsByType: Record<string, number> = {}
                  actions.forEach((action) => {
                    const value = parseInt(action.value) || 0
                    resultsByType[action.action_type] = (resultsByType[action.action_type] || 0) + value
                  })
                  const resultsText = Object.entries(resultsByType)
                    .filter(([_, value]) => value > 0)
                    .map(([type, value]) => `${value} ${type}`)
                    .join(', ') || '0'

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
                          : campaign.conversions > 0
                          ? formatCurrency(campaign.spend / campaign.conversions)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          {resultsText && (
                            <span className="text-sm font-medium" title={resultsText}>
                              {resultsText.length > 30 ? `${resultsText.substring(0, 30)}...` : resultsText}
                            </span>
                          )}
                          {!resultsText && <span className="text-sm text-muted-foreground">0</span>}
                        </div>
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

