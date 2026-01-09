/**
 * API para obtener datos agrupados por tienda
 * GET /api/citas/historical/by-store
 * 
 * Query params:
 * - years: 2025,2024 (lista separada por comas)
 * - months: 1,2,3 (opcional, lista separada por comas)
 * - grouping: 'monthly' | 'annual' (por defecto 'monthly')
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
    const monthsParam = searchParams.get('months');
    const grouping = searchParams.get('grouping') || 'monthly';
    
    if (!yearsParam) {
      return NextResponse.json(
        { error: 'Se requiere parámetro: years' },
        { status: 400 }
      );
    }
    
    const years = yearsParam.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
    const months = monthsParam 
      ? monthsParam.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m))
      : null;
    
    if (years.length === 0) {
      return NextResponse.json(
        { error: 'Valores inválidos para years' },
        { status: 400 }
      );
    }
    
    console.log(`[By Store API] Fetching data for years: ${years.join(', ')}, grouping: ${grouping}`);
    
    // Usar función RPC para obtener datos por tienda
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_historical_stats_by_store', {
      p_years: years,
      p_months: months,
      p_grouping: grouping,
    });
    
    if (rpcError) {
      console.error(`[By Store API] RPC Error:`, rpcError);
      return NextResponse.json(
        { error: 'Error al obtener datos por tienda' },
        { status: 500 }
      );
    }
    
    console.log(`[By Store API] Success - Retrieved data for ${Object.keys(rpcData || {}).length} stores`);
    
    return NextResponse.json({
      years: years.sort((a, b) => b - a),
      months: months,
      grouping,
      data: rpcData || {},
    });
    
  } catch (error) {
    console.error('[By Store API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
