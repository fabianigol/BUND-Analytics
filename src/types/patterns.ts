/**
 * Tipos TypeScript extendidos para patrones de citas
 */

import type { DayPattern, HourPattern } from './historical';

export interface SeasonalPattern {
  month: number;
  dayOfWeek: number;
  avgCitas: number;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
  peak: boolean;
  valley: boolean;
}

export interface ComparisonPattern {
  year: number;
  patterns: DayPattern[] | HourPattern[];
  insights: PatternInsight[];
}

export interface StorePattern {
  store: string;
  preferredDays: number[];
  preferredHours: number[];
  peakTime: { day: number; hour: number };
  characteristics: string[];
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
  dayDistribution: { day: number; count: number }[];
  hourDistribution: { hour: number; count: number }[];
}

export interface CancellationPattern {
  dayOfWeek: number;
  hour: number;
  total: number;
  cancelled: number;
  cancellationRate: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PatternInsight {
  type: 'trend' | 'peak' | 'growth' | 'warning' | 'info';
  category: 'day' | 'hour' | 'cancellation' | 'growth' | 'anomaly';
  message: string;
  detail: string;
  data: any;
}

export interface PeakValley {
  dayOfWeek: number;
  hour: number;
  count: number;
  isPeak?: boolean;
  isValley?: boolean;
}

export interface GrowthTrend {
  comparison: string;
  currentYear: number;
  previousYear: number;
  byDay: {
    dayOfWeek: number;
    growth: number;
    currentCount: number;
    previousCount: number;
  }[];
  byHour: {
    hour: number;
    growth: number;
    currentCount: number;
    previousCount: number;
  }[];
}

export interface WeeklyPattern {
  year: number;
  dayOfWeek: number;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
}

export interface HourlyPattern {
  year: number;
  hour: number;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
}

export interface HeatmapCell {
  x: string | number;
  y: string | number;
  value: number;
  label?: string;
}

export interface PatternsResponse {
  filters: {
    years: number[];
    stores: string[] | null;
    patternType: string;
    compareMode: string;
  };
  seasonal?: SeasonalPattern[];
  weekly?: Record<number, WeeklyPattern[]>;
  hourly?: Record<number, HourlyPattern[]>;
  dayHourHeatmap?: { dayOfWeek: number; hour: number; count: number }[];
  storePatterns?: StorePattern[];
  cancellationPatterns?: {
    byDay: CancellationPattern[];
    byHour: CancellationPattern[];
    heatmap: CancellationPattern[];
  };
  peaksAndValleys?: {
    avgPerSlot: number;
    peaks: PeakValley[];
    valleys: PeakValley[];
  };
  growthTrends?: GrowthTrend[];
}

export interface InsightsResponse {
  filters: {
    years: number[];
    stores: string[] | null;
    insightTypes: string[];
  };
  totalInsights: number;
  insights: PatternInsight[];
}
