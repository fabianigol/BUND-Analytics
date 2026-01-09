'use client'

/**
 * Vista Por Tienda - Análisis Profundo Individual
 * Sub-tab 2 de Comparativas Históricas
 * 
 * Versión renovada con visualizaciones avanzadas y diseño moderno
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonKPICard } from '@/components/citas/ComparisonKPICard';
import { HeatmapChart } from '@/components/citas/HeatmapChart';
import { StoreRankingCard } from '@/components/citas/StoreRankingCard';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Ruler, 
  Scissors, 
  XCircle, 
  TrendingUp,
  Loader2, 
  ChevronDown, 
  ChevronRight,
  Building2,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react';
import { LineChart, BarChart } from '@/components/dashboard/Charts';
import { formatNumber } from '@/lib/utils/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface TiendaViewProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

interface MonthlyData {
  year: number;
  month: number;
  period: string;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
}

interface AnnualData {
  year: number;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
  cancellation_rate: number;
  avg_per_day: number;
}

interface StoreRank {
  store_city: string;
  total_citas: number;
  cancellation_rate: number;
  growth_rate: number;
}

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

const availableYears = [2025, 2024, 2023, 2022, 2021];
const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function TiendaView({ selectedMonth, selectedYear, onMonthChange }: TiendaViewProps) {
  // Estado principal
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('Madrid');
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  
  // Estado de años a comparar - TODOS seleccionados por defecto
  const [selectedYearsCompare, setSelectedYearsCompare] = useState([2025, 2024, 2023, 2022, 2021]);
  const [selectedYearForMonthly, setSelectedYearForMonthly] = useState(2025);
  
  // Estado para el ranking
  const [rankingMode, setRankingMode] = useState<'year' | 'historic'>('year');
  const [rankingYear, setRankingYear] = useState(2025);
  
  // Datos de la tienda
  const [storeMonthlyData, setStoreMonthlyData] = useState<MonthlyData[]>([]);
  const [storeAnnualData, setStoreAnnualData] = useState<Record<number, AnnualData>>({});
  const [currentYearData, setCurrentYearData] = useState<any>(null);
  const [previousYearData, setPreviousYearData] = useState<any>(null);
  
  // Datos para ranking
  const [allStoresRankings, setAllStoresRankings] = useState<StoreRank[]>([]);
  const [historicRankings, setHistoricRankings] = useState<StoreRank[]>([]);
  
  // Estado de expansión de tabla
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  
  // Cargar tiendas disponibles al montar
  useEffect(() => {
    loadAvailableStores();
  }, []);
  
  // Cargar datos cuando cambia tienda o período
  useEffect(() => {
    if (availableStores.length > 0) {
      loadAllData();
    }
  }, [selectedStore, selectedMonth, selectedYear, selectedYearsCompare, rankingYear, availableStores]);
  
  // Cargar datos mensuales cuando cambia el año seleccionado
  useEffect(() => {
    if (selectedStore) {
      loadMonthlyDataForYear(selectedYearForMonthly);
    }
  }, [selectedYearForMonthly, selectedStore]);
  
  // Recargar rankings cuando cambia el modo o año de ranking
  useEffect(() => {
    if (rankingMode === 'year' && allStoresRankings.length === 0) {
      loadAllData();
    } else if (rankingMode === 'historic' && historicRankings.length === 0) {
      loadHistoricRankings();
    }
  }, [rankingMode, rankingYear]);
  
  // Función para cargar tiendas disponibles
  const loadAvailableStores = async () => {
    try {
      const response = await fetch(`/api/citas/historical?year=2024`);
      if (response.ok) {
        const data = await response.json();
        const stores = data.metrics.by_store.map((s: any) => s.store_city);
        setAvailableStores(stores);
        
        // Seleccionar Madrid por defecto si está disponible
        if (stores.includes('Madrid')) {
          setSelectedStore('Madrid');
        } else if (stores.length > 0) {
          setSelectedStore(stores[0]);
        }
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };
  
  // Función para cargar todos los datos en paralelo
  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Cargar datos en paralelo usando Promise.all
      const [
        monthlyDataResponse,
        annualDataResponse,
        compareDataResponse,
        allStoresDataResponse,
      ] = await Promise.all([
        // 1. Datos mensuales de la tienda (todos los años seleccionados)
        fetch(`/api/citas/historical/by-store?years=${selectedYearsCompare.join(',')}&grouping=monthly`),
        
        // 2. Datos anuales de la tienda
        fetch(`/api/citas/historical/by-store?years=${selectedYearsCompare.join(',')}&grouping=annual`),
        
        // 3. Datos comparativos para el mes seleccionado
        fetch(`/api/citas/historical/compare?years=${selectedYearsCompare.join(',')}&month=${selectedMonth}&storeCity=${selectedStore}`),
        
        // 4. Datos de todas las tiendas para ranking
        fetch(`/api/citas/historical/by-store?years=${rankingYear}&grouping=annual`),
      ]);
      
      // Procesar datos mensuales
      if (monthlyDataResponse.ok) {
        const monthlyResult = await monthlyDataResponse.json();
        const storeData = monthlyResult.data[selectedStore] || [];
        setStoreMonthlyData(storeData);
      }
      
      // Procesar datos anuales
      if (annualDataResponse.ok) {
        const annualResult = await annualDataResponse.json();
        const storeData = annualResult.data[selectedStore] || [];
        
        // Convertir array a objeto indexado por año
        const annualByYear: Record<number, AnnualData> = {};
        storeData.forEach((data: any) => {
          annualByYear[data.year] = {
            year: data.year,
            total: data.total,
            medicion: data.medicion,
            fitting: data.fitting,
            cancelled: data.cancelled,
            cancellation_rate: data.cancelled > 0 ? (data.cancelled / data.total) * 100 : 0,
            avg_per_day: data.total / 365, // Aproximación
          };
        });
        
        setStoreAnnualData(annualByYear);
      }
      
      // Procesar datos comparativos para KPIs
      if (compareDataResponse.ok) {
        const compareResult = await compareDataResponse.json();
        const years = compareResult.comparison.years;
        setCurrentYearData(years[selectedYear]);
        setPreviousYearData(years[selectedYear - 1]);
      }
      
      // Procesar datos de todas las tiendas para ranking
      if (allStoresDataResponse.ok) {
        const allStoresResult = await allStoresDataResponse.json();
        const rankings: StoreRank[] = [];
        
        Object.entries(allStoresResult.data).forEach(([storeName, storeData]: [string, any]) => {
          const currentYearData = storeData.find((d: any) => d.year === rankingYear);
          const previousYearData = storeData.find((d: any) => d.year === rankingYear - 1);
          
          if (currentYearData) {
            const growthRate = previousYearData && previousYearData.total > 0
              ? ((currentYearData.total - previousYearData.total) / previousYearData.total) * 100
              : 0;
            
            rankings.push({
              store_city: storeName,
              total_citas: currentYearData.total,
              cancellation_rate: currentYearData.total > 0
                ? (currentYearData.cancelled / currentYearData.total) * 100
                : 0,
              growth_rate: growthRate,
            });
          }
        });
        
        setAllStoresRankings(rankings);
      }
      
      // También cargar datos históricos totales para el ranking
      loadHistoricRankings();
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Función para cargar datos mensuales de un año específico
  const loadMonthlyDataForYear = async (year: number) => {
    try {
      const response = await fetch(
        `/api/citas/historical/by-store?years=${year}&grouping=monthly`
      );
      
      if (response.ok) {
        const result = await response.json();
        const storeData = result.data[selectedStore] || [];
        setStoreMonthlyData(storeData);
      }
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };
  
  // Función para cargar rankings históricos totales
  const loadHistoricRankings = async () => {
    try {
      // Cargar todos los años disponibles
      const response = await fetch(
        `/api/citas/historical/by-store?years=${availableYears.join(',')}&grouping=annual`
      );
      
      if (response.ok) {
        const result = await response.json();
        const rankings: StoreRank[] = [];
        
        Object.entries(result.data).forEach(([storeName, storeData]: [string, any]) => {
          // Sumar totales de todos los años
          const totalHistorico = storeData.reduce((sum: number, d: any) => sum + d.total, 0);
          const totalCancelled = storeData.reduce((sum: number, d: any) => sum + d.cancelled, 0);
          
          // Calcular crecimiento del último año disponible vs anterior
          const lastYearData = storeData.find((d: any) => d.year === 2025);
          const prevYearData = storeData.find((d: any) => d.year === 2024);
          
          const growthRate = lastYearData && prevYearData && prevYearData.total > 0
            ? ((lastYearData.total - prevYearData.total) / prevYearData.total) * 100
            : 0;
          
          rankings.push({
            store_city: storeName,
            total_citas: totalHistorico,
            cancellation_rate: totalHistorico > 0 ? (totalCancelled / totalHistorico) * 100 : 0,
            growth_rate: growthRate,
          });
        });
        
        setHistoricRankings(rankings);
      }
    } catch (error) {
      console.error('Error loading historic rankings:', error);
    }
  };
  
  // Toggle selección de año
  const toggleYear = (year: number) => {
    if (selectedYearsCompare.includes(year)) {
      if (selectedYearsCompare.length > 1) {
        setSelectedYearsCompare(selectedYearsCompare.filter(y => y !== year));
      }
    } else {
      setSelectedYearsCompare([...selectedYearsCompare, year].sort((a, b) => b - a));
    }
  };
  
  // Toggle expansión de año en tabla
  const toggleYearExpansion = (year: number) => {
    const newExpanded = new Set(expandedYears);
    if (expandedYears.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
    }
    setExpandedYears(newExpanded);
  };
  
  const getMonthName = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long' });
  };
  
  // Color de la tienda seleccionada
  const storeColor = storeConfig[selectedStore] || '#3B82F6';
  
  // Calcular total histórico de la tienda (desde 2021)
  const totalHistorico = useMemo(() => {
    return Object.values(storeAnnualData).reduce((sum, data) => sum + data.total, 0);
  }, [storeAnnualData]);
  
  // Calcular posición correcta en el ranking
  const currentRankingPosition = useMemo(() => {
    const rankings = rankingMode === 'historic' ? historicRankings : allStoresRankings;
    
    if (rankings.length === 0) return null;
    
    // Ordenar por total de citas (mayor a menor)
    const sorted = [...rankings].sort((a, b) => b.total_citas - a.total_citas);
    const position = sorted.findIndex(r => r.store_city === selectedStore) + 1;
    
    return position > 0 ? position : null;
  }, [allStoresRankings, historicRankings, selectedStore, rankingMode]);
  
  // Preparar datos para gráfica de evolución mensual
  const monthlyEvolutionData = useMemo(() => {
    const yearData = storeMonthlyData.filter(d => d.year === selectedYearForMonthly);
    
    return months.map((monthName, idx) => {
      const monthNum = idx + 1;
      const data = yearData.find(d => d.month === monthNum);
      
      return {
        name: monthName,
        Total: data?.total || 0,
        Medición: data?.medicion || 0,
        Fitting: data?.fitting || 0,
      };
    });
  }, [storeMonthlyData, selectedYearForMonthly]);
  
  // Preparar datos para comparación multi-anual
  const annualComparisonData = useMemo(() => {
    return selectedYearsCompare
      .sort((a, b) => a - b)
      .map(year => ({
        name: year.toString(),
        Medición: storeAnnualData[year]?.medicion || 0,
        Fitting: storeAnnualData[year]?.fitting || 0,
        Total: storeAnnualData[year]?.total || 0,
      }));
  }, [selectedYearsCompare, storeAnnualData]);
  
  // Preparar datos para desglose por tipo (porcentajes)
  const typeBreakdownData = useMemo(() => {
    return selectedYearsCompare
      .sort((a, b) => a - b)
      .map(year => {
        const data = storeAnnualData[year];
        if (!data) {
          return {
            name: year.toString(),
            'Medición %': 0,
            'Fitting %': 0,
          };
        }
        
        // Calcular porcentajes solo sobre citas completadas (medicion + fitting)
        // No incluir canceladas en el denominador
        const completedAppointments = data.medicion + data.fitting;
        
        if (completedAppointments === 0) {
          return {
            name: year.toString(),
            'Medición %': 0,
            'Fitting %': 0,
          };
        }
        
        return {
          name: year.toString(),
          'Medición %': (data.medicion / completedAppointments) * 100,
          'Fitting %': (data.fitting / completedAppointments) * 100,
        };
      });
  }, [selectedYearsCompare, storeAnnualData]);
  
  // Preparar datos para heatmap
  const heatmapData = useMemo(() => {
    const data: { year: number; month: number; value: number }[] = [];
    
    selectedYearsCompare.forEach(year => {
      for (let month = 1; month <= 12; month++) {
        const monthData = storeMonthlyData.find(
          d => d.year === year && d.month === month
        );
        
        data.push({
          year,
          month,
          value: monthData?.total || 0,
        });
      }
    });
    
    return data;
  }, [storeMonthlyData, selectedYearsCompare]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* SECCIÓN 1: Header Mejorado con Info Contextual */}
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-950/30 dark:to-slate-900/20 border-slate-200 dark:border-slate-800">
        <CardHeader>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              {/* Info de la tienda */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div 
                    className="rounded-lg p-2.5 bg-background"
                    style={{ borderLeft: `4px solid ${storeColor}` }}
                  >
                    <Building2 className="h-6 w-6" style={{ color: storeColor }} />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{selectedStore}</CardTitle>
                    <CardDescription>Análisis profundo de desempeño histórico</CardDescription>
                  </div>
                </div>
                
                {/* Badges de información */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="secondary" className="text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatNumber(totalHistorico)} citas totales
                  </Badge>
                  {currentRankingPosition && (
                    <Badge variant="outline" className="text-xs">
                      #{currentRankingPosition} en ranking ({rankingMode === 'historic' ? 'histórico' : rankingYear})
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs" style={{ borderColor: storeColor, color: storeColor }}>
                    {selectedYearsCompare.length} años comparados
                  </Badge>
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
                    {availableStores.map(store => (
                      <SelectItem key={store} value={store}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: storeConfig[store] || '#3B82F6' }}
                          />
                          {store}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Selector de años a comparar */}
            <div>
              <span className="text-sm font-medium text-muted-foreground mb-2 block">
                Años a comparar:
              </span>
              <div className="flex flex-wrap gap-2">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={selectedYearsCompare.includes(year) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleYear(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* SECCIÓN 2: KPI Cards Comparativos */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ComparisonKPICard
          title="Total Citas"
          currentValue={currentYearData?.total || 0}
          comparativeValue={previousYearData?.total || null}
          Icon={Calendar}
          subtitle={`${getMonthName(selectedMonth)} ${selectedYear}`}
          variant="primary"
          comparativePeriod={`${getMonthName(selectedMonth)} ${selectedYear - 1}`}
        />
        
        <ComparisonKPICard
          title="Medición"
          currentValue={currentYearData?.medicion || 0}
          comparativeValue={previousYearData?.medicion || null}
          Icon={Ruler}
          variant="info"
          comparativePeriod={`${getMonthName(selectedMonth)} ${selectedYear - 1}`}
        />
        
        <ComparisonKPICard
          title="Fitting"
          currentValue={currentYearData?.fitting || 0}
          comparativeValue={previousYearData?.fitting || null}
          Icon={Scissors}
          variant="success"
          comparativePeriod={`${getMonthName(selectedMonth)} ${selectedYear - 1}`}
        />
        
        <ComparisonKPICard
          title="Tasa Cancelación"
          currentValue={currentYearData?.cancellation_rate || 0}
          comparativeValue={previousYearData?.cancellation_rate || null}
          format="percentage"
          inverse={true}
          Icon={XCircle}
          variant="danger"
          comparativePeriod={`${getMonthName(selectedMonth)} ${selectedYear - 1}`}
        />
        
        <ComparisonKPICard
          title="Canceladas"
          currentValue={currentYearData?.cancelled || 0}
          comparativeValue={previousYearData?.cancelled || null}
          inverse={true}
          variant="warning"
          comparativePeriod={`${getMonthName(selectedMonth)} ${selectedYear - 1}`}
        />
        
        <ComparisonKPICard
          title="Promedio/Día"
          currentValue={currentYearData?.avg_per_day || 0}
          comparativeValue={previousYearData?.avg_per_day || null}
          format="decimal"
          Icon={TrendingUp}
          variant="primary"
          comparativePeriod={`${getMonthName(selectedMonth)} ${selectedYear - 1}`}
        />
      </div>
      
      {/* SECCIÓN 3: Ranking de Tiendas */}
      {(allStoresRankings.length > 0 || historicRankings.length > 0) && (
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-950/30 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <div className="flex flex-col gap-4">
              {/* Título y controles en la misma línea */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="flex items-center gap-2">
                    🏆 Ranking de Tiendas
                  </CardTitle>
                  <CardDescription className="hidden lg:block">
                    · Posición de {selectedStore} según total de citas
                  </CardDescription>
                </div>
                
                {/* Toggle y selector en la misma línea */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={rankingMode === 'year' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRankingMode('year')}
                  >
                    Por Año
                  </Button>
                  <Button
                    variant={rankingMode === 'historic' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRankingMode('historic')}
                  >
                    Histórico Total
                  </Button>
                  
                  {/* Separador vertical */}
                  {rankingMode === 'year' && (
                    <div className="h-6 w-px bg-border mx-1" />
                  )}
                  
                  {/* Selector de año (solo visible en modo 'year') */}
                  {rankingMode === 'year' && (
                    <>
                      {availableYears.map(year => (
                        <Button
                          key={year}
                          variant={rankingYear === year ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setRankingYear(year)}
                        >
                          {year}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
              </div>
              
              {/* Descripción solo en móvil */}
              <CardDescription className="lg:hidden">
                Posición de {selectedStore} según total de citas
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <StoreRankingCard
              selectedStore={selectedStore}
              rankings={rankingMode === 'historic' ? historicRankings : allStoresRankings}
              metric="total_citas"
              year={rankingMode === 'historic' ? undefined : rankingYear}
            />
          </CardContent>
        </Card>
      )}
      
      {/* SECCIÓN 4: Evolución Mensual */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" style={{ color: storeColor }} />
                Evolución Mensual
              </CardTitle>
              <CardDescription>
                Tendencia de citas mes a mes para {selectedStore}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Año:</span>
              <div className="flex gap-1">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={selectedYearForMonthly === year ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedYearForMonthly(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LineChart
            title=""
            data={monthlyEvolutionData}
            xAxisKey="name"
            lines={[
              { dataKey: 'Total', name: 'Total', color: storeColor },
              { dataKey: 'Medición', name: 'Medición', color: '#3B82F6' },
              { dataKey: 'Fitting', name: 'Fitting', color: '#10B981' },
            ]}
            formatValue={(v) => formatNumber(v)}
            height={400}
          />
        </CardContent>
      </Card>
      
      {/* SECCIÓN 5 & 6: Grid de Comparación Anual y Desglose por Tipo */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Comparación Multi-Anual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: storeColor }} />
              Comparación Anual
            </CardTitle>
            <CardDescription>
              Citas por tipo a través de los años
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              title=""
              data={annualComparisonData}
              xAxisKey="name"
              lines={[
                { dataKey: 'Total', name: 'Total', color: storeColor },
                { dataKey: 'Medición', name: 'Medición', color: '#3B82F6' },
                { dataKey: 'Fitting', name: 'Fitting', color: '#10B981' },
              ]}
              formatValue={(v) => formatNumber(v)}
              height={350}
            />
          </CardContent>
        </Card>
        
        {/* Desglose por Tipo (Porcentajes) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" style={{ color: storeColor }} />
              Proporción por Tipo
            </CardTitle>
            <CardDescription>
              Distribución porcentual Medición vs Fitting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              title=""
              data={typeBreakdownData}
              xAxisKey="name"
              lines={[
                { dataKey: 'Medición %', name: 'Medición', color: '#3B82F6' },
                { dataKey: 'Fitting %', name: 'Fitting', color: '#10B981' },
              ]}
              formatValue={(v) => `${v.toFixed(1)}%`}
              height={350}
            />
          </CardContent>
        </Card>
      </div>
      
      {/* SECCIÓN 7: Heatmap Estacional */}
      <HeatmapChart
        data={heatmapData}
        title="Mapa de Calor Estacional"
        description={`Patrones de volumen de citas por mes para ${selectedStore}`}
        baseColor={storeColor}
      />
      
      {/* SECCIÓN 8: Tabla Expandible Detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle Histórico por Año</CardTitle>
          <CardDescription>
            Haz clic en un año para ver el desglose mensual completo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Año / Mes</th>
                  <th className="text-right p-2 font-medium">Total</th>
                  <th className="text-right p-2 font-medium">Medición</th>
                  <th className="text-right p-2 font-medium">Fitting</th>
                  <th className="text-right p-2 font-medium">Canceladas</th>
                  <th className="text-right p-2 font-medium">% Cancel.</th>
                  <th className="text-right p-2 font-medium">Prom/Día</th>
                </tr>
              </thead>
              <tbody>
                {selectedYearsCompare.sort((a, b) => b - a).map(year => {
                  const annualData = storeAnnualData[year];
                  const isExpanded = expandedYears.has(year);
                  const monthlyData = storeMonthlyData.filter(d => d.year === year);
                  
                  if (!annualData) {
                    return (
                      <tr key={year} className="border-b">
                        <td className="p-2 font-semibold">{year}</td>
                        <td colSpan={6} className="p-2 text-center text-muted-foreground">
                          Sin datos para este año
                        </td>
                      </tr>
                    );
                  }
                  
                  return (
                    <React.Fragment key={year}>
                      {/* Fila del año (totales anuales) */}
                      <tr 
                        className="border-b bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => toggleYearExpansion(year)}
                      >
                        <td className="p-2 font-semibold">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span>{year}</span>
                          </div>
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatNumber(annualData.total)}
                        </td>
                        <td className="p-2 text-right">
                          {formatNumber(annualData.medicion)}
                        </td>
                        <td className="p-2 text-right">
                          {formatNumber(annualData.fitting)}
                        </td>
                        <td className="p-2 text-right">
                          {formatNumber(annualData.cancelled)}
                        </td>
                        <td className="p-2 text-right">
                          {annualData.cancellation_rate.toFixed(1)}%
                        </td>
                        <td className="p-2 text-right">
                          {annualData.avg_per_day.toFixed(1)}
                        </td>
                      </tr>
                      
                      {/* Filas de meses (si está expandido) */}
                      {isExpanded && monthlyData.sort((a, b) => a.month - b.month).map(monthData => {
                        const cancellationRate = monthData.total > 0
                          ? (monthData.cancelled / monthData.total) * 100
                          : 0;
                        const avgPerDay = monthData.total / 30; // Aproximación
                        
                        return (
                          <tr key={`${year}-${monthData.month}`} className="border-b bg-muted/10 hover:bg-muted/20 transition-colors">
                            <td className="p-2 pl-10 text-sm text-muted-foreground">
                              {getMonthName(monthData.month)}
                            </td>
                            <td className="p-2 text-right text-sm">
                              {formatNumber(monthData.total)}
                            </td>
                            <td className="p-2 text-right text-sm">
                              {formatNumber(monthData.medicion)}
                            </td>
                            <td className="p-2 text-right text-sm">
                              {formatNumber(monthData.fitting)}
                            </td>
                            <td className="p-2 text-right text-sm">
                              {formatNumber(monthData.cancelled)}
                            </td>
                            <td className="p-2 text-right text-sm">
                              {cancellationRate.toFixed(1)}%
                            </td>
                            <td className="p-2 text-right text-sm">
                              {avgPerDay.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
