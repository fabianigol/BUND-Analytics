'use client'

/**
 * InsightBadge - Badge sutil para mostrar insights automáticos
 * Diseño minimalista con tooltip expandido al hover
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, AlertTriangle, Info, Sparkles } from 'lucide-react';

interface InsightBadgeProps {
  type: 'trend' | 'peak' | 'growth' | 'warning' | 'info';
  message: string;
  icon?: React.ReactNode;
  tooltip?: string;
  detail?: string;
}

export function InsightBadge({ type, message, icon, tooltip, detail }: InsightBadgeProps) {
  // Configuración de colores y estilos por tipo
  const config = {
    trend: {
      icon: icon || <TrendingUp className="h-3 w-3" />,
      variant: 'default' as const,
      className: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-700',
    },
    peak: {
      icon: icon || <Sparkles className="h-3 w-3" />,
      variant: 'default' as const,
      className: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    },
    growth: {
      icon: icon || <TrendingUp className="h-3 w-3" />,
      variant: 'default' as const,
      className: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 border-green-300 dark:border-green-700',
    },
    warning: {
      icon: icon || <AlertTriangle className="h-3 w-3" />,
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-700',
    },
    info: {
      icon: icon || <Info className="h-3 w-3" />,
      variant: 'secondary' as const,
      className: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    },
  };
  
  const { icon: defaultIcon, className } = config[type];
  
  const badgeContent = (
    <Badge 
      variant="outline"
      className={`flex items-center gap-1.5 text-xs font-medium transition-all cursor-help ${className}`}
    >
      {defaultIcon}
      <span>{message}</span>
    </Badge>
  );
  
  // Si hay tooltip o detail, envolver en Tooltip
  if (tooltip || detail) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              {tooltip && (
                <p className="text-sm font-medium">{tooltip}</p>
              )}
              {detail && (
                <p className="text-xs text-muted-foreground">{detail}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return badgeContent;
}

/**
 * InsightBadgeGroup - Contenedor para agrupar múltiples badges
 */
export function InsightBadgeGroup({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      )}
      <div className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}
