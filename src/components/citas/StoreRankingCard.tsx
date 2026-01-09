/**
 * StoreRankingCard - Muestra el ranking de una tienda con comparativa de top performers
 */

import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Medal, Award } from 'lucide-react';
import { formatNumber } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';

interface StoreRank {
  store_city: string;
  total_citas: number;
  cancellation_rate: number;
  growth_rate: number; // % de crecimiento año sobre año
}

interface StoreRankingCardProps {
  selectedStore: string;
  rankings: StoreRank[];
  metric?: 'total_citas' | 'cancellation_rate' | 'growth_rate';
  year?: number;
}

export function StoreRankingCard({
  selectedStore,
  rankings,
  metric = 'total_citas',
  year,
}: StoreRankingCardProps) {
  // Ordenar rankings según métrica
  const sortedRankings = [...rankings].sort((a, b) => {
    if (metric === 'cancellation_rate') {
      return a.cancellation_rate - b.cancellation_rate; // Menor es mejor
    } else if (metric === 'total_citas') {
      return b.total_citas - a.total_citas; // Mayor es mejor
    } else {
      return b.growth_rate - a.growth_rate; // Mayor es mejor
    }
  });
  
  // Encontrar posición de la tienda seleccionada
  const currentStoreIndex = sortedRankings.findIndex(r => r.store_city === selectedStore);
  const currentStoreRank = currentStoreIndex !== -1 ? sortedRankings[currentStoreIndex] : null;
  const position = currentStoreIndex + 1;
  
  // Top 3 tiendas
  const topThree = sortedRankings.slice(0, 3);
  
  // Obtener icono según posición
  const getPositionIcon = (pos: number) => {
    switch (pos) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-slate-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-700" />;
      default:
        return null;
    }
  };
  
  // Obtener color de badge según posición
  const getPositionBadgeVariant = (pos: number): "default" | "secondary" | "destructive" | "outline" => {
    if (pos === 1) return 'default';
    if (pos <= 3) return 'secondary';
    return 'outline';
  };
  
  // Obtener color de fondo según posición
  const getPositionBgColor = (pos: number): string => {
    if (pos === 1) return 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    if (pos === 2) return 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950/30 dark:to-slate-900/20 border-slate-200 dark:border-slate-800';
    if (pos === 3) return 'bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800';
  };
  
  // Obtener texto de métrica
  const getMetricLabel = () => {
    switch (metric) {
      case 'total_citas':
        return 'Total de Citas';
      case 'cancellation_rate':
        return 'Tasa de Cancelación';
      case 'growth_rate':
        return 'Crecimiento Anual';
      default:
        return 'Métrica';
    }
  };
  
  // Formatear valor de métrica
  const formatMetricValue = (rank: StoreRank) => {
    switch (metric) {
      case 'total_citas':
        return formatNumber(rank.total_citas);
      case 'cancellation_rate':
        return `${rank.cancellation_rate.toFixed(1)}%`;
      case 'growth_rate':
        return `${rank.growth_rate > 0 ? '+' : ''}${rank.growth_rate.toFixed(1)}%`;
      default:
        return '—';
    }
  };
  
  if (!currentStoreRank) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No hay datos disponibles para {selectedStore}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Tienda actual */}
      <div className="p-4 rounded-lg bg-background/60 border-2 border-primary/50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-foreground">{selectedStore}</h3>
          {position <= 3 && getPositionIcon(position)}
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Citas</p>
            <p className="text-lg font-semibold">{formatNumber(currentStoreRank.total_citas)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">% Cancel.</p>
            <p className="text-lg font-semibold">{currentStoreRank.cancellation_rate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Crecimiento</p>
            <p className={`text-lg font-semibold flex items-center gap-1 ${
              currentStoreRank.growth_rate > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {currentStoreRank.growth_rate > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {currentStoreRank.growth_rate > 0 ? '+' : ''}{currentStoreRank.growth_rate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
      
      {/* Top 3 tiendas */}
      <div>
        <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Top 3 por {getMetricLabel()}
        </h4>
        <div className="space-y-2">
          {topThree.map((rank, idx) => {
            const isCurrentStore = rank.store_city === selectedStore;
            return (
              <div
                key={rank.store_city}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  isCurrentStore
                    ? 'bg-primary/10 border border-primary/30'
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getPositionIcon(idx + 1)}
                  <div>
                    <p className={`font-medium ${isCurrentStore ? 'text-primary' : ''}`}>
                      {rank.store_city}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMetricValue(rank)}
                    </p>
                  </div>
                </div>
                {isCurrentStore && (
                  <Badge variant="outline" className="text-xs">
                    Tu tienda
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Contexto adicional si no está en top 3 */}
      {position > 3 && (
        <div className="pt-3 border-t text-sm text-muted-foreground">
          <p>
            {selectedStore} está en la posición <span className="font-semibold">#{position}</span> de{' '}
            <span className="font-semibold">{rankings.length}</span> tiendas.
          </p>
        </div>
      )}
      
      {/* Badge de posición grande */}
      <div className="flex items-center justify-center">
        <Badge variant={getPositionBadgeVariant(position)} className="text-2xl px-6 py-2">
          #{position}
        </Badge>
      </div>
    </div>
  );
}
