'use client'

/**
 * Vista General - Comparativas Globales
 * Sub-tab 1 de Comparativas Históricas
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonKPICard } from '@/components/citas/ComparisonKPICard';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, Scissors, Ruler, XCircle, BarChart3, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { LineChart } from '@/components/dashboard/Charts';
import { formatNumber } from '@/lib/utils/format';

interface GeneralViewProps {
  selectedMonth: number; // 1-12
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

interface YearMetrics {
  year: number;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
  cancellation_rate: number;
  avg_per_day: number;
}

interface MonthlyMetrics {
  month: number;
  total: number;
  medicion: number;
  fitting: number;
  cancelled: number;
  cancellation_rate: number;
  avg_per_day: number;
}

export function GeneralView({ selectedMonth, selectedYear, onMonthChange }: GeneralViewProps) {
  const [loading, setLoading] = useState(true);
  const [yearsData, setYearsData] = useState<Record<number, YearMetrics>>({});
  const [annualData, setAnnualData] = useState<Record<number, YearMetrics>>({});
  const [selectedYearsForCompare, setSelectedYearsForCompare] = useState<number[]>([2025, 2024, 2023, 2022, 2021]);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [yearMonthlyData, setYearMonthlyData] = useState<Record<number, MonthlyMetrics[]>>({});
  const [chartViewType, setChartViewType] = useState<'annual' | 'monthly' | 'by-type'>('annual');
  const [storeChartYear, setStoreChartYear] = useState(2025);
  const [storeMonthlyData, setStoreMonthlyData] = useState<any>(null);
  const [storeAnnualData, setStoreAnnualData] = useState<any>(null);
  
  // Años disponibles para comparar
  const availableYears = [2025, 2024, 2023, 2022, 2021];
  
  // Meses abreviados para el selector
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  // Configuración de tiendas con colores
  // IMPORTANTE: Los nombres deben coincidir EXACTAMENTE con store_city en la BD
  const storeConfig = [
    { name: 'Madrid', color: '#EF4444' },
    { name: 'Sevilla', color: '#F59E0B' },
    { name: 'Málaga', color: '#10B981' },
    { name: 'Barcelona', color: '#3B82F6' },
    { name: 'Murcia', color: '#8B5CF6' },
    { name: 'Bilbao', color: '#EC4899' },
    { name: 'Valencia', color: '#14B8A6' },
    { name: 'Zaragoza', color: '#F97316' },
    { name: 'CDMX', color: '#6366F1' }, // CDMX en mayúsculas según normalización en import script
  ];
  
  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, selectedYearsForCompare]);
  
  useEffect(() => {
    loadAnnualData();
  }, [selectedYearsForCompare]);
  
  useEffect(() => {
    // Cargar datos mensuales cuando se selecciona vista mensual
    if (chartViewType === 'monthly') {
      selectedYearsForCompare.forEach(year => {
        loadMonthlyDataForYear(year);
      });
    }
  }, [chartViewType, selectedYearsForCompare]);
  
  useEffect(() => {
    // Cargar datos mensuales por tienda
    loadStoreMonthlyData();
  }, [storeChartYear]);
  
  useEffect(() => {
    // Cargar datos anuales por tienda
    loadStoreAnnualData();
  }, [selectedYearsForCompare]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Obtener datos para los años seleccionados
      const response = await fetch(
        `/api/citas/historical/compare?years=${selectedYearsForCompare.join(',')}&month=${selectedMonth}`
      );
      
      if (!response.ok) {
        throw new Error('Error al cargar datos');
      }
      
      const data = await response.json();
      
      // Transformar datos
      const transformedData: Record<number, YearMetrics> = {};
      
      Object.entries(data.comparison.years).forEach(([year, metrics]: [string, any]) => {
        transformedData[parseInt(year)] = {
          year: parseInt(year),
          total: metrics.total,
          medicion: metrics.medicion,
          fitting: metrics.fitting,
          cancelled: metrics.cancelled,
          cancellation_rate: metrics.cancellation_rate,
          avg_per_day: metrics.avg_per_day,
        };
      });
      
      setYearsData(transformedData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadAnnualData = async () => {
    try {
      // Obtener totales anuales para los años seleccionados
      const response = await fetch(
        `/api/citas/historical/annual-totals?years=${selectedYearsForCompare.join(',')}`
      );
      
      if (!response.ok) {
        throw new Error('Error al cargar datos anuales');
      }
      
      const result = await response.json();
      
      // Transformar datos anuales
      const transformedAnnualData: Record<number, YearMetrics> = {};
      
      Object.entries(result.data).forEach(([year, metrics]: [string, any]) => {
        transformedAnnualData[parseInt(year)] = {
          year: metrics.year,
          total: metrics.total,
          medicion: metrics.medicion,
          fitting: metrics.fitting,
          cancelled: metrics.cancelled,
          cancellation_rate: metrics.cancellation_rate,
          avg_per_day: metrics.avg_per_day,
        };
      });
      
      setAnnualData(transformedAnnualData);
    } catch (error) {
      console.error('Error loading annual data:', error);
    }
  };
  
  const loadMonthlyDataForYear = async (year: number) => {
    // Si ya tenemos los datos, no volver a cargar
    if (yearMonthlyData[year]) {
      return;
    }
    
    try {
      const response = await fetch(
        `/api/citas/historical/monthly-breakdown?years=${year}`
      );
      
      if (!response.ok) {
        throw new Error('Error al cargar datos mensuales');
      }
      
      const result = await response.json();
      
      // Extraer datos mensuales del año
      const monthlyDataArray = result.data[year.toString()] || [];
      
      setYearMonthlyData(prev => ({
        ...prev,
        [year]: monthlyDataArray,
      }));
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };
  
  const toggleYearExpansion = async (year: number) => {
    const newExpanded = new Set(expandedYears);
    
    if (expandedYears.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
      // Cargar datos mensuales si se está expandiendo
      await loadMonthlyDataForYear(year);
    }
    
    setExpandedYears(newExpanded);
  };
  
  const loadStoreMonthlyData = async () => {
    try {
      const response = await fetch(
        `/api/citas/historical/by-store?years=${storeChartYear}&grouping=monthly`
      );
      
      if (!response.ok) {
        throw new Error('Error al cargar datos mensuales por tienda');
      }
      
      const result = await response.json();
      setStoreMonthlyData(result.data);
    } catch (error) {
      console.error('Error loading store monthly data:', error);
    }
  };
  
  const loadStoreAnnualData = async () => {
    try {
      const response = await fetch(
        `/api/citas/historical/by-store?years=${selectedYearsForCompare.join(',')}&grouping=annual`
      );
      
      if (!response.ok) {
        throw new Error('Error al cargar datos anuales por tienda');
      }
      
      const result = await response.json();
      setStoreAnnualData(result.data);
    } catch (error) {
      console.error('Error loading store annual data:', error);
    }
  };
  
  // Navegación de meses
  const navigateMonth = (direction: 'prev' | 'next') => {
    let newMonth = selectedMonth;
    let newYear = selectedYear;
    
    if (direction === 'prev') {
      if (selectedMonth === 1) {
        newMonth = 12;
        newYear = selectedYear - 1;
      } else {
        newMonth = selectedMonth - 1;
      }
    } else {
      if (selectedMonth === 12) {
        newMonth = 1;
        newYear = selectedYear + 1;
      } else {
        newMonth = selectedMonth + 1;
      }
    }
    
    onMonthChange(newMonth, newYear);
  };
  
  const getMonthName = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long' });
  };
  
  // Datos del año actual y año anterior para KPI cards
  const currentYearData = yearsData[selectedYear];
  const previousYearData = yearsData[selectedYear - 1];
  
  // Construir texto del periodo comparativo
  const comparativePeriodText = `${getMonthName(selectedMonth)} ${selectedYear - 1}`;
  
  // Preparar datos para gráfica de líneas (totales anuales)
  const chartData = selectedYearsForCompare
    .sort((a, b) => a - b)
    .map(year => ({
      name: year.toString(),
      Total: annualData[year]?.total || 0,
      Medición: annualData[year]?.medicion || 0,
      Fitting: annualData[year]?.fitting || 0,
    }));
  
  // Toggle año para comparación
  const toggleYear = (year: number) => {
    if (selectedYearsForCompare.includes(year)) {
      if (selectedYearsForCompare.length > 1) {
        setSelectedYearsForCompare(selectedYearsForCompare.filter(y => y !== year));
      }
    } else {
      setSelectedYearsForCompare([...selectedYearsForCompare, year].sort((a, b) => b - a));
    }
  };
  
  // Preparar datos para gráfica con opciones
  const getChartDataByViewType = () => {
    switch (chartViewType) {
      case 'annual':
        // Totales anuales (mismo que chartData)
        return selectedYearsForCompare
          .sort((a, b) => a - b)
          .map(year => ({
            name: year.toString(),
            Total: annualData[year]?.total || 0,
            Medición: annualData[year]?.medicion || 0,
            Fitting: annualData[year]?.fitting || 0,
          }));
      
      case 'monthly':
        // Todos los meses de todos los años
        const monthlyChartData: any[] = [];
        selectedYearsForCompare.sort((a, b) => a - b).forEach(year => {
          const yearData = yearMonthlyData[year] || [];
          yearData.forEach(monthData => {
            monthlyChartData.push({
              name: `${months[monthData.month - 1]} ${year}`,
              Total: monthData.total || 0,
              Medición: monthData.medicion || 0,
              Fitting: monthData.fitting || 0,
            });
          });
        });
        return monthlyChartData;
      
      case 'by-type':
        // Comparar por tipo (Medición vs Fitting vs Total)
        return selectedYearsForCompare
          .sort((a, b) => a - b)
          .map(year => ({
            name: year.toString(),
            Medición: annualData[year]?.medicion || 0,
            Fitting: annualData[year]?.fitting || 0,
            Total: annualData[year]?.total || 0,
          }));
      
      default:
        return [];
    }
  };
  
  // Preparar datos para gráfica mensual por tienda
  const getStoreMonthlyChartData = () => {
    if (!storeMonthlyData) return [];
    
    // Crear array de 12 meses
    const monthlyData: any[] = [];
    for (let month = 1; month <= 12; month++) {
      const dataPoint: any = {
        name: months[month - 1],
      };
      
      // Añadir datos de cada tienda para este mes
      storeConfig.forEach(store => {
        const storeData = storeMonthlyData[store.name];
        if (storeData) {
          const monthData = storeData.find((d: any) => d.month === month && d.year === storeChartYear);
          dataPoint[store.name] = monthData?.total || 0;
        } else {
          dataPoint[store.name] = 0;
        }
      });
      
      monthlyData.push(dataPoint);
    }
    
    return monthlyData;
  };
  
  // Preparar datos para gráfica anual por tienda
  const getStoreAnnualChartData = () => {
    if (!storeAnnualData) return [];
    
    // Crear array de años
    const annualData: any[] = [];
    selectedYearsForCompare.sort((a, b) => a - b).forEach(year => {
      const dataPoint: any = {
        name: year.toString(),
      };
      
      // Añadir datos de cada tienda para este año
      storeConfig.forEach(store => {
        const storeData = storeAnnualData[store.name];
        if (storeData) {
          const yearData = storeData.find((d: any) => d.year === year);
          dataPoint[store.name] = yearData?.total || 0;
        } else {
          dataPoint[store.name] = 0;
        }
      });
      
      annualData.push(dataPoint);
    });
    
    return annualData;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativa General</CardTitle>
          <CardDescription>
            Análisis histórico de citas por mes y año
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6 items-start">
            <div className="flex-1 min-w-[300px]">
              <span className="text-sm text-muted-foreground mb-2 block">Años a comparar:</span>
              <div className="flex flex-wrap gap-2">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={selectedYearsForCompare.includes(year) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleYear(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[300px]">
              <span className="text-sm text-muted-foreground mb-2 block">Mes:</span>
              <div className="flex flex-wrap gap-2">
                {months.map((month, idx) => (
                  <Button
                    key={idx}
                    variant={selectedMonth === idx + 1 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onMonthChange(idx + 1, selectedYear)}
                  >
                    {month}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <ComparisonKPICard
          title="Total Citas"
          currentValue={currentYearData?.total || 0}
          comparativeValue={previousYearData?.total || null}
          Icon={Calendar}
          subtitle={`${getMonthName(selectedMonth)} ${selectedYear}`}
          variant="primary"
          comparativePeriod={comparativePeriodText}
        />
        
        <ComparisonKPICard
          title="Medición"
          currentValue={currentYearData?.medicion || 0}
          comparativeValue={previousYearData?.medicion || null}
          Icon={Ruler}
          variant="info"
          comparativePeriod={comparativePeriodText}
        />
        
        <ComparisonKPICard
          title="Fitting"
          currentValue={currentYearData?.fitting || 0}
          comparativeValue={previousYearData?.fitting || null}
          Icon={Scissors}
          variant="success"
          comparativePeriod={comparativePeriodText}
        />
        
        <ComparisonKPICard
          title="Tasa Cancelación"
          currentValue={currentYearData?.cancellation_rate || 0}
          comparativeValue={previousYearData?.cancellation_rate || null}
          format="percentage"
          inverse={true}
          Icon={XCircle}
          variant="danger"
          comparativePeriod={comparativePeriodText}
        />
        
        <ComparisonKPICard
          title="Canceladas"
          currentValue={currentYearData?.cancelled || 0}
          comparativeValue={previousYearData?.cancelled || null}
          inverse={true}
          variant="warning"
          comparativePeriod={comparativePeriodText}
        />
        
        <ComparisonKPICard
          title="Promedio/Día"
          currentValue={currentYearData?.avg_per_day || 0}
          comparativeValue={previousYearData?.avg_per_day || null}
          format="decimal"
          Icon={TrendingUp}
          variant="primary"
          comparativePeriod={comparativePeriodText}
        />
      </div>
      
      {/* Gráfica de líneas multi-año - Totales anuales */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolución por Años</CardTitle>
            <CardDescription>
              Comparativa de totales anuales entre años seleccionados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineChart
              title=""
              data={chartData}
              xAxisKey="name"
              lines={[
                { dataKey: 'Total', name: 'Total', color: '#8B0000' },
                { dataKey: 'Medición', name: 'Medición', color: '#3B82F6' },
                { dataKey: 'Fitting', name: 'Fitting', color: '#10B981' },
              ]}
              formatValue={(v) => formatNumber(v)}
              height={400}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Tabla comparativa detallada expandible */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Año</CardTitle>
          <CardDescription>
            Haz clic en un año para ver el desglose mensual
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
                {selectedYearsForCompare.sort((a, b) => b - a).map(year => {
                  const data = annualData[year];
                  const isExpanded = expandedYears.has(year);
                  const monthlyData = yearMonthlyData[year] || [];
                  
                  if (!data) return null;
                  
                  return (
                    <React.Fragment key={year}>
                      {/* Fila del año (totales anuales) */}
                      <tr className="border-b bg-muted/30 hover:bg-muted/50 cursor-pointer" onClick={() => toggleYearExpansion(year)}>
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
                        <td className="p-2 text-right font-semibold">{formatNumber(data.total || 0)}</td>
                        <td className="p-2 text-right">{formatNumber(data.medicion || 0)}</td>
                        <td className="p-2 text-right">{formatNumber(data.fitting || 0)}</td>
                        <td className="p-2 text-right">{formatNumber(data.cancelled || 0)}</td>
                        <td className="p-2 text-right">{(data.cancellation_rate || 0).toFixed(1)}%</td>
                        <td className="p-2 text-right">{(data.avg_per_day || 0).toFixed(1)}</td>
                      </tr>
                      
                      {/* Filas de meses (si está expandido) */}
                      {isExpanded && monthlyData.map(monthData => (
                        <tr key={`${year}-${monthData.month}`} className="border-b bg-muted/10">
                          <td className="p-2 pl-10 text-sm text-muted-foreground">
                            {getMonthName(monthData.month)}
                          </td>
                          <td className="p-2 text-right text-sm">{formatNumber(monthData.total || 0)}</td>
                          <td className="p-2 text-right text-sm">{formatNumber(monthData.medicion || 0)}</td>
                          <td className="p-2 text-right text-sm">{formatNumber(monthData.fitting || 0)}</td>
                          <td className="p-2 text-right text-sm">{formatNumber(monthData.cancelled || 0)}</td>
                          <td className="p-2 text-right text-sm">{(monthData.cancellation_rate || 0).toFixed(1)}%</td>
                          <td className="p-2 text-right text-sm">{(monthData.avg_per_day || 0).toFixed(1)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Gráfica con opciones de visualización */}
      <Card>
        <CardHeader>
          <CardTitle>Análisis Comparativo</CardTitle>
          <CardDescription>
            Selecciona el tipo de visualización que deseas ver
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Selector de tipo de visualización */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={chartViewType === 'annual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartViewType('annual')}
              >
                Totales Anuales
              </Button>
              <Button
                variant={chartViewType === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartViewType('monthly')}
              >
                Desglose Mensual
              </Button>
              <Button
                variant={chartViewType === 'by-type' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartViewType('by-type')}
              >
                Por Tipo
              </Button>
            </div>
            
            {/* Gráfica */}
            <div className="mt-4">
              <LineChart
                title=""
                data={getChartDataByViewType()}
                xAxisKey="name"
                lines={[
                  { dataKey: 'Total', name: 'Total', color: '#8B0000' },
                  { dataKey: 'Medición', name: 'Medición', color: '#3B82F6' },
                  { dataKey: 'Fitting', name: 'Fitting', color: '#10B981' },
                ]}
                formatValue={(v) => formatNumber(v)}
                height={400}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Gráfica de evolución mensual por tienda */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evolución Mensual por Tienda</CardTitle>
              <CardDescription>
                Comparativa de citas mensuales entre tiendas para {storeChartYear}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Año:</span>
              <div className="flex gap-1">
                {availableYears.map(year => (
                  <Button
                    key={year}
                    variant={storeChartYear === year ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStoreChartYear(year)}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {storeMonthlyData ? (
            <LineChart
              title=""
              data={getStoreMonthlyChartData()}
              xAxisKey="name"
              lines={storeConfig.map(store => ({
                dataKey: store.name,
                name: store.name,
                color: store.color,
              }))}
              formatValue={(v) => formatNumber(v)}
              height={400}
            />
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Gráfica de comparación anual por tienda */}
      <Card>
        <CardHeader>
          <CardTitle>Comparación Anual por Tienda</CardTitle>
          <CardDescription>
            Totales anuales de cada tienda a través de los años seleccionados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {storeAnnualData ? (
            <LineChart
              title=""
              data={getStoreAnnualChartData()}
              xAxisKey="name"
              lines={storeConfig.map(store => ({
                dataKey: store.name,
                name: store.name,
                color: store.color,
              }))}
              formatValue={(v) => formatNumber(v)}
              height={400}
            />
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

