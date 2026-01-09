'use client'

/**
 * Vista Patrones - Análisis Avanzado de Patrones Temporales
 * 9 secciones completas con insights automáticos
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Loader2,
  Clock,
  TrendingUp,
  Activity,
  MapPin,
  Scissors,
  Ruler,
  XCircle,
  BarChart3,
} from 'lucide-react';
import { LineChart, BarChart } from '@/components/dashboard/Charts';
import { RadialClockChart } from '@/components/citas/RadialClockChart';
import { MultiHeatmap } from '@/components/citas/MultiHeatmap';
import { InsightBadge, InsightBadgeGroup } from '@/components/citas/InsightBadge';
import { PeakValleyIndicator } from '@/components/citas/PeakValleyIndicator';
import { formatNumber } from '@/lib/utils/format';
import type { PatternsResponse, InsightsResponse, PatternInsight } from '@/types/patterns';

interface PatronesViewProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

const availableYears = [2025, 2024, 2023, 2022, 2021];
// Excluir domingo (día 0) - no abrimos los domingos
const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']; // Índices 1-6
const dayNamesShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']; // Índices 1-6
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Configuración de tiendas con colores
const storeConfig: Record<string, string> = {
  'Madrid': '#EF4444',
  'Sevilla': '#F59E0B',
  'Málaga': '#10B981',
  'Barcelona': '#3B82F6',
  'Murcia': '#8B5CF6',
  'Bilbao': '#EC4899',
  'Valencia': '#14B8A6',
  'Zaragoza': '#F97316',
  'CDMX': '#6366F1',
};

export function PatronesView({ selectedMonth, selectedYear, onMonthChange }: PatronesViewProps) {
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [selectedYears, setSelectedYears] = useState([2025, 2024, 2023]);
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'multi-year' | 'single-year'>('multi-year');
  const [singleYear, setSingleYear] = useState(2025);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  
  // Datos de patrones
  const [patternsData, setPatternsData] = useState<PatternsResponse | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsResponse | null>(null);
  
  // Cargar tiendas disponibles
  useEffect(() => {
    loadAvailableStores();
  }, []);
  
  // Cargar datos cuando cambian filtros
  useEffect(() => {
    if (availableStores.length > 0) {
      loadAllData();
    }
  }, [selectedYears, selectedStore, viewMode, singleYear, availableStores]);
  
  const loadAvailableStores = async () => {
    try {
      const response = await fetch(`/api/citas/historical?year=2024`);
      if (response.ok) {
        const data = await response.json();
        const stores = data.metrics.by_store.map((s: any) => s.store_city);
        setAvailableStores(stores);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };
  
  const loadAllData = async () => {
    try {
      setLoading(true);
      
      const yearsToLoad = viewMode === 'multi-year' ? selectedYears : [singleYear];
      const storesParam = selectedStore === 'all' ? 'all' : selectedStore;
      
      // Cargar patrones y insights en paralelo
      const [patternsResponse, insightsResponse] = await Promise.all([
        fetch(`/api/citas/historical/patterns?years=${yearsToLoad.join(',')}&stores=${storesParam}&patternType=all`),
        fetch(`/api/citas/historical/insights?years=${yearsToLoad.join(',')}&stores=${storesParam}&insightTypes=all`),
      ]);
      
      if (patternsResponse.ok) {
        const patterns = await patternsResponse.json();
        setPatternsData(patterns);
      }
      
      if (insightsResponse.ok) {
        const insights = await insightsResponse.json();
        setInsightsData(insights);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle año en selección múltiple
  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 1) {
        setSelectedYears(selectedYears.filter(y => y !== year));
      }
    } else {
      setSelectedYears([...selectedYears, year].sort((a, b) => b - a));
    }
  };
  
  // Calcular total de datos analizados - CORREGIDO
  const totalDataPoints = useMemo(() => {
    if (!patternsData) return 0;
    
    // Sumar desde weekly data
    let total = 0;
    if (patternsData.weekly) {
      selectedYears.forEach(year => {
        const yearData = patternsData.weekly?.[year];
        if (yearData) {
          yearData.forEach((day: any) => {
            total += day.total || 0;
          });
        }
      });
    }
    return total;
  }, [patternsData, selectedYears]);
  
  // Preparar datos para gráficas semanales - CORREGIDO para multi-año (sin domingo)
  const weeklyChartData = useMemo(() => {
    if (!patternsData?.weekly) return [];
    
    const data: any[] = [];
    // Iterar días 1-6 (Lunes a Sábado, sin Domingo)
    dayNames.forEach((dayName, idx) => {
      const actualDayIndex = idx + 1; // +1 porque excluimos domingo (0)
      const point: any = { name: dayNamesShort[idx] };
      
      // Iterar sobre TODOS los años seleccionados
      selectedYears.forEach(year => {
        const yearData = patternsData.weekly?.[year];
        if (yearData) {
          const dayData = yearData.find((d: any) => d.dayOfWeek === actualDayIndex);
          point[`${year}`] = dayData?.total || 0;
        }
      });
      
      data.push(point);
    });
    
    return data;
  }, [patternsData, selectedYears]);
  
  // Preparar datos radiales para días (sin domingo)
  const radialWeeklyData = useMemo(() => {
    if (!patternsData?.weekly || viewMode !== 'single-year') return [];
    
    const yearData = patternsData.weekly?.[singleYear];
    if (!yearData) return [];
    
    return dayNames.map((name, idx) => {
      const actualDayIndex = idx + 1; // +1 porque excluimos domingo (0)
      const dayData = yearData.find((d: any) => d.dayOfWeek === actualDayIndex);
      return {
        label: dayNamesShort[idx],
        value: dayData?.total || 0,
        day: actualDayIndex,
      };
    });
  }, [patternsData, viewMode, singleYear]);
  
  // Preparar datos para gráficas horarias - CORREGIDO para multi-año
  const hourlyChartData = useMemo(() => {
    if (!patternsData?.hourly) return [];
    
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const data: any[] = [];
    
    hours.forEach(hour => {
      const point: any = { name: `${hour}:00` };
      
      // Iterar sobre TODOS los años seleccionados
      selectedYears.forEach(year => {
        const yearData = patternsData.hourly?.[year];
        if (yearData) {
          const hourData = yearData.find((h: any) => h.hour === hour);
          point[`${year}`] = hourData?.total || 0;
        }
      });
      
      data.push(point);
    });
    
    return data;
  }, [patternsData, selectedYears]);
  
  // Preparar datos radiales para horas
  const radialHourlyData = useMemo(() => {
    if (!patternsData?.hourly || viewMode !== 'single-year') return [];
    
    const yearData = patternsData.hourly?.[singleYear];
    if (!yearData) return [];
    
    return yearData.map((h: any) => ({
      label: `${h.hour}:00`,
      value: h.total || 0,
      hour: h.hour,
    }));
  }, [patternsData, viewMode, singleYear]);
  
  // Preparar datos de heatmap día x hora - Solo 8:00 a 23:00, sin domingo
  const dayHourHeatmapData = useMemo(() => {
    if (!patternsData?.dayHourHeatmap) return [];
    
    const total = patternsData.dayHourHeatmap
      .filter(cell => cell.dayOfWeek >= 1 && cell.dayOfWeek <= 6) // Solo Lunes-Sábado
      .filter(cell => cell.hour >= 8 && cell.hour <= 23) // Filtrar madrugada
      .reduce((sum, cell) => sum + cell.count, 0);
    
    return patternsData.dayHourHeatmap
      .filter(cell => cell.dayOfWeek >= 1 && cell.dayOfWeek <= 6) // Solo Lunes-Sábado
      .filter(cell => cell.hour >= 8 && cell.hour <= 23) // Filtrar madrugada
      .map(cell => ({
        x: cell.hour,
        y: dayNamesShort[cell.dayOfWeek - 1], // -1 porque ahora los índices son 1-6
        value: cell.count,
        total: total,
        percentage: total > 0 ? ((cell.count / total) * 100) : 0,
      }));
  }, [patternsData]);
  
  // Preparar datos de cancelaciones - Solo 8:00 a 23:00, sin domingo
  const cancellationHeatmapData = useMemo(() => {
    if (!patternsData?.cancellationPatterns?.heatmap) return [];
    
    const totalCitas = patternsData.cancellationPatterns.heatmap
      .filter(cell => cell.dayOfWeek >= 1 && cell.dayOfWeek <= 6)
      .filter(cell => cell.hour >= 8 && cell.hour <= 23)
      .reduce((sum, cell) => sum + cell.total, 0);
    
    return patternsData.cancellationPatterns.heatmap
      .filter(cell => cell.dayOfWeek >= 1 && cell.dayOfWeek <= 6) // Solo Lunes-Sábado
      .filter(cell => cell.hour >= 8 && cell.hour <= 23) // Filtrar madrugada
      .map(cell => ({
        x: cell.hour,
        y: dayNamesShort[cell.dayOfWeek - 1], // -1 porque ahora los índices son 1-6
        value: cell.cancellationRate,
        total: cell.total,
        cancelled: cell.cancelled,
        totalCitas: totalCitas,
        percentage: totalCitas > 0 ? ((cell.total / totalCitas) * 100) : 0,
      }));
  }, [patternsData]);
  
  // Top insights por categoría
  const topInsights = useMemo(() => {
    if (!insightsData?.insights) return [];
    return insightsData.insights.slice(0, 8);
  }, [insightsData]);
  
  if (loading && !patternsData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* ========== HEADER & CONTROLES ========== */}
      <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-900/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex flex-col gap-6">
            {/* Título y badges informativos */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Activity className="h-6 w-6 text-purple-600" />
                  Análisis de Patrones
                </CardTitle>
                <CardDescription>
                  Descubre cuándo y cómo tus clientes prefieren agendar citas
                </CardDescription>
                
                {/* Badges informativos */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatNumber(totalDataPoints)} citas analizadas
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {selectedYears.length} {selectedYears.length === 1 ? 'año' : 'años'}
                  </Badge>
                  {selectedStore !== 'all' && (
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{ 
                        borderColor: storeConfig[selectedStore],
                        color: storeConfig[selectedStore],
                      }}
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      {selectedStore}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Selector de tienda */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">Tienda:</label>
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-[200px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las tiendas</SelectItem>
                    {availableStores.map(store => (
                      <SelectItem key={store} value={store}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: storeConfig[store] }}
                          />
                          {store}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Controles de vista y años en línea */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">
                Modo de análisis:
              </span>
              <div className="flex flex-wrap items-center gap-4">
                {/* Toggle modo de vista */}
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'multi-year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('multi-year')}
                  >
                    Multi-anual (Comparativo)
                  </Button>
                  <Button
                    variant={viewMode === 'single-year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('single-year')}
                  >
                    Año único (Detallado)
                  </Button>
                </div>
                
                {/* Selector de años en la misma línea */}
                {viewMode === 'multi-year' && (
                  <>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Años a comparar:</span>
                    <div className="flex flex-wrap gap-2">
                      {availableYears.map(year => (
                        <Button
                          key={year}
                          variant={selectedYears.includes(year) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleYear(year)}
                        >
                          {year}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
                
                {viewMode === 'single-year' && (
                  <>
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Año a analizar:</span>
                    <div className="flex gap-2">
                      {availableYears.map(year => (
                        <Button
                          key={year}
                          variant={singleYear === year ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSingleYear(year)}
                        >
                          {year}
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* ========== SECCIÓN 1: INSIGHTS DESTACADOS ========== */}
      {topInsights.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-900/20 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💡 Insights Destacados
            </CardTitle>
            <CardDescription>
              Descubrimientos automáticos sobre tus patrones de citas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InsightBadgeGroup>
              {topInsights.map((insight, idx) => (
                <InsightBadge
                  key={idx}
                  type={insight.type}
                  message={insight.message}
                  tooltip={insight.message}
                  detail={insight.detail}
                />
              ))}
            </InsightBadgeGroup>
          </CardContent>
        </Card>
      )}
      
      {/* ========== SECCIÓN 2: PICOS Y VALLES DE DEMANDA ========== */}
      {patternsData?.peaksAndValleys && (
        <PeakValleyIndicator
          peaks={patternsData.peaksAndValleys.peaks}
          valleys={patternsData.peaksAndValleys.valleys}
          avgValue={patternsData.peaksAndValleys.avgPerSlot}
          title="Picos y Valles de Demanda"
          showTop={5}
        />
      )}
      
      {/* ========== SECCIÓN 3: PATRONES POR TIPO DE CITA ========== */}
      {patternsData?.weekly && Object.keys(patternsData.weekly).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-green-600 mr-1" />
              <Ruler className="h-5 w-5 text-blue-600" />
              Patrones por Tipo de Cita
            </CardTitle>
            <CardDescription>
              Comparación entre Medición y Fitting (agregado de años seleccionados)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              {/* Medición */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-blue-600" />
                  Medición
                </h4>
                <BarChart
                  title=""
                  data={dayNames.map((name, idx) => {
                    let totalMedicion = 0;
                    const actualDayIndex = idx + 1; // +1 porque excluimos domingo (0)
                    
                    // Sumar mediciones de TODOS los años seleccionados
                    selectedYears.forEach(year => {
                      const yearData = patternsData.weekly?.[year];
                      if (yearData) {
                        const dayData = yearData.find((d: any) => d.dayOfWeek === actualDayIndex);
                        totalMedicion += dayData?.medicion || 0;
                      }
                    });
                    
                    return {
                      name: dayNamesShort[idx],
                      value: totalMedicion,
                    };
                  })}
                  formatValue={(v) => formatNumber(v)}
                  height={250}
                  color="#3B82F6"
                />
              </div>
              
              {/* Fitting */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-green-600" />
                  Fitting
                </h4>
                <BarChart
                  title=""
                  data={dayNames.map((name, idx) => {
                    let totalFitting = 0;
                    const actualDayIndex = idx + 1; // +1 porque excluimos domingo (0)
                    
                    // Sumar fittings de TODOS los años seleccionados
                    selectedYears.forEach(year => {
                      const yearData = patternsData.weekly?.[year];
                      if (yearData) {
                        const dayData = yearData.find((d: any) => d.dayOfWeek === actualDayIndex);
                        totalFitting += dayData?.fitting || 0;
                      }
                    });
                    
                    return {
                      name: dayNamesShort[idx],
                      value: totalFitting,
                    };
                  })}
                  formatValue={(v) => formatNumber(v)}
                  height={250}
                  color="#10B981"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* ========== SECCIÓN 4: COMPARATIVA HORARIA ========== */}
      {patternsData?.hourly && Object.keys(patternsData.hourly).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              Comparativa Horaria
            </CardTitle>
            <CardDescription>
              Distribución de citas por hora del día
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              title=""
              data={hourlyChartData}
              xAxisKey="name"
              lines={selectedYears.map((year, idx) => ({
                dataKey: `${year}`,
                name: year.toString(),
                color: ['#8B0000', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][idx % 5],
              }))}
              formatValue={(v) => formatNumber(v)}
              height={350}
            />
          </CardContent>
        </Card>
      )}
      
      {/* ========== SECCIÓN 5: PATRONES POR TIENDA ========== */}
      {patternsData?.storePatterns && patternsData.storePatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              Patrones por Tienda
            </CardTitle>
            <CardDescription>
              Días y horarios preferidos de cada tienda
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Tienda</th>
                    <th className="text-center p-2 font-medium">Total Citas</th>
                    <th className="text-center p-2 font-medium">Días Preferidos</th>
                    <th className="text-center p-2 font-medium">Horas Pico</th>
                    <th className="text-center p-2 font-medium">Hora Máxima</th>
                  </tr>
                </thead>
                <tbody>
                  {patternsData.storePatterns.map((store, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: storeConfig[store.store] }}
                        />
                        {store.store}
                      </td>
                      <td className="p-2 text-center">{formatNumber(store.total)}</td>
                      <td className="p-2 text-center text-xs">
                        {store.preferredDays.filter(d => d >= 1 && d <= 6).map(d => dayNamesShort[d - 1]).join(', ')}
                      </td>
                      <td className="p-2 text-center text-xs">
                        {store.preferredHours.map(h => `${h}:00`).join(', ')}
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="secondary" className="text-xs">
                          {store.peakTime.day >= 1 && store.peakTime.day <= 6 ? dayNamesShort[store.peakTime.day - 1] : '-'} {store.peakTime.hour}:00
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* ========== SECCIÓN 6: MOMENTOS CON ALTA CANCELACIÓN ========== */}
      {patternsData?.cancellationPatterns?.heatmap && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Momentos con Alta Cancelación
            </CardTitle>
            <CardDescription>
              Horarios que requieren atención especial (excluye domingos cerrados)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patternsData.cancellationPatterns.heatmap
                .filter(c => c.dayOfWeek !== 0) // Excluir domingo (día 0)
                .filter(c => (c.severity === 'critical' || c.severity === 'high') && c.total >= 5)
                .slice(0, 10)
                .map((cancel, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <div>
                        <p className="font-medium text-sm">
                          {dayNames[cancel.dayOfWeek - 1]} a las {cancel.hour}:00
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {cancel.cancelled} de {cancel.total} citas
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="destructive"
                      className={cancel.severity === 'critical' ? 'bg-red-600' : 'bg-orange-500'}
                    >
                      {cancel.cancellationRate.toFixed(1)}% cancelación
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* ========== SECCIÓN 7: TENDENCIAS DE EVOLUCIÓN ========== */}
      {patternsData?.growthTrends && patternsData.growthTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Tendencias de Evolución
            </CardTitle>
            <CardDescription>
              Cómo han cambiado los patrones año tras año
            </CardDescription>
          </CardHeader>
          <CardContent>
            {patternsData.growthTrends.map((trend, idx) => (
              <div key={idx} className="mb-8 last:mb-0 border-b pb-6 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-lg">{trend.comparison}</h4>
                  <Badge variant="outline">
                    {trend.byDay.reduce((sum, d) => sum + d.currentCount, 0).toLocaleString()} citas
                    en {trend.currentYear} vs {trend.byDay.reduce((sum, d) => sum + d.previousCount, 0).toLocaleString()} 
                    en {trend.previousYear}
                  </Badge>
                </div>
                
                <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mt-4">
                  {/* Crecimiento por día */}
                  <div>
                    <h5 className="text-sm font-medium text-muted-foreground mb-3">Por día de semana</h5>
                    <BarChart
                      title=""
                      data={trend.byDay
                        .filter(d => d.dayOfWeek >= 1 && d.dayOfWeek <= 6) // Solo Lunes-Sábado
                        .map(d => ({
                          name: dayNamesShort[d.dayOfWeek - 1], // -1 porque excluimos domingo
                          value: d.growth,
                        }))}
                      formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                      height={250}
                      color={trend.byDay.some(d => d.growth > 0) ? '#10B981' : '#EF4444'}
                    />
                    <div className="mt-2 text-xs text-muted-foreground">
                      Promedio: {(trend.byDay.reduce((sum, d) => sum + d.growth, 0) / trend.byDay.length).toFixed(1)}% de crecimiento
                    </div>
                  </div>
                  
                  {/* Crecimiento por hora - Top 10 cambios */}
                  <div>
                    <h5 className="text-sm font-medium text-muted-foreground mb-3">Por hora del día (top 10 cambios)</h5>
                    <BarChart
                      title=""
                      data={trend.byHour
                        .sort((a, b) => Math.abs(b.growth) - Math.abs(a.growth))
                        .slice(0, 10)
                        .map(h => ({
                          name: `${h.hour}:00`,
                          value: h.growth,
                        }))}
                      formatValue={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
                      height={250}
                      color="#3B82F6"
                    />
                    <div className="mt-2 text-xs text-muted-foreground">
                      Mayor cambio: {Math.max(...trend.byHour.map(h => Math.abs(h.growth))).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      
      {/* ========== SECCIÓN 8: PATRONES SEMANALES ========== */}
      {patternsData?.weekly && Object.keys(patternsData.weekly).length > 0 && (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Gráfica radial (solo en modo año único) */}
          {viewMode === 'single-year' && radialWeeklyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Distribución Semanal Radial
                </CardTitle>
                <CardDescription>
                  Vista circular de citas por día ({singleYear})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadialClockChart
                  data={radialWeeklyData}
                  type="weekly"
                  colors={['#3B82F6', '#8B0000']}
                  height={350}
                />
              </CardContent>
            </Card>
          )}
          
          {/* Barras comparativas */}
          <Card className={viewMode === 'single-year' ? '' : 'lg:col-span-2'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Comparativa Semanal
              </CardTitle>
              <CardDescription>
                Citas por día de la semana comparadas entre años
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LineChart
                title=""
                data={weeklyChartData}
                xAxisKey="name"
                lines={selectedYears.map((year, idx) => ({
                  dataKey: `${year}`,
                  name: year.toString(),
                  color: ['#8B0000', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][idx % 5],
                }))}
                formatValue={(v) => formatNumber(v)}
                height={350}
              />
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* ========== SECCIÓN 9: PATRONES HORARIOS DETALLADOS (Heatmap + Radial) ========== */}
      {patternsData?.hourly && Object.keys(patternsData.hourly).length > 0 && (
        <div className="space-y-6">
          {/* Heatmap día x hora */}
          {dayHourHeatmapData.length > 0 && (
            <MultiHeatmap
              data={dayHourHeatmapData}
              xLabel="Hora"
              yLabel="Día"
              title="Mapa de Calor: Día × Hora"
              description="Concentración de citas por día de la semana y hora del día"
              annotations={false}
              formatValue={(v) => formatNumber(v)}
              colorScale={['#ffffff', '#fef3c7', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e']}
            />
          )}
          
          {/* Gráfica radial horaria (solo en modo año único) */}
          {viewMode === 'single-year' && radialHourlyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  Distribución Horaria Radial
                </CardTitle>
                <CardDescription>
                  Reloj de 24h mostrando intensidad ({singleYear})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadialClockChart
                  data={radialHourlyData}
                  type="hourly"
                  colors={['#F59E0B', '#EF4444']}
                  height={350}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {/* ========== SECCIÓN 10: HEATMAP TASA DE CANCELACIÓN ========== */}
      {cancellationHeatmapData.length > 0 && (
        <MultiHeatmap
          data={cancellationHeatmapData}
          xLabel="Hora"
          yLabel="Día"
          title="Mapa de Calor: Tasa de Cancelación"
          description="Porcentaje de cancelaciones por día y hora"
          annotations={false}
          formatValue={(v) => `${v.toFixed(1)}%`}
          colorScale={['#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534']}
        />
      )}
      
      {/* Mensaje si no hay datos */}
      {!patternsData && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay datos disponibles para los filtros seleccionados</p>
            <p className="text-sm mt-2">Intenta seleccionar diferentes años o tiendas</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
