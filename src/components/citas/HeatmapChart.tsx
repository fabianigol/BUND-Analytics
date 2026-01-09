/**
 * HeatmapChart - Componente de mapa de calor para visualizar patrones estacionales
 * Muestra una grid de meses vs años con intensidad de color según valores
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/utils/format';

interface HeatmapData {
  year: number;
  month: number;
  value: number;
}

interface HeatmapChartProps {
  data: HeatmapData[];
  title?: string;
  description?: string;
  baseColor?: string; // Color base para el gradiente (en formato hex)
  showTitle?: boolean;
}

export function HeatmapChart({
  data,
  title = 'Mapa de Calor Estacional',
  description = 'Volumen de citas por mes y año',
  baseColor = '#3B82F6',
  showTitle = true,
}: HeatmapChartProps) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  // Obtener años únicos y ordenarlos
  const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => b - a);
  
  // Encontrar valor máximo y mínimo para normalización y destacado
  const dataWithValues = data.filter(d => d.value > 0);
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = dataWithValues.length > 0 ? Math.min(...dataWithValues.map(d => d.value)) : 0;
  
  // Función para obtener datos de un mes/año específico
  const getValue = (year: number, month: number): number => {
    const item = data.find(d => d.year === year && d.month === month);
    return item?.value || 0;
  };
  
  // Función para convertir hex a rgb
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 59, g: 130, b: 246 }; // Default blue
  };
  
  // Función para obtener color según intensidad
  const getHeatmapColor = (value: number): string => {
    if (value === 0) {
      return 'rgb(241, 245, 249)'; // slate-100 para celdas vacías
    }
    
    const intensity = value / maxValue;
    const rgb = hexToRgb(baseColor);
    
    // Crear gradiente desde muy claro (0.2) hasta color completo (1.0)
    const minOpacity = 0.15;
    const opacity = minOpacity + intensity * (1 - minOpacity);
    
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
  };
  
  // Función para obtener color de texto según intensidad
  const getTextColor = (value: number): string => {
    if (value === 0) return 'text-slate-400';
    const intensity = value / maxValue;
    return intensity > 0.6 ? 'text-white' : 'text-slate-700 dark:text-slate-300';
  };
  
  const content = (
    <div className="space-y-4">
      {/* Grid del heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(12, minmax(50px, 1fr))` }}>
            {/* Header con meses */}
            <div className="h-8" />
            {months.map((month, idx) => (
              <div
                key={idx}
                className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
              >
                {month}
              </div>
            ))}
            
            {/* Filas por año */}
            {years.map(year => (
              <React.Fragment key={year}>
                {/* Label del año */}
                <div className="h-12 flex items-center justify-end pr-3 text-sm font-semibold text-foreground">
                  {year}
                </div>
                
                {/* Celdas del año */}
                {Array.from({ length: 12 }, (_, idx) => idx + 1).map(month => {
                  const value = getValue(year, month);
                  const bgColor = getHeatmapColor(value);
                  const textColor = getTextColor(value);
                  
                  // Determinar si es el valor máximo o mínimo (entre valores > 0)
                  const isMax = value > 0 && value === maxValue;
                  const isMin = value > 0 && value === minValue && dataWithValues.length > 1;
                  
                  // Clase de borde destacado
                  let borderClass = 'border border-border/50';
                  if (isMax) {
                    borderClass = 'border-2 border-green-500 dark:border-green-400 shadow-lg';
                  } else if (isMin) {
                    borderClass = 'border-2 border-orange-500 dark:border-orange-400 shadow-lg';
                  }
                  
                  return (
                    <TooltipProvider key={`${year}-${month}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`h-12 flex items-center justify-center rounded-md transition-all hover:scale-105 hover:shadow-md cursor-default ${textColor} ${borderClass}`}
                            style={{ backgroundColor: bgColor }}
                          >
                            <span className="text-xs font-semibold">
                              {value > 0 ? formatNumber(value) : '—'}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs">
                            <p className="font-semibold">{months[month - 1]} {year}</p>
                            <p className="text-muted-foreground">
                              {value > 0 ? `${formatNumber(value)} citas` : 'Sin datos'}
                            </p>
                            {isMax && (
                              <p className="text-green-600 dark:text-green-400 font-semibold mt-1">
                                🏆 Mayor volumen
                              </p>
                            )}
                            {isMin && (
                              <p className="text-orange-600 dark:text-orange-400 font-semibold mt-1">
                                📉 Menor volumen
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      
      {/* Leyenda de intensidad y bordes */}
      <div className="flex flex-col gap-3 pt-2 border-t">
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-muted-foreground">Menos</span>
          <div className="flex gap-1">
            {[0.15, 0.3, 0.5, 0.7, 0.9, 1].map((opacity, idx) => {
              const rgb = hexToRgb(baseColor);
              return (
                <div
                  key={idx}
                  className="w-6 h-4 rounded border border-border/50"
                  style={{ backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` }}
                />
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground">Más</span>
        </div>
        
        {/* Leyenda de bordes destacados */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded border-2 border-green-500 dark:border-green-400 bg-slate-100" />
            <span className="text-muted-foreground">Mayor volumen</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded border-2 border-orange-500 dark:border-orange-400 bg-slate-100" />
            <span className="text-muted-foreground">Menor volumen</span>
          </div>
        </div>
      </div>
    </div>
  );
  
  if (!showTitle) {
    return content;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
