'use client'

/**
 * Vista Por Tienda - Análisis Individual
 * Sub-tab 2 de Comparativas Históricas
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComparisonKPICard } from '@/components/citas/ComparisonKPICard';
import { StoreSelector } from '@/components/citas/StoreSelector';
import { Button } from '@/components/ui/button';
import { Calendar, Ruler, Scissors, XCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { BarChart } from '@/components/dashboard/Charts';
import { formatNumber } from '@/lib/utils/format';

interface TiendaViewProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

export function TiendaView({ selectedMonth, selectedYear, onMonthChange }: TiendaViewProps) {
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('all');
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [yearsData, setYearsData] = useState<Record<number, any>>({});
  const [selectedYears, setSelectedYears] = useState([2025, 2024, 2023]);
  
  const availableYearsForSelect = [2025, 2024, 2023, 2022, 2021];
  
  useEffect(() => {
    loadStores();
  }, []);
  
  useEffect(() => {
    if (availableStores.length > 0) {
      loadData();
    }
  }, [selectedMonth, selectedYear, selectedStore, selectedYears, availableStores]);
  
  const loadStores = async () => {
    try {
      // Obtener tiendas disponibles desde datos históricos (año más reciente)
      const response = await fetch(`/api/citas/historical?year=2024`);
      if (response.ok) {
        const data = await response.json();
        const stores = data.metrics.by_store.map((s: any) => s.store_city);
        setAvailableStores(stores);
        if (stores.length > 0 && selectedStore === 'all') {
          setSelectedStore(stores[0]); // Seleccionar primera tienda por defecto
        }
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      const storeParam = selectedStore !== 'all' ? `&storeCity=${selectedStore}` : '';
      const response = await fetch(
        `/api/citas/historical/compare?years=${selectedYears.join(',')}&month=${selectedMonth}${storeParam}`
      );
      
      if (!response.ok) {
        throw new Error('Error al cargar datos');
      }
      
      const data = await response.json();
      setYearsData(data.comparison.years);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
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
  
  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 1) {
        setSelectedYears(selectedYears.filter(y => y !== year));
      }
    } else {
      setSelectedYears([...selectedYears, year].sort((a, b) => b - a));
    }
  };
  
  const currentYearData = yearsData[selectedYear];
  const previousYearData = yearsData[selectedYear - 1];
  
  // Preparar datos para gráfica de barras
  const chartData = selectedYears.sort((a, b) => a - b).map(year => ({
    name: year.toString(),
    Medición: yearsData[year]?.medicion || 0,
    Fitting: yearsData[year]?.fitting || 0,
  }));
  
  if (loading && availableStores.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header con selector de tienda y mes */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Análisis por Tienda</CardTitle>
              <CardDescription>
                Comparativa histórica de una tienda específica
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StoreSelector
                value={selectedStore}
                onValueChange={setSelectedStore}
                stores={availableStores}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[150px] text-center font-medium capitalize text-sm">
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
            {availableYearsForSelect.map(year => (
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
        </CardContent>
      </Card>
      
      {/* KPI Cards para la tienda seleccionada */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ComparisonKPICard
          title="Total Citas"
          currentValue={currentYearData?.total || 0}
          comparativeValue={previousYearData?.total || null}
          Icon={Calendar}
          subtitle={selectedStore !== 'all' ? selectedStore : 'Todas'}
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
          title="Canceladas"
          currentValue={currentYearData?.cancelled || 0}
          comparativeValue={previousYearData?.cancelled || null}
          inverse={true}
          Icon={XCircle}
        />
      </div>
      
      {/* Gráfica de barras comparativa */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativa por Tipo de Cita</CardTitle>
            <CardDescription>
              {selectedStore !== 'all' ? selectedStore : 'Todas las tiendas'} - {getMonthName(selectedMonth)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              title=""
              data={chartData as any}
              formatValue={(v) => formatNumber(v)}
              height={350}
              color="#8B0000"
            />
          </CardContent>
        </Card>
      )}
      
      {/* Tabla detallada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle Histórico</CardTitle>
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
                </tr>
              </thead>
              <tbody>
                {selectedYears.sort((a, b) => b - a).map(year => {
                  const data = yearsData[year];
                  if (!data) return (
                    <tr key={year} className="border-b">
                      <td className="p-2 font-semibold">{year}</td>
                      <td colSpan={5} className="p-2 text-center text-muted-foreground">
                        Sin datos para este período
                      </td>
                    </tr>
                  );
                  
                  return (
                    <tr key={year} className="border-b">
                      <td className="p-2 font-semibold">{year}</td>
                      <td className="p-2 text-right">{formatNumber(data.total || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.medicion || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.fitting || 0)}</td>
                      <td className="p-2 text-right">{formatNumber(data.cancelled || 0)}</td>
                      <td className="p-2 text-right">{(data.cancellation_rate || 0).toFixed(1)}%</td>
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

