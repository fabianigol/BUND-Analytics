/**
 * API para obtener totales anuales de múltiples años
 * GET /api/citas/historical/annual-totals
 * 
 * Query params:
 * - years: 2025,2024,2023 (lista separada por comas)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    
    if (!yearsParam) {
      return NextResponse.json(
        { error: 'Se requiere parámetro: years' },
        { status: 400 }
      );
    }
    
    const years = yearsParam.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
    
    if (years.length === 0) {
      return NextResponse.json(
        { error: 'Valores inválidos para years' },
        { status: 400 }
      );
    }
    
    console.log(`[Annual Totals API] Fetching data for years: ${years.join(', ')}`);
    
    // Usar función RPC para obtener totales anuales
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_historical_stats_annual', {
      p_years: years,
    });
    
    if (rpcError) {
      console.error(`[Annual Totals API] RPC Error:`, rpcError);
      return NextResponse.json(
        { error: 'Error al obtener datos anuales' },
        { status: 500 }
      );
    }
    
    console.log(`[Annual Totals API] Success - Retrieved data for ${Object.keys(rpcData || {}).length} years`);
    
    return NextResponse.json({
      years: years.sort((a, b) => b - a),
      data: rpcData || {},
    });
    
  } catch (error) {
    console.error('[Annual Totals API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
