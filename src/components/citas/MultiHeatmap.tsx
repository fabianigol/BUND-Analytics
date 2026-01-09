'use client'

/**
 * MultiHeatmap - Heatmap mejorado con soporte multi-dimensión
 * Soporta anotaciones, comparaciones lado a lado, y escalas de color personalizadas
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface MultiHeatmapProps {
  data: { x: string | number; y: string | number; value: number }[];
  xLabel: string;
  yLabel: string;
  title?: string;
  description?: string;
  colorScale?: string[];
  annotations?: boolean;
  compareData?: { x: string | number; y: string | number; value: number }[];
  height?: number;
  formatValue?: (value: number) => string;
}

export function MultiHeatmap({
  data,
  xLabel,
  yLabel,
  title,
  description,
  colorScale = ['#f0f9ff', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985'],
  annotations = false,
  compareData,
  height = 400,
  formatValue = (v) => v.toString(),
}: MultiHeatmapProps) {
  // Obtener valores únicos de X e Y
  const xValues = useMemo(() => {
    const values = Array.from(new Set(data.map(d => d.x)));
    return values.sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });
  }, [data]);
  
  const yValues = useMemo(() => {
    const values = Array.from(new Set(data.map(d => d.y)));
    return values.sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });
  }, [data]);
  
  // Calcular valor máximo para escala de color
  const maxValue = useMemo(() => {
    const allValues = [...data.map(d => d.value)];
    if (compareData) {
      allValues.push(...compareData.map(d => d.value));
    }
    return Math.max(...allValues, 1);
  }, [data, compareData]);
  
  // Función para obtener color según valor
  const getColor = (value: number) => {
    if (value === 0) return colorScale[0];
    const normalizedValue = value / maxValue;
    const index = Math.min(
      Math.floor(normalizedValue * (colorScale.length - 1)),
      colorScale.length - 1
    );
    return colorScale[index];
  };
  
  // Función para obtener contraste de texto
  const getTextColor = (bgColor: string) => {
    // Convertir hex a RGB
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    // Calcular luminosidad
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };
  
  // Crear mapa de datos para acceso rápido
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(d => {
      map.set(`${d.x}-${d.y}`, d.value);
    });
    return map;
  }, [data]);
  
  const compareDataMap = useMemo(() => {
    if (!compareData) return null;
    const map = new Map<string, number>();
    compareData.forEach(d => {
      map.set(`${d.x}-${d.y}`, d.value);
    });
    return map;
  }, [compareData]);
  
  const renderHeatmap = (dataSource: Map<string, number>, label?: string) => (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="text-sm font-medium text-center mb-2">{label}</div>
      )}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header con valores de X */}
          <div className="flex mb-1">
            <div className="w-20 flex-shrink-0" /> {/* Espacio para labels Y */}
            {xValues.map((x, idx) => (
              <div
                key={`x-${idx}`}
                className="flex-1 min-w-[40px] text-center text-xs text-muted-foreground px-1"
              >
                {x}
              </div>
            ))}
          </div>
          
          {/* Filas del heatmap */}
          {yValues.map((y, yIdx) => (
            <div key={`y-${yIdx}`} className="flex mb-1">
              {/* Label Y */}
              <div className="w-20 flex-shrink-0 flex items-center justify-end pr-2 text-xs text-muted-foreground">
                {y}
              </div>
              
              {/* Celdas */}
              {xValues.map((x, xIdx) => {
                const key = `${x}-${y}`;
                const value = dataSource.get(key) || 0;
                const bgColor = getColor(value);
                const textColor = annotations ? getTextColor(bgColor) : 'transparent';
                
                // Buscar datos adicionales para tooltip mejorado
                const cellData = data.find(d => d.x === x && d.y === y);
                const tooltipParts = [
                  `${xLabel}: ${x}`,
                  `${yLabel}: ${y}`,
                  `Cifra: ${formatValue(value)}`,
                ];
                
                // Agregar info adicional si existe
                if (cellData) {
                  // Agregar porcentaje si existe
                  if ((cellData as any).percentage !== undefined) {
                    tooltipParts.push(`% del total: ${(cellData as any).percentage.toFixed(2)}%`);
                  }
                  if ((cellData as any).total !== undefined) {
                    tooltipParts.push(`Total: ${(cellData as any).total} citas`);
                  }
                  if ((cellData as any).cancelled !== undefined) {
                    tooltipParts.push(`Canceladas: ${(cellData as any).cancelled}`);
                  }
                }
                
                return (
                  <div
                    key={`cell-${xIdx}-${yIdx}`}
                    className="flex-1 min-w-[40px] aspect-square flex items-center justify-center text-xs font-medium rounded border border-background transition-all hover:scale-105 hover:shadow-md cursor-pointer"
                    style={{ backgroundColor: bgColor, color: textColor }}
                    title={tooltipParts.join('\n')}
                  >
                    {annotations && value > 0 && formatValue(value)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  const content = (
    <>
      {/* Leyenda de color */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground">0</span>
        <div className="flex gap-0.5">
          {colorScale.map((color, idx) => (
            <div
              key={idx}
              className="w-8 h-4 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{formatValue(maxValue)}</span>
      </div>
      
      {/* Heatmaps */}
      {compareData && compareDataMap ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderHeatmap(dataMap, 'Principal')}
          {renderHeatmap(compareDataMap, 'Comparación')}
        </div>
      ) : (
        renderHeatmap(dataMap)
      )}
    </>
  );
  
  if (title || description) {
    return (
      <Card>
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }
  
  return <div className="w-full">{content}</div>;
}
