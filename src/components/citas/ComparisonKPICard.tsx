/**
 * Card KPI con comparación estilo Paid Media
 * Muestra métrica actual, comparativa y cambio porcentual con flechas
 */

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber, formatPercentage } from '@/lib/utils/format';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ComparisonKPICardProps {
  title: string;
  currentValue: number;
  comparativeValue: number | null;
  format?: 'number' | 'percentage' | 'decimal';
  inverse?: boolean; // true si menor es mejor (ej: tasa cancelación)
  subtitle?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  comparativePeriod?: string; // Descripción del periodo comparativo (ej: "Febrero 2024")
}

export function ComparisonKPICard({
  title,
  currentValue,
  comparativeValue,
  format = 'number',
  inverse = false,
  subtitle,
  Icon,
  variant = 'primary',
  comparativePeriod,
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
  
  // Obtener estilos según variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          card: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/30',
          icon: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
        };
      case 'success':
        return {
          card: 'bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200/50 dark:border-green-800/30',
          icon: 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400',
        };
      case 'warning':
        return {
          card: 'bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20 border-yellow-200/50 dark:border-yellow-800/30',
          icon: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400',
        };
      case 'danger':
        return {
          card: 'bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200/50 dark:border-red-800/30',
          icon: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
        };
      case 'info':
        return {
          card: 'bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/30 dark:to-cyan-900/20 border-cyan-200/50 dark:border-cyan-800/30',
          icon: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
        };
      default:
        return {
          card: 'bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200/50 dark:border-blue-800/30',
          icon: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
        };
    }
  };
  
  const variantStyles = getVariantStyles();
  
  return (
    <Card className={`overflow-hidden ${variantStyles.card}`}>
      <CardContent className="px-4 py-3">
        {/* Header con ícono y título */}
        <div className="flex items-center gap-2 mb-2">
          {Icon && (
            <div className={`rounded-lg p-2.5 ${variantStyles.icon}`}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-wide">
              {title}
            </p>
          </div>
        </div>
        
        {/* Valor actual */}
        <div className="mb-1.5">
          <p className="text-3xl font-bold text-foreground">
            {formatValue(currentValue)}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Comparativa y cambio */}
        {hasComparative && (
          <div className="flex items-center gap-2 mt-2">
            {/* Valor comparativo con tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-xs text-muted-foreground cursor-help">
                    vs {formatValue(comparativeValue)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {comparativePeriod || 'Periodo anterior'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
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
          <div className="mt-2 text-xs text-muted-foreground">
            Sin datos comparativos
          </div>
        )}
      </CardContent>
    </Card>
  );
}

