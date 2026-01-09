'use client'

/**
 * Vista Patrones - Análisis de días y horas
 * Sub-tab 3 de Comparativas Históricas
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StoreSelector } from '@/components/citas/StoreSelector';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { BarChart } from '@/components/dashboard/Charts';
import { formatNumber } from '@/lib/utils/format';

interface PatronesViewProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

export function PatronesView({ selectedMonth, selectedYear, onMonthChange }: PatronesViewProps) {
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState('all');
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [dayOfWeekData, setDayOfWeekData] = useState<any[]>([]);
  const [hourData, setHourData] = useState<any[]>([]);
  
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  useEffect(() => {
    loadStores();
  }, []);
  
  useEffect(() => {
    if (availableStores.length > 0) {
      loadData();
    }
  }, [selectedMonth, selectedYear, selectedStore]);
  
  const loadStores = async () => {
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
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Construir query
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });
      
      if (selectedStore !== 'all') {
        params.append('city', selectedStore);
      }
      
      // Obtener datos por día de la semana
      const dayOfWeekResponse = await fetch(
        `/api/citas/historical?${params.toString()}&aggregateBy=dayOfWeek`
      );
      
      if (dayOfWeekResponse.ok) {
        const dayData = await dayOfWeekResponse.json();
        if (dayData.metrics?.byDayOfWeek) {
          setDayOfWeekData(dayData.metrics.byDayOfWeek);
        }
      }
      
      // Obtener datos por hora
      const hourResponse = await fetch(
        `/api/citas/historical?${params.toString()}&aggregateBy=hour`
      );
      
      if (hourResponse.ok) {
        const hData = await hourResponse.json();
        if (hData.metrics?.byHour) {
          setHourData(hData.metrics.byHour);
        }
      }
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
  
  // Preparar datos para gráficas
  const dayOfWeekChartData = dayOfWeekData.map(d => ({
    name: dayNames[d.day_of_week],
    Total: d.total,
    Medición: d.medicion,
    Fitting: d.fitting,
  }));
  
  const hourChartData = hourData.map(h => ({
    name: `${h.hour}:00`,
    Total: h.total,
    Medición: h.medicion,
    Fitting: h.fitting,
  }));
  
  // Calcular heatmap simplificado (día x hora) - top 5 horas
  const topHours = hourData
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  
  if (loading && availableStores.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Patrones de Citas</CardTitle>
              <CardDescription>
                Análisis de días de la semana y horarios
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
      </Card>
      
      {/* Gráfica por día de la semana */}
      {dayOfWeekChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución por Día de la Semana</CardTitle>
            <CardDescription>
              {selectedStore !== 'all' ? selectedStore : 'Todas las tiendas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              title=""
              data={dayOfWeekChartData as any}
              formatValue={(v) => formatNumber(v)}
              height={350}
              color="#8B0000"
            />
          </CardContent>
        </Card>
      )}
      
      {/* Gráfica por hora */}
      {hourChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribución Horaria</CardTitle>
            <CardDescription>
              Citas por hora del día
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart
              title=""
              data={hourChartData as any}
              formatValue={(v) => formatNumber(v)}
              height={350}
              color="#3B82F6"
            />
          </CardContent>
        </Card>
      )}
      
      {/* Top Horas más activas */}
      <Card>
        <CardHeader>
          <CardTitle>Horas Más Activas</CardTitle>
          <CardDescription>
            Top 5 horarios con más citas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topHours.map((h, idx) => {
              const maxTotal = topHours[0]?.total || 1;
              const percentage = (h.total / maxTotal) * 100;
              
              return (
                <div key={h.hour} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{h.hour}:00</span>
                    <span className="text-muted-foreground">{formatNumber(h.total)} citas</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8B0000] transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Tabla detallada por día */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Día de la Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Día</th>
                  <th className="text-right p-2 font-medium">Total</th>
                  <th className="text-right p-2 font-medium">Medición</th>
                  <th className="text-right p-2 font-medium">Fitting</th>
                  <th className="text-right p-2 font-medium">Canceladas</th>
                  <th className="text-right p-2 font-medium">% Cancel.</th>
                </tr>
              </thead>
              <tbody>
                {dayOfWeekData.map(d => (
                  <tr key={d.day_of_week} className="border-b">
                    <td className="p-2 font-medium">{dayNames[d.day_of_week]}</td>
                    <td className="p-2 text-right">{formatNumber(d.total)}</td>
                    <td className="p-2 text-right">{formatNumber(d.medicion)}</td>
                    <td className="p-2 text-right">{formatNumber(d.fitting)}</td>
                    <td className="p-2 text-right">{formatNumber(d.cancelled)}</td>
                    <td className="p-2 text-right">
                      {d.total > 0 ? ((d.cancelled / d.total) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

