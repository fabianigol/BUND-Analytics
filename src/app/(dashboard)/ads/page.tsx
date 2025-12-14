'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { AreaChart, BarChart, LineChart } from '@/components/dashboard/Charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from 'lucide-react'
import { mockDashboardMetrics, mockMetaCampaigns } from '@/lib/utils/mock-data'
import { formatCurrency, formatNumber, formatCompactNumber, formatPercentage } from '@/lib/utils/format'
import { subDays, format } from 'date-fns'

// Generate ads performance data
const adsPerformanceData = Array.from({ length: 30 }, (_, i) => {
  const date = subDays(new Date(), 29 - i)
  return {
    date: format(date, 'dd MMM'),
    gasto: Math.floor(Math.random() * 200) + 50,
    conversiones: Math.floor(Math.random() * 15) + 2,
  }
})

// Extended campaigns
const extendedCampaigns = [
  ...mockMetaCampaigns,
  {
    id: '3',
    campaign_id: 'camp_003',
    campaign_name: 'Captación Leads Q4',
    status: 'ACTIVE' as const,
    objective: 'LEAD_GENERATION',
    spend: 890.45,
    impressions: 67890,
    clicks: 1890,
    conversions: 45,
    cpm: 13.12,
    cpc: 0.47,
    ctr: 2.78,
    roas: 2.85,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: '4',
    campaign_id: 'camp_004',
    campaign_name: 'Brand Awareness',
    status: 'PAUSED' as const,
    objective: 'BRAND_AWARENESS',
    spend: 456.78,
    impressions: 234567,
    clicks: 890,
    conversions: 12,
    cpm: 1.95,
    cpc: 0.51,
    ctr: 0.38,
    roas: 1.45,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: '5',
    campaign_id: 'camp_005',
    campaign_name: 'Retargeting Carrito',
    status: 'ACTIVE' as const,
    objective: 'CONVERSIONS',
    spend: 234.56,
    impressions: 45678,
    clicks: 1567,
    conversions: 89,
    cpm: 5.13,
    cpc: 0.15,
    ctr: 3.43,
    roas: 5.67,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
]

export default function AdsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredCampaigns = extendedCampaigns.filter((campaign) => {
    const matchesSearch = campaign.campaign_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totalSpend = extendedCampaigns.reduce((sum, c) => sum + c.spend, 0)
  const totalConversions = extendedCampaigns.reduce((sum, c) => sum + c.conversions, 0)
  const avgRoas = extendedCampaigns.reduce((sum, c) => sum + c.roas, 0) / extendedCampaigns.length

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

  return (
    <div className="flex flex-col">
      <Header
        title="Paid Media"
        subtitle="Rendimiento de campañas de Meta Ads"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Gasto Total"
            value={formatCurrency(totalSpend)}
            change={mockDashboardMetrics.adSpendChange}
            icon={DollarSign}
            iconColor="bg-rose-100 text-rose-600"
          />
          <MetricCard
            title="ROAS Promedio"
            value={`${avgRoas.toFixed(2)}x`}
            change={mockDashboardMetrics.roasChange}
            icon={Target}
            iconColor="bg-emerald-100 text-emerald-600"
          />
          <MetricCard
            title="Conversiones"
            value={formatNumber(totalConversions)}
            change={8.5}
            icon={TrendingUp}
            iconColor="bg-blue-100 text-blue-600"
          />
          <MetricCard
            title="Impresiones"
            value={formatCompactNumber(mockDashboardMetrics.totalImpressions)}
            change={mockDashboardMetrics.impressionsChange}
            icon={Eye}
            iconColor="bg-purple-100 text-purple-600"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <LineChart
            title="Gasto vs Conversiones - Últimos 30 días"
            data={adsPerformanceData}
            xAxisKey="date"
            lines={[
              { dataKey: 'gasto', name: 'Gasto (€)', color: 'var(--chart-4)' },
              { dataKey: 'conversiones', name: 'Conversiones', color: 'var(--chart-3)' },
            ]}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Distribución del Presupuesto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {extendedCampaigns
                .filter((c) => c.status === 'ACTIVE')
                .map((campaign) => {
                  const percentage = (campaign.spend / totalSpend) * 100
                  return (
                    <div key={campaign.id} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{campaign.campaign_name}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(campaign.spend)} ({formatPercentage(percentage, 0)})
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
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
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="ACTIVE">Activas</SelectItem>
                    <SelectItem value="PAUSED">Pausadas</SelectItem>
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
                  <TableHead>Campaña</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Impresiones</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Conversiones</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => (
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
                      {formatCompactNumber(campaign.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(campaign.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercentage(campaign.ctr)}
                    </TableCell>
                    <TableCell className="text-right">{campaign.conversions}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          campaign.roas >= 3
                            ? 'font-semibold text-emerald-600'
                            : campaign.roas >= 2
                            ? 'text-amber-600'
                            : 'text-red-600'
                        }
                      >
                        {campaign.roas.toFixed(2)}x
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

