import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';

type SalesTargetRow = Database['public']['Tables']['sales_targets']['Row'];
type SalesTargetInsert = Database['public']['Tables']['sales_targets']['Insert'];

/**
 * GET /api/sales-targets
 * Obtiene objetivos de facturación con filtros opcionales
 * Query params: year, month, location
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const location = searchParams.get('location');
    
    let query = supabase
      .from('sales_targets')
      .select('*');
    
    // Aplicar filtros
    if (year) {
      query = query.eq('year', parseInt(year));
    }
    if (month) {
      query = query.eq('month', parseInt(month));
    }
    if (location) {
      query = query.eq('location', location);
    }
    
    // Ordenar por año y mes descendente
    query = query.order('year', { ascending: false }).order('month', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[Sales Targets API] Error fetching targets:', error);
      return NextResponse.json(
        { error: 'Error al obtener objetivos de facturación' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[Sales Targets API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales-targets
 * Crea o actualiza un objetivo de facturación (upsert)
 * Body: { location, year, month, targetRevenue, targetAov, conversionRate }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    
    // Validaciones
    const { location, year, month, targetRevenue, targetAov, conversionRate } = body;
    
    if (!location || !year || !month || !targetRevenue || !targetAov) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: location, year, month, targetRevenue, targetAov' },
        { status: 400 }
      );
    }
    
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'El mes debe estar entre 1 y 12' },
        { status: 400 }
      );
    }
    
    if (targetRevenue <= 0) {
      return NextResponse.json(
        { error: 'El objetivo de facturación debe ser mayor que 0' },
        { status: 400 }
      );
    }
    
    if (targetAov <= 0 || targetAov > targetRevenue) {
      return NextResponse.json(
        { error: 'El AOV debe ser mayor que 0 y menor que el objetivo de facturación' },
        { status: 400 }
      );
    }
    
    if (conversionRate && (conversionRate < 0.01 || conversionRate > 100)) {
      return NextResponse.json(
        { error: 'La tasa de conversión debe estar entre 0.01 y 100' },
        { status: 400 }
      );
    }
    
    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Preparar datos para insertar
    const targetData: SalesTargetInsert = {
      location,
      year: parseInt(year),
      month: parseInt(month),
      target_revenue: parseFloat(targetRevenue),
      target_aov: parseFloat(targetAov),
      conversion_rate: conversionRate ? parseFloat(conversionRate) : 50.00,
      created_by: user.id,
    };
    
    // Upsert: actualizar si existe, insertar si no
    const { data, error } = await supabase
      .from('sales_targets')
      .upsert(targetData as any, {
        onConflict: 'location,year,month',
      })
      .select()
      .single();
    
    if (error) {
      console.error('[Sales Targets API] Error upserting target:', error);
      return NextResponse.json(
        { error: 'Error al guardar objetivo de facturación' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[Sales Targets API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sales-targets
 * Elimina un objetivo de facturación
 * Query param: id
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID del objetivo' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('sales_targets')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[Sales Targets API] Error deleting target:', error);
      return NextResponse.json(
        { error: 'Error al eliminar objetivo de facturación' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[Sales Targets API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
