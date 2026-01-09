'use client'

/**
 * PeakValleyIndicator - Componente para mostrar picos y valles de demanda
 * Visualiza momentos de alta y baja demanda de manera intuitiva
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumber } from '@/lib/utils/format';

interface PeakValleyData {
  dayOfWeek: number;
  hour: number;
  count: number;
  isPeak?: boolean;
  isValley?: boolean;
}

interface PeakValleyIndicatorProps {
  peaks: PeakValleyData[];
  valleys: PeakValleyData[];
  avgValue: number;
  title?: string;
  showTop?: number;
}

export function PeakValleyIndicator({ 
  peaks, 
  valleys, 
  avgValue,
  title = 'Picos y Valles de Demanda',
  showTop = 5,
}: PeakValleyIndicatorProps) {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  const formatTime = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };
  
  const formatSlot = (data: PeakValleyData) => {
    return `${dayNames[data.dayOfWeek]} ${formatTime(data.hour)}`;
  };
  
  const getPercentageDiff = (value: number) => {
    return ((value - avgValue) / avgValue * 100).toFixed(0);
  };
  
  const topPeaks = peaks.slice(0, showTop);
  const topValleys = valleys.slice(0, showTop);
  
  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-lg font-semibold">{title}</h3>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Picos */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h4 className="font-semibold text-green-900 dark:text-green-100">
                  Momentos de Alta Demanda
                </h4>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Top {topPeaks.length} horarios más activos
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {topPeaks.map((peak, idx) => {
                const percentDiff = getPercentageDiff(peak.count);
                return (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="secondary"
                        className="bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100 w-8 h-8 flex items-center justify-center"
                      >
                        {idx + 1}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{formatSlot(peak)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(peak.count)} citas
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300 dark:border-green-700">
                      +{percentDiff}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        {/* Valles */}
        <Card className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <TrendingDown className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                  Oportunidades de Promoción
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Top {topValleys.length} horarios con baja demanda
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {topValleys.map((valley, idx) => {
                const percentDiff = Math.abs(parseFloat(getPercentageDiff(valley.count)));
                return (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white/60 dark:bg-slate-900/40 rounded-lg border border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="secondary"
                        className="bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100 w-8 h-8 flex items-center justify-center"
                      >
                        {idx + 1}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{formatSlot(valley)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(valley.count)} citas
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                      -{percentDiff}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Información del promedio */}
      <div className="text-center text-sm text-muted-foreground">
        Promedio por horario: <span className="font-medium">{formatNumber(avgValue)} citas</span>
      </div>
    </div>
  );
}
