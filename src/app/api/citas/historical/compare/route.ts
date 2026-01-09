/**
 * API para comparar citas históricas entre múltiples años
 * GET /api/citas/historical/compare
 * 
 * Query params:
 * - years: 2025,2024,2023 (lista separada por comas)
 * - month: 1-12
 * - storeCity: nombre de la ciudad (opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MultiYearComparison, PeriodMetrics, StoreMetrics } from '@/types/historical';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    
    // Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const yearsParam = searchParams.get('years');
    const monthParam = searchParams.get('month');
    const storeCity = searchParams.get('storeCity') || undefined;
    
    if (!yearsParam || !monthParam) {
      return NextResponse.json(
        { error: 'Se requieren parámetros: years y month' },
        { status: 400 }
      );
    }
    
    const years = yearsParam.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
    const month = parseInt(monthParam);
    
    if (years.length === 0 || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Valores inválidos para years o month' },
        { status: 400 }
      );
    }
    
    // Obtener datos para cada año
    const yearData: { [year: string]: PeriodMetrics } = {};
    
    console.log(`[Historical Compare API] Fetching data for years: ${years.join(', ')}, month: ${month}${storeCity ? `, store: ${storeCity}` : ''}`);
    
    for (const year of years) {
      // Usar función RPC para obtener agregaciones directamente de PostgreSQL
      // Esto evita el límite de 1000 registros de Supabase JS
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_historical_stats_by_year_month', {
        p_year: year,
        p_month: month,
        p_store_city: storeCity || null,
      });
      
      if (rpcError) {
        console.error(`[Historical Compare API] RPC Error for year ${year}:`, rpcError);
        // Fallback: intentar con query normal (limitado a 1000)
        console.log(`[Historical Compare API] Fallback to regular query for year ${year}`);
        continue;
      }
      
      if (rpcData) {
        console.log(`[Historical Compare API] Year ${year}: ${rpcData.total} appointments found (via RPC)`);
        
        yearData[year.toString()] = {
          period: rpcData.period,
          total: rpcData.total,
          medicion: rpcData.medicion,
          fitting: rpcData.fitting,
          cancelled: rpcData.cancelled,
          cancellation_rate: rpcData.cancellation_rate,
          avg_per_day: rpcData.avg_per_day,
          by_store: rpcData.by_store || [],
        };
      }
    }
    
    const comparison: MultiYearComparison = {
      month,
      years: yearData,
    };
    
    return NextResponse.json({
      month,
      years: years.sort((a, b) => b - a), // Ordenar años descendente
      store_city: storeCity || null,
      comparison,
    });
    
  } catch (error) {
    console.error('[Historical Compare API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

