/**
 * Card KPI con comparación estilo Paid Media
 * Muestra métrica actual, comparativa y cambio porcentual con flechas
 */

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber, formatPercentage } from '@/lib/utils/format';

interface ComparisonKPICardProps {
  title: string;
  currentValue: number;
  comparativeValue: number | null;
  format?: 'number' | 'percentage' | 'decimal';
  inverse?: boolean; // true si menor es mejor (ej: tasa cancelación)
  subtitle?: string;
  Icon?: React.ComponentType<{ className?: string }>;
}

export function ComparisonKPICard({
  title,
  currentValue,
  comparativeValue,
  format = 'number',
  inverse = false,
  subtitle,
  Icon,
}: ComparisonKPICardProps) {
  // Calcular cambio
  const hasComparative = comparativeValue !== null && comparativeValue !== undefined;
  const change = hasComparative ? currentValue - comparativeValue : 0;
  const changePercent = hasComparative && comparativeValue !== 0
    ? ((currentValue - comparativeValue) / comparativeValue) * 100
    : 0;
  
  // Determinar si es mejor o peor
  const isPositiveChange = change > 0;
  const isNeutral = change === 0;
  const isBetter = inverse ? !isPositiveChange : isPositiveChange;
  
  // Colores y estilos
  const getChangeColor = () => {
    if (!hasComparative || isNeutral) return 'text-gray-500';
    return isBetter ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
  };
  
  const getChangeBg = () => {
    if (!hasComparative || isNeutral) return 'bg-gray-50 dark:bg-gray-800';
    return isBetter
      ? 'bg-green-50 dark:bg-green-950'
      : 'bg-red-50 dark:bg-red-950';
  };
  
  // Formatear valores
  const formatValue = (value: number) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'decimal':
        return value.toFixed(2);
      default:
        return formatNumber(value);
    }
  };
  
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header con ícono y título */}
        <div className="flex items-center gap-2 mb-3">
          {Icon && (
            <div className="rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-wide">
              {title}
            </p>
          </div>
        </div>
        
        {/* Valor actual */}
        <div className="mb-2">
          <p className="text-3xl font-bold text-foreground">
            {formatValue(currentValue)}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Comparativa y cambio */}
        {hasComparative && (
          <div className="flex items-center gap-2 mt-3">
            {/* Valor comparativo */}
            <div className="text-xs text-muted-foreground">
              vs {formatValue(comparativeValue)}
            </div>
            
            {/* Separador */}
            <div className="h-4 w-px bg-border" />
            
            {/* Cambio porcentual con flecha */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${getChangeBg()}`}>
              {isNeutral ? (
                <Minus className={`h-3 w-3 ${getChangeColor()}`} />
              ) : isBetter ? (
                <TrendingUp className={`h-3 w-3 ${getChangeColor()}`} />
              ) : (
                <TrendingDown className={`h-3 w-3 ${getChangeColor()}`} />
              )}
              <span className={`text-xs font-semibold ${getChangeColor()}`}>
                {isPositiveChange && !isNeutral ? '+' : ''}{changePercent.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
        
        {!hasComparative && (
          <div className="mt-3 text-xs text-muted-foreground">
            Sin datos comparativos
          </div>
        )}
      </CardContent>
    </Card>
  );
}

