'use client'

/**
 * Sección principal de Comparativas Históricas
 * Contiene los 4 sub-tabs: General, Por Tienda, Patrones, Acuity vs Histórico
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralView } from './general-view';
import { TiendaView } from './tienda-view';
import { PatronesView } from './patrones-view';
import { AcuityVsHistoricalView } from './acuity-vs-historical-view';

export function HistoricalComparativesSection() {
  // Inicializar con el mes actual pero el año anterior si estamos en un año sin datos históricos
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  
  // Si estamos en 2026 o posterior, usar 2025 (último año con datos históricos completos)
  const defaultYear = currentYear > 2025 ? 2025 : currentYear;
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  
  const handleMonthChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };
  
  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="tienda">Por Tienda</TabsTrigger>
        <TabsTrigger value="patrones">Patrones</TabsTrigger>
        <TabsTrigger value="acuity-vs-historical">Acuity vs Histórico</TabsTrigger>
      </TabsList>
      
      <TabsContent value="general">
        <GeneralView
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={handleMonthChange}
        />
      </TabsContent>
      
      <TabsContent value="tienda">
        <TiendaView
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={handleMonthChange}
        />
      </TabsContent>
      
      <TabsContent value="patrones">
        <PatronesView
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          onMonthChange={handleMonthChange}
        />
      </TabsContent>
      
      <TabsContent value="acuity-vs-historical">
        <AcuityVsHistoricalView />
      </TabsContent>
    </Tabs>
  );
}

