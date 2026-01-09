'use client'

/**
 * Vista Acuity vs Histórico - Comparación por Tienda
 * Tabla estilo Paid Media con comparativas automáticas
 * Separada en Medición y Fitting con selectores personalizados
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, TrendingUp, TrendingDown, Minus, Info, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/utils/format';

type PeriodPreset = 'este_mes' | 'ultimos_30' | 'este_anio' | 'personalizado';

interface StoreComparison {
  store_city: string;
  current: {
    total: number;
    medicion: number;
    fitting: number;
    cancelled: number;
    cancellation_rate: number;
    avg_per_day: number;
    cancelled_medicion?: number;
    cancelled_fitting?: number;
    cancellation_rate_medicion?: number;
    cancellation_rate_fitting?: number;
  };
  year1?: {
    total: number;
    medicion: number;
    fitting: number;
    cancelled: number;
    cancellation_rate: number;
    avg_per_day: number;
    cancelled_medicion?: number;
    cancelled_fitting?: number;
    cancellation_rate_medicion?: number;
    cancellation_rate_fitting?: number;
  };
  year2?: {
    total: number;
    medicion: number;
    fitting: number;
    cancelled: number;
    cancellation_rate: number;
    avg_per_day: number;
    cancelled_medicion?: number;
    cancelled_fitting?: number;
    cancellation_rate_medicion?: number;
    cancellation_rate_fitting?: number;
  };
  year3?: {
    total: number;
    medicion: number;
    fitting: number;
    cancelled: number;
    cancellation_rate: number;
    avg_per_day: number;
    cancelled_medicion?: number;
    cancelled_fitting?: number;
    cancellation_rate_medicion?: number;
    cancellation_rate_fitting?: number;
  };
  year4?: {
    total: number;
    medicion: number;
    fitting: number;
    cancelled: number;
    cancellation_rate: number;
    avg_per_day: number;
    cancelled_medicion?: number;
    cancelled_fitting?: number;
    cancellation_rate_medicion?: number;
    cancellation_rate_fitting?: number;
  };
  change: {
    total: { value: number; percent: number; isBetter: boolean };
    cancelled: { value: number; percent: number; isBetter: boolean };
    cancellation_rate: { value: number; percent: number; isBetter: boolean };
  };
  hasHistoricalData: boolean;
}

export function AcuityVsHistoricalView() {
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('este_mes');
  const [comparisons, setComparisons] = useState<StoreComparison[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [historicalYears, setHistoricalYears] = useState<number[]>([]);
  const [availableStores, setAvailableStores] = useState<string[]>([]);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  
  useEffect(() => {
    if (selectedPreset !== 'personalizado') {
      calculateDateRange();
    }
  }, [selectedPreset]);
  
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      loadData();
    }
  }, [dateRange]);
  
  const calculateDateRange = () => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    
    switch (selectedPreset) {
      case 'este_mes':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'ultimos_30':
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        break;
      case 'este_anio':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return; // Para 'personalizado' no auto-calcular
    }
    
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };
  
  const handleCustomPeriod = () => {
    if (customStartDate && customEndDate) {
      setDateRange({
        start: customStartDate,
        end: customEndDate,
      });
    }
  };
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      // 1. Obtener datos de Acuity (período actual) agrupados por tienda
      const acuityResponse = await fetch(
        `/api/acuity/appointments?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      
      if (!acuityResponse.ok) {
        console.error('Error loading Acuity data');
        setLoading(false);
        return;
      }
      
      const acuityResult = await acuityResponse.json();
      const appointments = acuityResult.appointments || [];
      
      // Agrupar Acuity por tienda (usando appointment_type_name que contiene el nombre de la tienda)
      const storeMap = new Map<string, typeof appointments>();
      appointments.forEach((apt: any) => {
        // El nombre de la tienda está en appointment_type_name (ej: "The Bundclub Madrid [Medición I]")
        let store = apt.appointment_type_name || 'Sin tienda';
        
        // Extraer ciudad del appointment_type_name (buscar entre [] o después de "The Bundclub ")
        const cities = ['Madrid', 'Barcelona', 'Sevilla', 'Málaga', 'Bilbao', 'Valencia', 'Murcia', 'Zaragoza', 'CDMX', 'Polanco'];
        for (const city of cities) {
          if (store.toLowerCase().includes(city.toLowerCase())) {
            store = city === 'Polanco' ? 'CDMX' : city;
            break;
          }
        }
        
        if (!storeMap.has(store)) {
          storeMap.set(store, []);
        }
        storeMap.get(store)!.push(apt);
      });
      
      // Obtener tiendas únicas para el selector
      const stores = Array.from(storeMap.keys()).sort();
      setAvailableStores(stores);
      if (selectedStores.length === 0) {
        setSelectedStores(stores); // Seleccionar todas por defecto
      }
      
      // 2. Obtener datos históricos para los últimos 4 años
      const currentYear = new Date().getFullYear();
      const yearsToCompare = [currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];
      setHistoricalYears(yearsToCompare);
      
      const historicalDataByYear = new Map<number, Map<string, any>>();
      
      for (const year of yearsToCompare) {
        const historicalStart = new Date(dateRange.start);
        historicalStart.setFullYear(year);
        
        const historicalEnd = new Date(dateRange.end);
        historicalEnd.setFullYear(year);
        
        const histResponse = await fetch(
          `/api/citas/historical?startDate=${historicalStart.toISOString().split('T')[0]}&endDate=${historicalEnd.toISOString().split('T')[0]}`
        );
        
        if (histResponse.ok) {
          const histData = await histResponse.json();
          if (histData.metrics?.by_store) {
            const storeDataMap = new Map<string, any>();
            histData.metrics.by_store.forEach((storeData: any) => {
              storeDataMap.set(storeData.store_city, storeData);
            });
            historicalDataByYear.set(year, storeDataMap);
          }
        }
      }
      
      // 3. Crear comparaciones por tienda
      const storeComparisons: StoreComparison[] = [];
      
      storeMap.forEach((apts, storeName) => {
        // Filtrar TheBund HQ
        if (storeName.toLowerCase().includes('thebund') || storeName.toLowerCase().includes('bundhq')) {
          return;
        }
        
        // Separar citas confirmadas de canceladas
        const currentCancelledMedicion = apts.filter((a: any) => a.status === 'canceled' && a.appointment_category === 'medición').length;
        const currentCancelledFitting = apts.filter((a: any) => a.status === 'canceled' && a.appointment_category === 'fitting').length;
        const currentCancelled = currentCancelledMedicion + currentCancelledFitting;
        
        // Citas = SOLO las NO canceladas (confirmadas/programadas)
        const currentMedicion = apts.filter((a: any) => a.appointment_category === 'medición' && a.status !== 'canceled').length;
        const currentFitting = apts.filter((a: any) => a.appointment_category === 'fitting' && a.status !== 'canceled').length;
        
        // Total = Citas confirmadas + Canceladas
        const currentTotal = currentMedicion + currentFitting + currentCancelled;
        const currentCancellationRate = currentTotal > 0 ? (currentCancelled / currentTotal) * 100 : 0;
        const currentCancellationRateMedicion = (currentMedicion + currentCancelledMedicion) > 0 ? (currentCancelledMedicion / (currentMedicion + currentCancelledMedicion)) * 100 : 0;
        const currentCancellationRateFitting = (currentFitting + currentCancelledFitting) > 0 ? (currentCancelledFitting / (currentFitting + currentCancelledFitting)) * 100 : 0;
        
        const daySet = new Set(apts.map((a: any) => new Date(a.datetime).toISOString().split('T')[0]));
        const currentAvgPerDay = daySet.size > 0 ? currentTotal / daySet.size : 0;
        
        const currentData = {
          total: currentTotal,
          medicion: currentMedicion,
          fitting: currentFitting,
          cancelled: currentCancelled,
          cancellation_rate: currentCancellationRate,
          avg_per_day: currentAvgPerDay,
          cancelled_medicion: currentCancelledMedicion,
          cancelled_fitting: currentCancelledFitting,
          cancellation_rate_medicion: currentCancellationRateMedicion,
          cancellation_rate_fitting: currentCancellationRateFitting,
        };
        
        // Buscar datos históricos para esta tienda
        const year1Data = historicalDataByYear.get(yearsToCompare[0])?.get(storeName);
        const year2Data = historicalDataByYear.get(yearsToCompare[1])?.get(storeName);
        const year3Data = historicalDataByYear.get(yearsToCompare[2])?.get(storeName);
        const year4Data = historicalDataByYear.get(yearsToCompare[3])?.get(storeName);
        
        // Calcular cambios vs año 1 (año anterior)
        const hasHistoricalData = !!year1Data;
        const totalChange = hasHistoricalData ? currentTotal - year1Data.total : 0;
        const totalChangePercent = hasHistoricalData && year1Data.total > 0 
          ? ((currentTotal - year1Data.total) / year1Data.total) * 100 
          : 0;
        
        const cancelledChange = hasHistoricalData ? currentCancelled - year1Data.cancelled : 0;
        const cancelledChangePercent = hasHistoricalData && year1Data.cancelled > 0
          ? ((currentCancelled - year1Data.cancelled) / year1Data.cancelled) * 100
          : 0;
        
        const cancellationRateChange = hasHistoricalData 
          ? currentCancellationRate - year1Data.cancellation_rate 
          : 0;
        const cancellationRateChangePercent = hasHistoricalData && year1Data.cancellation_rate > 0
          ? ((currentCancellationRate - year1Data.cancellation_rate) / year1Data.cancellation_rate) * 100
          : 0;
        
        storeComparisons.push({
          store_city: storeName,
          current: currentData,
          year1: year1Data ? {
            total: year1Data.total || 0,
            medicion: year1Data.medicion || 0,
            fitting: year1Data.fitting || 0,
            cancelled: year1Data.cancelled || 0,
            cancellation_rate: year1Data.cancellation_rate || 0,
            avg_per_day: 0, // No disponible por tienda
            cancelled_medicion: year1Data.cancelled_medicion || 0,
            cancelled_fitting: year1Data.cancelled_fitting || 0,
            cancellation_rate_medicion: year1Data.cancellation_rate_medicion || 0,
            cancellation_rate_fitting: year1Data.cancellation_rate_fitting || 0,
          } : undefined,
          year2: year2Data ? {
            total: year2Data.total || 0,
            medicion: year2Data.medicion || 0,
            fitting: year2Data.fitting || 0,
            cancelled: year2Data.cancelled || 0,
            cancellation_rate: year2Data.cancellation_rate || 0,
            avg_per_day: 0,
            cancelled_medicion: year2Data.cancelled_medicion || 0,
            cancelled_fitting: year2Data.cancelled_fitting || 0,
            cancellation_rate_medicion: year2Data.cancellation_rate_medicion || 0,
            cancellation_rate_fitting: year2Data.cancellation_rate_fitting || 0,
          } : undefined,
          year3: year3Data ? {
            total: year3Data.total || 0,
            medicion: year3Data.medicion || 0,
            fitting: year3Data.fitting || 0,
            cancelled: year3Data.cancelled || 0,
            cancellation_rate: year3Data.cancellation_rate || 0,
            avg_per_day: 0,
            cancelled_medicion: year3Data.cancelled_medicion || 0,
            cancelled_fitting: year3Data.cancelled_fitting || 0,
            cancellation_rate_medicion: year3Data.cancellation_rate_medicion || 0,
            cancellation_rate_fitting: year3Data.cancellation_rate_fitting || 0,
          } : undefined,
          year4: year4Data ? {
            total: year4Data.total || 0,
            medicion: year4Data.medicion || 0,
            fitting: year4Data.fitting || 0,
            cancelled: year4Data.cancelled || 0,
            cancellation_rate: year4Data.cancellation_rate || 0,
            avg_per_day: 0,
            cancelled_medicion: year4Data.cancelled_medicion || 0,
            cancelled_fitting: year4Data.cancelled_fitting || 0,
            cancellation_rate_medicion: year4Data.cancellation_rate_medicion || 0,
            cancellation_rate_fitting: year4Data.cancellation_rate_fitting || 0,
          } : undefined,
          change: {
            total: { 
              value: totalChange, 
              percent: totalChangePercent, 
              isBetter: totalChange > 0 
            },
            cancelled: { 
              value: cancelledChange, 
              percent: cancelledChangePercent, 
              isBetter: cancelledChange < 0 // Menos cancelaciones es mejor
            },
            cancellation_rate: { 
              value: cancellationRateChange, 
              percent: cancellationRateChangePercent, 
              isBetter: cancellationRateChange < 0 // Menor tasa es mejor
            },
          },
          hasHistoricalData,
        });
      });
      
      // Ordenar por tienda
      storeComparisons.sort((a, b) => a.store_city.localeCompare(b.store_city));
      setComparisons(storeComparisons);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleStore = (store: string) => {
    setSelectedStores(prev => 
      prev.includes(store) 
        ? prev.filter(s => s !== store)
        : [...prev, store]
    );
  };
  
  const selectAllStores = () => {
    setSelectedStores(availableStores);
  };
  
  const deselectAllStores = () => {
    setSelectedStores([]);
  };
  
  const getPresetLabel = (preset: PeriodPreset) => {
    switch (preset) {
      case 'este_mes':
        return 'Este Mes';
      case 'ultimos_30':
        return 'Últimos 30 Días';
      case 'este_anio':
        return 'Este Año';
      case 'personalizado':
        return 'Personalizado';
      default:
        return '';
    }
  };
  
  // Funciones helper para colores e iconos (igual que Paid Media)
  const getChangeColor = (isBetter: boolean, hasData: boolean): string => {
    if (!hasData) return 'bg-gray-50 text-gray-500';
    return isBetter ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700';
  };
  
  const getChangeIcon = (isBetter: boolean, hasData: boolean) => {
    if (!hasData) return <Minus className="h-4 w-4" />;
    return isBetter ? (
      <TrendingUp className="h-4 w-4" />
    ) : (
      <TrendingDown className="h-4 w-4" />
    );
  };
  
  const formatChange = (change: { value: number; percent: number; isBetter: boolean }, hasData: boolean): string => {
    if (!hasData) return '—';
    const sign = change.percent >= 0 ? '+' : '';
    return `${sign}${change.percent.toFixed(2)}%`;
  };
  
  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const endDate = new Date(end).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startDate} - ${endDate}`;
  };
  
  // Filtrar comparaciones por tiendas seleccionadas
  const filteredComparisons = comparisons.filter(c => selectedStores.includes(c.store_city));
  
  // Separar en Medición y Fitting (filtrar tiendas sin citas del tipo correspondiente)
  const medicionComparisons = filteredComparisons
    .filter(c => c.current.medicion > 0)
    .map(c => ({
      ...c,
      current: {
        ...c.current,
        total: c.current.medicion,
        cancelled: c.current.cancelled_medicion || 0,
        cancellation_rate: c.current.cancellation_rate_medicion || 0,
      },
      year1: c.year1 ? {
        ...c.year1,
        total: c.year1.medicion,
        cancelled: c.year1.cancelled_medicion || 0,
        cancellation_rate: c.year1.cancellation_rate_medicion || 0,
      } : undefined,
      year2: c.year2 ? {
        ...c.year2,
        total: c.year2.medicion,
        cancelled: c.year2.cancelled_medicion || 0,
        cancellation_rate: c.year2.cancellation_rate_medicion || 0,
      } : undefined,
      year3: c.year3 ? {
        ...c.year3,
        total: c.year3.medicion,
        cancelled: c.year3.cancelled_medicion || 0,
        cancellation_rate: c.year3.cancellation_rate_medicion || 0,
      } : undefined,
      year4: c.year4 ? {
        ...c.year4,
        total: c.year4.medicion,
        cancelled: c.year4.cancelled_medicion || 0,
        cancellation_rate: c.year4.cancellation_rate_medicion || 0,
      } : undefined,
    }));
  
  const fittingComparisons = filteredComparisons
    .filter(c => c.current.fitting > 0)
    .map(c => ({
      ...c,
      current: {
        ...c.current,
        total: c.current.fitting,
        cancelled: c.current.cancelled_fitting || 0,
        cancellation_rate: c.current.cancellation_rate_fitting || 0,
      },
      year1: c.year1 ? {
        ...c.year1,
        total: c.year1.fitting,
        cancelled: c.year1.cancelled_fitting || 0,
        cancellation_rate: c.year1.cancellation_rate_fitting || 0,
      } : undefined,
      year2: c.year2 ? {
        ...c.year2,
        total: c.year2.fitting,
        cancelled: c.year2.cancelled_fitting || 0,
        cancellation_rate: c.year2.cancellation_rate_fitting || 0,
      } : undefined,
      year3: c.year3 ? {
        ...c.year3,
        total: c.year3.fitting,
        cancelled: c.year3.cancelled_fitting || 0,
        cancellation_rate: c.year3.cancellation_rate_fitting || 0,
      } : undefined,
      year4: c.year4 ? {
        ...c.year4,
        total: c.year4.fitting,
        cancelled: c.year4.cancelled_fitting || 0,
        cancellation_rate: c.year4.cancellation_rate_fitting || 0,
      } : undefined,
    }));
  
  // Función para renderizar tabla
  const renderTable = (title: string, data: typeof filteredComparisons) => {
    const currentYear = new Date().getFullYear();
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">
            {title} ({data.filter(c => c.current.total > 0).length} tiendas con citas)
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {getPresetLabel(selectedPreset)} - {formatPeriod(dateRange.start, dateRange.end)}
          </p>
        </CardHeader>
        <CardContent>
          {data.filter(c => c.current.total > 0).length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              No hay citas de {title.toLowerCase()} para este período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tienda</TableHead>
                    <TableHead className="text-right">Citas {currentYear}</TableHead>
                    <TableHead className="text-right">% Cambio</TableHead>
                    <TableHead className="text-right">Citas {historicalYears[0]}</TableHead>
                    <TableHead className="text-right">% Cambio</TableHead>
                    <TableHead className="text-right">Citas {historicalYears[1]}</TableHead>
                    <TableHead className="text-right">% Cambio</TableHead>
                    <TableHead className="text-right">Citas {historicalYears[2]}</TableHead>
                    <TableHead className="text-right">% Cambio</TableHead>
                    <TableHead className="text-right">Citas {historicalYears[3]}</TableHead>
                    <TableHead className="text-right">Canceladas Actual</TableHead>
                    <TableHead className="text-right">Canceladas {historicalYears[0]}</TableHead>
                    <TableHead className="text-right">% Cambio Cancel.</TableHead>
                    <TableHead className="text-right">% Cancel. Actual</TableHead>
                    <TableHead className="text-right">% Cancel. {historicalYears[0]}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.filter(c => c.current.total > 0).map((comparison) => {
                    // Calcular cambios año por año
                    const change1 = comparison.year1 && comparison.year1.total > 0
                      ? ((comparison.current.total - comparison.year1.total) / comparison.year1.total) * 100
                      : 0;
                    const change2 = comparison.year2 && comparison.year1 && comparison.year1.total > 0
                      ? ((comparison.year1.total - comparison.year2.total) / comparison.year2.total) * 100
                      : 0;
                    const change3 = comparison.year3 && comparison.year2 && comparison.year2.total > 0
                      ? ((comparison.year2.total - comparison.year3.total) / comparison.year3.total) * 100
                      : 0;
                    const change4 = comparison.year4 && comparison.year3 && comparison.year3.total > 0
                      ? ((comparison.year3.total - comparison.year4.total) / comparison.year4.total) * 100
                      : 0;
                    
                    return (
                      <TableRow key={comparison.store_city}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{comparison.store_city}</p>
                            {!comparison.hasHistoricalData && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                Sin datos históricos
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Citas Año Actual */}
                        <TableCell className="text-right font-medium">
                          {formatNumber(comparison.current.total)}
                        </TableCell>
                        <TableCell className={`text-right ${getChangeColor(change1 >= 0, comparison.hasHistoricalData)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {getChangeIcon(change1 >= 0, comparison.hasHistoricalData)}
                            <span>{comparison.hasHistoricalData ? `${change1 >= 0 ? '+' : ''}${change1.toFixed(1)}%` : '—'}</span>
                          </div>
                        </TableCell>
                        
                        {/* Citas Año -1 */}
                        <TableCell className="text-right">
                          {comparison.year1 ? formatNumber(comparison.year1.total) : '—'}
                        </TableCell>
                        <TableCell className={`text-right ${comparison.year2 ? (change2 >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700') : 'bg-gray-50 text-gray-500'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {comparison.year2 ? (change2 >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />) : <Minus className="h-4 w-4" />}
                            <span>{comparison.year2 ? `${change2 >= 0 ? '+' : ''}${change2.toFixed(1)}%` : '—'}</span>
                          </div>
                        </TableCell>
                        
                        {/* Citas Año -2 */}
                        <TableCell className="text-right">
                          {comparison.year2 ? formatNumber(comparison.year2.total) : '—'}
                        </TableCell>
                        <TableCell className={`text-right ${comparison.year3 ? (change3 >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700') : 'bg-gray-50 text-gray-500'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {comparison.year3 ? (change3 >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />) : <Minus className="h-4 w-4" />}
                            <span>{comparison.year3 ? `${change3 >= 0 ? '+' : ''}${change3.toFixed(1)}%` : '—'}</span>
                          </div>
                        </TableCell>
                        
                        {/* Citas Año -3 */}
                        <TableCell className="text-right">
                          {comparison.year3 ? formatNumber(comparison.year3.total) : '—'}
                        </TableCell>
                        <TableCell className={`text-right ${comparison.year4 ? (change4 >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700') : 'bg-gray-50 text-gray-500'}`}>
                          <div className="flex items-center justify-end gap-1">
                            {comparison.year4 ? (change4 >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />) : <Minus className="h-4 w-4" />}
                            <span>{comparison.year4 ? `${change4 >= 0 ? '+' : ''}${change4.toFixed(1)}%` : '—'}</span>
                          </div>
                        </TableCell>
                        
                        {/* Citas Año -4 */}
                        <TableCell className="text-right text-muted-foreground">
                          {comparison.year4 ? formatNumber(comparison.year4.total) : '—'}
                        </TableCell>
                        
                        {/* Canceladas */}
                        <TableCell className="text-right font-medium">
                          {formatNumber(comparison.current.cancelled)}
                        </TableCell>
                        <TableCell className="text-right">
                          {comparison.year1 ? formatNumber(comparison.year1.cancelled) : '—'}
                        </TableCell>
                        <TableCell className={`text-right ${getChangeColor(comparison.change.cancelled.isBetter, comparison.hasHistoricalData)}`}>
                          <div className="flex items-center justify-end gap-1">
                            {getChangeIcon(comparison.change.cancelled.isBetter, comparison.hasHistoricalData)}
                            <span>{formatChange(comparison.change.cancelled, comparison.hasHistoricalData)}</span>
                          </div>
                        </TableCell>
                        
                        {/* % Cancelación */}
                        <TableCell className="text-right font-medium">
                          {(comparison.current.cancellation_rate || 0).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {comparison.year1 ? `${(comparison.year1.cancellation_rate || 0).toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
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
      {/* Header con selectores */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativa por Tienda: Acuity vs Histórico</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Datos actuales de Acuity comparados con el mismo período en años anteriores
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selectores de período */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Período</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedPreset === 'este_mes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPreset('este_mes')}
              >
                Este Mes
              </Button>
              <Button
                variant={selectedPreset === 'ultimos_30' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPreset('ultimos_30')}
              >
                Últimos 30 Días
              </Button>
              <Button
                variant={selectedPreset === 'este_anio' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPreset('este_anio')}
              >
                Este Año
              </Button>
              <Button
                variant={selectedPreset === 'personalizado' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPreset('personalizado')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Personalizado
              </Button>
            </div>
          </div>
          
          {/* Selector de fechas personalizado */}
          {selectedPreset === 'personalizado' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <Label htmlFor="start-date" className="text-sm">Fecha Inicio</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="end-date" className="text-sm">Fecha Fin</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleCustomPeriod}
                  disabled={!customStartDate || !customEndDate}
                  className="w-full"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          )}
          
          {/* Selector de tiendas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Tiendas</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowStoreSelector(!showStoreSelector)}
              >
                {showStoreSelector ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Ocultar
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Mostrar ({selectedStores.length}/{availableStores.length})
                  </>
                )}
              </Button>
            </div>
            
            {showStoreSelector && (
              <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllStores}>
                    Seleccionar todas
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllStores}>
                    Deseleccionar todas
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableStores.map((store) => (
                    <div key={store} className="flex items-center space-x-2">
                      <Checkbox
                        id={`store-${store}`}
                        checked={selectedStores.includes(store)}
                        onCheckedChange={() => toggleStore(store)}
                      />
                      <label
                        htmlFor={`store-${store}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {store}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {!showStoreSelector && (
              <p className="text-sm text-muted-foreground">
                {selectedStores.length === availableStores.length 
                  ? 'Todas las tiendas seleccionadas' 
                  : `${selectedStores.length} de ${availableStores.length} tiendas seleccionadas`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Información del período */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                Período Seleccionado: {formatPeriod(dateRange.start, dateRange.end)}
              </p>
              <p className="text-xs text-blue-800 mt-1">
                Comparando con el mismo período en {historicalYears.join(', ')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabla de Medición */}
      {renderTable('Campañas de Medición', medicionComparisons)}
      
      {/* Tabla de Fitting */}
      {renderTable('Campañas de Fitting', fittingComparisons)}
    </div>
  );
}
