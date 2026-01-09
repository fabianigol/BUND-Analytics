/**
 * Tipos TypeScript para citas históricas
 * Sistema de análisis comparativo de citas 2020-2025
 */

export interface HistoricalAppointment {
  id: number;
  datetime: string; // ISO 8601 timestamp
  client_name: string;
  client_email: string;
  store_city: string;
  appointment_type: 'medicion' | 'fitting';
  event_category: 'regular' | 'tour' | 'videoconsulta' | 'ponte_traje';
  event_type_name_original: string;
  is_cancelled: boolean;
  year: number;
  month: number;
  day_of_week: number; // 0=Domingo, 6=Sábado
  hour: number; // 0-23
  created_at: string;
  updated_at: string;
}

export interface PeriodMetrics {
  period: string; // "2025-01" o "2025-01-01_2025-01-31"
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
  cancellation_rate: number; // Porcentaje
  avg_per_day: number;
  by_store: StoreMetrics[];
}

export interface StoreMetrics {
  store_city: string;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
  cancellation_rate: number;
}

export interface ComparisonMetrics {
  current: PeriodMetrics;
  comparative: PeriodMetrics;
  change: {
    total: ChangeMetric;
    medicion: ChangeMetric;
    fitting: ChangeMetric;
    cancelled: ChangeMetric;
    cancellation_rate: ChangeMetric;
    avg_per_day: ChangeMetric;
  };
}

export interface ChangeMetric {
  value: number; // Cambio absoluto
  percent: number; // Cambio porcentual
  is_better: boolean; // true si la tendencia es positiva
}

export interface MultiYearComparison {
  month: number; // 1-12
  years: {
    [year: string]: PeriodMetrics;
  };
}

export interface PatternData {
  by_day_of_week: DayPattern[];
  by_hour: HourPattern[];
  heatmap: HeatmapData[][];
}

export interface DayPattern {
  day: number; // 0-6
  day_name: string; // "Lunes", "Martes", etc.
  total: number;
  medicion: number;
  fitting: number;
}

export interface HourPattern {
  hour: number; // 0-23
  total: number;
  medicion: number;
  fitting: number;
}

export interface HeatmapData {
  day: number; // 0-6
  hour: number; // 0-23
  count: number;
}

// Filtros para queries
export interface HistoricalFilters {
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  year?: number;
  month?: number; // 1-12
  store_city?: string;
  appointment_type?: 'medicion' | 'fitting';
  event_category?: 'regular' | 'tour' | 'videoconsulta' | 'ponte_traje';
  is_cancelled?: boolean;
}

// Response types
export interface HistoricalStatsResponse {
  filters: HistoricalFilters;
  metrics: PeriodMetrics;
  patterns?: PatternData;
}

export interface CompareResponse {
  current_period: { start: string; end: string };
  comparative_period: { start: string; end: string };
  comparison: ComparisonMetrics;
}

export interface MultiYearResponse {
  month: number;
  years: number[];
  comparisons: MultiYearComparison;
}

