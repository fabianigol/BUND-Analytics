import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { YearlyTargetTrend, StoreYearlyTrend, MonthlyTargetData } from '@/types';
import { getMonthLabel } from '@/lib/utils/date';
import { startOfMonth, endOfMonth, format } from 'date-fns';

type SalesTargetRow = Database['public']['Tables']['sales_targets']['Row'];
type ShopifyOrderRow = Database['public']['Tables']['shopify_orders']['Row'];

/**
 * Extrae la ubicación desde los tags del pedido
 */
function extractLocationFromTags(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  
  const knownLocations = ['Madrid', 'Sevilla', 'Málaga', 'Malaga', 'Barcelona', 'Bilbao', 'Valencia', 'Murcia', 'Zaragoza', 'México', 'Mexico', 'online'];
  
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    
    if (tagLower.startsWith('tienda:')) {
      const location = tag.substring(7).trim();
      return location || null;
    }
    
    for (const location of knownLocations) {
      if (tagLower === location.toLowerCase() || tagLower.includes(location.toLowerCase())) {
        return location;
      }
    }
  }
  
  return null;
}

/**
 * GET /api/sales-targets/yearly-trend
 * Calcula las tendencias anuales de consecución de objetivos
 * Query params: year
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const yearParam = searchParams.get('year');
    
    if (!yearParam) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro year' },
        { status: 400 }
      );
    }
    
    const year = parseInt(yearParam);
    
    console.log(`[Yearly Trend API] Calculando tendencias anuales para ${year}`);
    
    // 1. Obtener todos los objetivos del año
    const { data: allTargets, error: targetsError } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('year', year)
      .order('month', { ascending: true });
    
    if (targetsError) {
      console.error('[Yearly Trend API] Error fetching targets:', targetsError);
      return NextResponse.json(
        { error: 'Error al obtener objetivos' },
        { status: 500 }
      );
    }
    
    if (!allTargets || allTargets.length === 0) {
      console.log('[Yearly Trend API] No hay objetivos definidos para este año');
      return NextResponse.json({
        companyTrend: null,
        storeTrends: []
      });
    }
    
    // Cast a tipo correcto
    const targets = allTargets as SalesTargetRow[];
    
    // 2. Obtener ubicaciones únicas
    const uniqueLocations = Array.from(new Set(targets.map(t => t.location)));
    
    // 3. Preparar estructuras de datos
    const companyMonthlyData: MonthlyTargetData[] = [];
    const storeTrendsMap: { [location: string]: StoreYearlyTrend } = {};
    
    for (const location of uniqueLocations) {
      storeTrendsMap[location] = {
        location,
        year,
        monthlyData: []
      };
    }
    
    let totalTargetRevenue = 0;
    let totalCurrentRevenue = 0;
    
    // 4. Procesar cada mes del año
    for (let month = 1; month <= 12; month++) {
      const monthLabel = getMonthLabel(month);
      
      // Obtener objetivos del mes
      const monthTargets = targets.filter(t => t.month === month);
      
      // Calcular objetivo total del mes (suma de todas las tiendas)
      const totalTargetRevenueMonth = monthTargets.reduce((sum, t) => sum + t.target_revenue, 0);
      
      // Calcular fechas del mes
      const startDate = startOfMonth(new Date(year, month - 1, 1));
      const endDate = endOfMonth(startDate);
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      // Obtener facturación real del mes (todos los pedidos)
      const { data: monthOrders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('*')
        .gte('created_at', startDateStr)
        .lte('created_at', endDateStr);
      
      if (ordersError) {
        console.error(`[Yearly Trend API] Error fetching orders for month ${month}:`, ordersError);
      }
      
      const orders: ShopifyOrderRow[] = (monthOrders || []) as ShopifyOrderRow[];
      
      // Calcular facturación total del mes (suma de todos los pedidos)
      const totalCurrentRevenueMonth = orders.reduce((sum, order) => sum + (order.total_price || 0), 0);
      
      // Calcular % consecución del mes
      const achievementPercentage = totalTargetRevenueMonth > 0 
        ? (totalCurrentRevenueMonth / totalTargetRevenueMonth) * 100 
        : 0;
      
      // Añadir a datos mensuales de la empresa
      companyMonthlyData.push({
        month,
        monthLabel,
        targetRevenue: totalTargetRevenueMonth,
        currentRevenue: totalCurrentRevenueMonth,
        achievementPercentage
      });
      
      // Acumular totales anuales
      totalTargetRevenue += totalTargetRevenueMonth;
      totalCurrentRevenue += totalCurrentRevenueMonth;
      
      // Calcular datos por tienda
      for (const location of uniqueLocations) {
        const storeTarget = monthTargets.find(t => t.location === location);
        const targetRevenue = storeTarget ? storeTarget.target_revenue : 0;
        
        // Filtrar pedidos de esta ubicación
        const storeOrders = orders.filter(order => {
          const orderTags = (order as any).tags || [];
          
          // Para "online": pedidos SIN tags (o array vacío)
          if (location === 'online') {
            return !orderTags || orderTags.length === 0;
          }
          
          // Para tiendas físicas: pedidos CON el tag correspondiente
          const orderLocation = extractLocationFromTags(orderTags);
          return orderLocation === location;
        });
        
        const storeRevenue = storeOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);
        
        const storeAchievementPercentage = targetRevenue > 0
          ? (storeRevenue / targetRevenue) * 100
          : 0;
        
        storeTrendsMap[location].monthlyData.push({
          month,
          monthLabel,
          targetRevenue,
          currentRevenue: storeRevenue,
          achievementPercentage: storeAchievementPercentage
        });
      }
    }
    
    // 5. Calcular % total de consecución anual
    const totalAchievementPercentage = totalTargetRevenue > 0
      ? (totalCurrentRevenue / totalTargetRevenue) * 100
      : 0;
    
    // 6. Preparar respuesta
    const companyTrend: YearlyTargetTrend = {
      year,
      totalTargetRevenue,
      totalCurrentRevenue,
      totalAchievementPercentage,
      monthlyData: companyMonthlyData
    };
    
    const storeTrends: StoreYearlyTrend[] = Object.values(storeTrendsMap);
    
    console.log(`[Yearly Trend API] Tendencias calculadas para ${storeTrends.length} tiendas`);
    
    return NextResponse.json({
      companyTrend,
      storeTrends
    });
  } catch (error) {
    console.error('[Yearly Trend API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
