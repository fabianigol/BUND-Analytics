'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, RefreshCw, Search, Trophy, AlertTriangle, Star, DollarSign, Target, TrendingUp, Eye, Calendar, ShoppingBag, Info } from 'lucide-react'
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
import { MetaAd } from '@/types'
import { formatCurrency, formatNumber, formatCompactNumber } from '@/lib/utils/format'
import { createClient } from '@/lib/supabase/client'

// Función helper para categorizar anuncios (igual que campañas)
function categorizeAd(ad: MetaAd): 'citas' | 'leads' | 'ecom' {
  const campaignNameUpper = ad.campaign_name.toUpperCase()
  
  if (campaignNameUpper.includes('THEBUNDCLUB') || campaignNameUpper.includes('BUNDCLUB')) {
    return 'citas'
  }
  if (campaignNameUpper.includes('ECOM') || campaignNameUpper.includes('SALES')) {
    return 'ecom'
  }
  return 'leads'
}

interface AdsViewProps {
  dateRange?: { start: string; end: string } | null
}

export function AdsView({ dateRange }: AdsViewProps) {
  const [ads, setAds] = useState<{
    top3General: MetaAd[]
    byCategory: {
      citas: { top3PerCampaign: MetaAd[]; bottom3PerCampaign: MetaAd[] }
      leads: { top3PerCampaign: MetaAd[]; bottom3PerCampaign: MetaAd[] }
      ecom: { top3PerCampaign: MetaAd[]; bottom3PerCampaign: MetaAd[] }
    }
    metrics?: {
      totalSpend: number
      totalImpressions: number
      totalClicks: number
      totalLinkClicks: number
      totalConversions: number
      totalReach: number
      avgCTR: number
      avgCPC: number
      avgCPM: number
      avgCPR: number
      avgROAS: number
      conversionsByType: {
        citas: number
        leads: number
        ecom: number
      }
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAds = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (dateRange) {
        params.append('startDate', dateRange.start)
        params.append('endDate', dateRange.end)
      }

      console.log('[AdsView] Loading ads with params:', params.toString())
      const response = await fetch(`/api/meta/ads?${params.toString()}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[AdsView] Error loading ads:', response.status, response.statusText, errorText)
        setAds(null)
        return
      }

      const data = await response.json()
      console.log('[AdsView] Loaded ads data:', {
        top3General: data.top3General?.length || 0,
        byCategory: {
          citas: {
            top3PerCampaign: data.byCategory?.citas?.top3PerCampaign?.length || 0,
            bottom3PerCampaign: data.byCategory?.citas?.bottom3PerCampaign?.length || 0,
          },
          leads: {
            top3PerCampaign: data.byCategory?.leads?.top3PerCampaign?.length || 0,
            bottom3PerCampaign: data.byCategory?.leads?.bottom3PerCampaign?.length || 0,
          },
          ecom: {
            top3PerCampaign: data.byCategory?.ecom?.top3PerCampaign?.length || 0,
            bottom3PerCampaign: data.byCategory?.ecom?.bottom3PerCampaign?.length || 0,
          },
        },
      })
      setAds(data)
    } catch (error) {
      console.error('[AdsView] Error loading ads:', error)
      setAds(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAds()
  }, [dateRange])

  // Escuchar evento de sincronización completada
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('[AdsView] Sync completed event received, reloading ads...')
      loadAds()
    }
    
    window.addEventListener('ads-sync-complete', handleSyncComplete)
    return () => {
      window.removeEventListener('ads-sync-complete', handleSyncComplete)
    }
  }, [])


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            Activa
          </Badge>
        )
      case 'PAUSED':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            Pausada
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Componente de Podio para Top 3 General
  const PodiumSection = ({ top3Ads }: { top3Ads: MetaAd[] }) => {
    if (!top3Ads || top3Ads.length === 0) return null

    const [first, second, third] = top3Ads

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Podio - Top 3 Anuncios
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 2do lugar */}
            {second && (
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-300">
                <div className="grid grid-cols-2 gap-4">
                  {/* Columna izquierda: Miniatura y Nombre */}
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      {second.thumbnail_url ? (
                        <img
                          src={second.thumbnail_url}
                          alt={second.ad_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center text-gray-400 ${second.thumbnail_url ? 'hidden' : ''}`}>
                        <Eye className="h-8 w-8" />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-600">2º</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{second.ad_name}</p>
                    </div>
                  </div>
                  {/* Columna derecha: Métricas */}
                  <div className="flex flex-col justify-center gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Gasto</p>
                      <p className="text-sm font-semibold text-blue-600">{formatCurrency(second.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Resultados</p>
                      <p className="text-sm font-semibold">{formatNumber(second.conversions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CTR</p>
                      <p className="text-sm font-semibold">{second.ctr.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 1er lugar */}
            {first && (
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border-2 border-yellow-400 shadow-lg">
                <div className="grid grid-cols-2 gap-4">
                  {/* Columna izquierda: Miniatura y Nombre */}
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full aspect-video bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-lg overflow-hidden border border-yellow-300">
                      {first.thumbnail_url ? (
                        <img
                          src={first.thumbnail_url}
                          alt={first.ad_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center text-gray-400 ${first.thumbnail_url ? 'hidden' : ''}`}>
                        <Trophy className="h-10 w-10" />
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-base text-yellow-700">1º</p>
                      <p className="text-sm font-medium line-clamp-2">{first.ad_name}</p>
                    </div>
                  </div>
                  {/* Columna derecha: Métricas */}
                  <div className="flex flex-col justify-center gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Gasto</p>
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(first.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Resultados</p>
                      <p className="text-sm font-semibold">{formatNumber(first.conversions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CTR</p>
                      <p className="text-sm font-semibold">{first.ctr.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3er lugar */}
            {third && (
              <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-300">
                <div className="grid grid-cols-2 gap-4">
                  {/* Columna izquierda: Miniatura y Nombre */}
                  <div className="flex flex-col gap-2">
                    <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                      {third.thumbnail_url ? (
                        <img
                          src={third.thumbnail_url}
                          alt={third.ad_name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center text-gray-400 ${third.thumbnail_url ? 'hidden' : ''}`}>
                        <Star className="h-8 w-8" />
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-600">3º</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{third.ad_name}</p>
                    </div>
                  </div>
                  {/* Columna derecha: Métricas */}
                  <div className="flex flex-col justify-center gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Gasto</p>
                      <p className="text-sm font-semibold text-blue-600">{formatCurrency(third.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Resultados</p>
                      <p className="text-sm font-semibold">{formatNumber(third.conversions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">CTR</p>
                      <p className="text-sm font-semibold">{third.ctr.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    )
  }

  const renderAdTable = (
    title: string,
    adsList: MetaAd[],
    badgeType?: 'top' | 'bottom'
  ) => {
    if (!adsList || adsList.length === 0) return null

    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {badgeType === 'top' && <Star className="h-4 w-4 text-blue-500" />}
            {badgeType === 'bottom' && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {title} ({adsList.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anuncio</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Amount Spent</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Link Clicks</TableHead>
                <TableHead className="text-right">Cost per Result</TableHead>
                <TableHead className="text-right">Results</TableHead>
                <TableHead className="text-right">Reach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adsList.map((ad) => {
                const badge = badgeType === 'top' ? (
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                    ⭐ Top
                  </Badge>
                ) : badgeType === 'bottom' ? (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                    ⚠️ Bottom
                  </Badge>
                ) : null

                return (
                  <TableRow key={ad.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                      <div>
                        <p className="font-medium">{ad.ad_name}</p>
                          <p className="text-xs text-muted-foreground">{ad.ad_id}</p>
                        </div>
                        {badge}
                      </div>
                    </TableCell>
                    <TableCell>
                        <p className="text-sm">{ad.campaign_name}</p>
                    </TableCell>
                    <TableCell>{getStatusBadge(ad.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(ad.spend)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(ad.impressions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCompactNumber(ad.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ad.ctr > 0 ? `${ad.ctr.toFixed(2)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {ad.link_clicks ? formatCompactNumber(ad.link_clicks) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {ad.cost_per_result && ad.cost_per_result > 0
                        ? formatCurrency(ad.cost_per_result)
                        : ad.conversions > 0 && ad.spend > 0
                        ? formatCurrency(ad.spend / ad.conversions)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(ad.conversions)}
                    </TableCell>
                    <TableCell className="text-right">
                      {ad.reach ? formatCompactNumber(ad.reach) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ads) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            No hay datos de anuncios. Sincroniza primero.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tooltip Explicativo - 3 Columnas con Colores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Top 3 General - Azul */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <div className="flex items-start gap-2 mb-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-semibold text-blue-900">Top 3 General</p>
          </div>
          <p className="text-xs text-blue-800">
            Los 3 mejores anuncios de todas las campañas, ordenados por CTR y conversiones.
          </p>
        </div>

        {/* Top 3 por Campaña - Verde */}
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <div className="flex items-start gap-2 mb-2">
            <Info className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-semibold text-green-900">Top 3 por Campaña</p>
          </div>
          <p className="text-xs text-green-800">
            Los 3 mejores anuncios de cada campaña individual (puede haber múltiples campañas).
          </p>
        </div>

        {/* Bottom 3 por Campaña - Rojo */}
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-start gap-2 mb-2">
            <Info className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-900">Bottom 3 por Campaña</p>
          </div>
          <p className="text-xs text-red-800">
            Los 3 peores anuncios de cada campaña individual, ordenados por CTR más bajo y cost per result más alto.
          </p>
        </div>
      </div>

      {/* Podio - Top 3 General */}
      {ads.top3General && ads.top3General.length > 0 && (
        <PodiumSection top3Ads={ads.top3General} />
      )}

      {/* Secciones por categoría */}
      {['citas', 'leads', 'ecom'].map((category) => {
        const categoryData = ads.byCategory[category as 'citas' | 'leads' | 'ecom']
        const categoryName = category === 'citas' ? 'Citas' : category === 'leads' ? 'Leads' : 'Ecom'
        
        const hasData = categoryData.top3PerCampaign.length > 0 || 
                       categoryData.bottom3PerCampaign.length > 0

        if (!hasData) return null

        return (
          <div key={category} className="space-y-4">
            <h2 className="text-lg font-semibold">{categoryName}</h2>
            
            {renderAdTable(
              `Top 3 por Campaña - ${categoryName}`,
              categoryData.top3PerCampaign,
              'top'
            )}
            
            {renderAdTable(
              `Bottom 3 por Campaña - ${categoryName}`,
              categoryData.bottom3PerCampaign,
              'bottom'
            )}
          </div>
        )
      })}

      {/* Si no hay datos en ninguna categoría */}
      {(!ads.top3General || ads.top3General.length === 0) && 
       !ads.byCategory.citas.top3PerCampaign.length && 
       !ads.byCategory.leads.top3PerCampaign.length && 
       !ads.byCategory.ecom.top3PerCampaign.length && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              No hay anuncios disponibles. Sincroniza primero para ver datos.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

