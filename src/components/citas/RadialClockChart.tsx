'use client'

/**
 * RadialClockChart - Gráfica radial tipo reloj para patrones
 * Soporta visualización horaria (24h) y semanal (7 días)
 */

import React from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatNumber } from '@/lib/utils/format';

interface RadialClockChartProps {
  data: { label: string; value: number; hour?: number; day?: number }[];
  type: 'weekly' | 'hourly';
  colors?: string[];
  maxValue?: number;
  height?: number;
  title?: string;
}

export function RadialClockChart({ 
  data, 
  type, 
  colors = ['#8B0000', '#3B82F6'], 
  maxValue,
  height = 400,
  title,
}: RadialClockChartProps) {
  // Calcular valor máximo si no se proporciona
  const computedMaxValue = maxValue || Math.max(...data.map(d => d.value)) * 1.2;
  
  // Tooltip personalizado
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm mb-1">{data.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatNumber(data.value)} citas
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="w-full" style={{ height }}>
      {title && (
        <div className="text-center mb-4">
          <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        </div>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid 
            stroke="hsl(var(--border))" 
            strokeDasharray="3 3"
          />
          <PolarAngleAxis 
            dataKey="label" 
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, computedMaxValue]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          <Radar
            name={type === 'weekly' ? 'Citas semanales' : 'Citas horarias'}
            dataKey="value"
            stroke={colors[0]}
            fill={colors[0]}
            fillOpacity={0.6}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
