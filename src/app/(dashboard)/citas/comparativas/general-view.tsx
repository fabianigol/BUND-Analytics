'use client'

/**
 * Vista General - Comparativas Globales
 * Sub-tab 1 de Comparativas Históricas
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonKPICard } from '@/components/citas/ComparisonKPICard';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, Scissors, Ruler, XCircle, BarChart3, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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

export function GeneralView({ selectedMonth, selectedYear, onMonthChange }: GeneralViewProps) {
  const [loading, setLoading] = useState(true);
  const [yearsData, setYearsData] = useState<Record<number, YearMetrics>>({});
  const [selectedYearsForCompare, setSelectedYearsForCompare] = useState<number[]>([2025, 2024, 2023]);
  
  // Años disponibles para comparar
  const availableYears = [2025, 2024, 2023, 2022, 2021];
  
  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear, selectedYearsForCompare]);
  
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
  
  // Preparar datos para gráfica de líneas
  const chartData = selectedYearsForCompare
    .sort((a, b) => a - b)
    .map(year => ({
      name: year.toString(),
      Total: yearsData[year]?.total || 0,
      Medición: yearsData[year]?.medicion || 0,
      Fitting: yearsData[year]?.fitting || 0,
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
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header con selector de mes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Comparativa General</CardTitle>
              <CardDescription>
                Análisis histórico de citas por mes y año
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[180px] text-center font-medium capitalize">
                {getMonthName(selectedMonth)} {selectedYear}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('next')}
                disabled={selectedYear >= 2025 && selectedMonth >= 12}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Años a comparar:</span>
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
        />
        
        <ComparisonKPICard
          title="Medición"
          currentValue={currentYearData?.medicion || 0}
          comparativeValue={previousYearData?.medicion || null}
          Icon={Ruler}
        />
        
        <ComparisonKPICard
          title="Fitting"
          currentValue={currentYearData?.fitting || 0}
          comparativeValue={previousYearData?.fitting || null}
          Icon={Scissors}
        />
        
        <ComparisonKPICard
          title="Tasa Cancelación"
          currentValue={currentYearData?.cancellation_rate || 0}
          comparativeValue={previousYearData?.cancellation_rate || null}
          format="percentage"
          inverse={true}
          Icon={XCircle}
        />
        
        <ComparisonKPICard
          title="Canceladas"
          currentValue={currentYearData?.cancelled || 0}
          comparativeValue={previousYearData?.cancelled || null}
          inverse={true}
        />
        
        <ComparisonKPICard
          title="Promedio/Día"
          currentValue={currentYearData?.avg_per_day || 0}
          comparativeValue={previousYearData?.avg_per_day || null}
          format="decimal"
          Icon={TrendingUp}
        />
      </div>
      
      {/* Gráfica de líneas multi-año */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolución por Años</CardTitle>
            <CardDescription>
              Comparativa de {getMonthName(selectedMonth)} entre años seleccionados
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
      
      {/* Tabla comparativa detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Año</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Año</th>
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
                  const data = yearsData[year];
                  if (!data) return null;
                  
                  return (
                    <tr key={year} className="border-b">
                      <td className="p-2 font-semibold">{year}</td>
                      <td className="p-2 text-right">{formatNumber(data.total || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.medicion || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.fitting || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.cancelled || 0)}</td>
                      <td className="p-2 text-right">{(data.cancellation_rate || 0).toFixed(1)}%</td>
                      <td className="p-2 text-right">{(data.avg_per_day || 0).toFixed(1)}</td>
                    </tr>
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

