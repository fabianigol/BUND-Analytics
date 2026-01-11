import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Database } from '@/types/database';
import { LocationTargetProgress, WeeklyProgress } from '@/types';
import { getWeeksOfMonth } from '@/lib/utils/date';
import { format, startOfMonth, endOfMonth } from 'date-fns';

type SalesTargetRow = Database['public']['Tables']['sales_targets']['Row'];
type ShopifyOrderRow = Database['public']['Tables']['shopify_orders']['Row'];
type AcuityAppointmentRow = Database['public']['Tables']['acuity_appointments']['Row'];

/**
 * Extrae la ubicación desde los tags del pedido
 */
function extractLocationFromTags(tags: string[] | null | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  
  const knownLocations = ['Madrid', 'Sevilla', 'Málaga', 'Malaga', 'Barcelona', 'Bilbao', 'Valencia', 'Murcia', 'Zaragoza', 'México', 'Mexico', 'online'];
  
  for (const tag of tags) {
    const tagLower = tag.toLowerCase().trim();
    
    // Buscar formato "Tienda: X"
    if (tagLower.startsWith('tienda:')) {
      const location = tag.substring(7).trim();
      return location || null;
    }
    
    // Buscar ubicación conocida directamente
    for (const location of knownLocations) {
      if (tagLower === location.toLowerCase() || tagLower.includes(location.toLowerCase())) {
        return location;
      }
    }
  }
  
  return null;
}

/**
 * Normaliza el nombre de la tienda para comparaciones
 */
function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/the bundclub /gi, '')
    .replace(/málaga/gi, 'malaga')
    .trim();
}

/**
 * Mapea el nombre del calendario de Acuity a una ubicación
 */
function mapCalendarToLocation(appointmentTypeName: string): string | null {
  const normalized = normalizeStoreName(appointmentTypeName);
  
  const locationMap: { [key: string]: string } = {
    'madrid': 'Madrid',
    'sevilla': 'Sevilla',
    'malaga': 'Málaga',
    'málaga': 'Málaga',
    'barcelona': 'Barcelona',
    'bilbao': 'Bilbao',
    'valencia': 'Valencia',
    'murcia': 'Murcia',
    'zaragoza': 'Zaragoza',
    'méxico': 'México',
    'mexico': 'México',
  };
  
  for (const [key, location] of Object.entries(locationMap)) {
    if (normalized.includes(key)) {
      return location;
    }
  }
  
  return null;
}

/**
 * GET /api/sales-targets/progress
 * Calcula el progreso de objetivos para un mes específico
 * Query params: year, month
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    
    if (!yearParam || !monthParam) {
      return NextResponse.json(
        { error: 'Se requieren los parámetros year y month' },
        { status: 400 }
      );
    }
    
    const year = parseInt(yearParam);
    const month = parseInt(monthParam);
    
    if (month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'El mes debe estar entre 1 y 12' },
        { status: 400 }
      );
    }
    
    console.log(`[Sales Targets Progress] Calculando progreso para ${year}-${month}`);
    
    // 1. Obtener objetivos del mes
    const { data: targets, error: targetsError } = await supabase
      .from('sales_targets')
      .select('*')
      .eq('year', year)
      .eq('month', month);
    
    if (targetsError) {
      console.error('[Sales Targets Progress] Error fetching targets:', targetsError);
      return NextResponse.json(
        { error: 'Error al obtener objetivos' },
        { status: 500 }
      );
    }
    
    if (!targets || targets.length === 0) {
      console.log('[Sales Targets Progress] No hay objetivos definidos para este mes');
      return NextResponse.json([]);
    }
    
    // 2. Calcular fechas del mes
    const startDate = startOfMonth(new Date(year, month - 1, 1));
    const endDate = endOfMonth(startDate);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    
    console.log(`[Sales Targets Progress] Rango de fechas: ${startDateStr} - ${endDateStr}`);
    
    // 3. Obtener pedidos del mes
    const { data: orders, error: ordersError } = await supabase
      .from('shopify_orders')
      .select('*')
      .gte('created_at', startDateStr)
      .lte('created_at', endDateStr);
    
    if (ordersError) {
      console.error('[Sales Targets Progress] Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Error al obtener pedidos' },
        { status: 500 }
      );
    }
    
    // 4. Obtener citas de medición del mes
    const { data: appointments, error: appointmentsError } = await supabase
      .from('acuity_appointments')
      .select('*')
      .eq('appointment_category', 'medición')
      .eq('status', 'scheduled')
      .gte('datetime', startDateStr)
      .lte('datetime', endDateStr);
    
    if (appointmentsError) {
      console.error('[Sales Targets Progress] Error fetching appointments:', appointmentsError);
    }
    
    // 5. Dividir el mes en semanas
    const weeks = getWeeksOfMonth(year, month);
    
    // 6. Calcular progreso para cada ubicación
    const progressData: LocationTargetProgress[] = [];
    
    for (const target of targets as SalesTargetRow[]) {
      const location = target.location;
      
      // Filtrar pedidos de esta ubicación
      const locationOrders: ShopifyOrderRow[] = (orders || []).filter(order => {
        const orderTags = (order as any).tags || [];
        
        // Para "online": pedidos SIN tags (o array vacío)
        if (location === 'online') {
          return !orderTags || orderTags.length === 0;
        }
        
        // Para tiendas físicas: pedidos CON el tag correspondiente
        const orderLocation = extractLocationFromTags(orderTags);
        return orderLocation === location;
      }) as ShopifyOrderRow[];
      
      // Calcular métricas actuales
      const currentRevenue = locationOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);
      const currentOrders = locationOrders.length;
      const currentAov = currentOrders > 0 ? currentRevenue / currentOrders : 0;
      
      // Filtrar citas de esta ubicación (solo para tiendas físicas)
      let currentAppointments = 0;
      let locationAppointments: AcuityAppointmentRow[] = [];
      
      if (location !== 'online') {
        locationAppointments = (appointments || []).filter((apt: AcuityAppointmentRow) => {
          const aptLocation = mapCalendarToLocation(apt.appointment_type_name || '');
          return aptLocation === location;
        }) as AcuityAppointmentRow[];
        currentAppointments = locationAppointments.length;
      }
      
      // Calcular objetivos
      const targetRevenue = target.target_revenue;
      const targetAov = target.target_aov;
      const conversionRate = target.conversion_rate;
      const targetOrders = targetRevenue / targetAov;
      const targetAppointments = targetOrders / (conversionRate / 100);
      
      // Calcular progreso
      const progressPercentage = (currentRevenue / targetRevenue) * 100;
      
      // Calcular desglose semanal
      const weeklyBreakdown: WeeklyProgress[] = [];
      
      for (const week of weeks) {
        // Filtrar pedidos de la semana
        const weekOrders = locationOrders.filter(order => {
          const orderDate = order.created_at;
          return orderDate >= week.startDate && orderDate <= week.endDate;
        });
        
        const weekRevenue = weekOrders.reduce((sum, order) => sum + (order.total_price || 0), 0);
        const weekOrdersCount = weekOrders.length;
        
        // Filtrar citas de la semana (solo para tiendas físicas)
        let weekAppointmentsCount = 0;
        if (location !== 'online') {
          const weekAppointments = locationAppointments.filter(apt => {
            const aptDate = apt.datetime.split('T')[0]; // Solo fecha, sin hora
            return aptDate >= week.startDate && aptDate <= week.endDate;
          });
          weekAppointmentsCount = weekAppointments.length;
        }
        
        // Objetivos proporcionales por semana
        const targetRevenuePerWeek = targetRevenue / weeks.length;
        const targetOrdersPerWeek = targetOrders / weeks.length;
        const targetAppointmentsPerWeek = targetAppointments / weeks.length;
        
        weeklyBreakdown.push({
          weekNumber: week.weekNumber,
          weekLabel: week.weekLabel,
          startDate: week.startDate,
          endDate: week.endDate,
          targetRevenue: targetRevenuePerWeek,
          currentRevenue: weekRevenue,
          revenueProgress: targetRevenuePerWeek > 0 ? (weekRevenue / targetRevenuePerWeek) * 100 : 0,
          targetAppointments: targetAppointmentsPerWeek,
          currentAppointments: weekAppointmentsCount,
          appointmentsProgress: targetAppointmentsPerWeek > 0 ? (weekAppointmentsCount / targetAppointmentsPerWeek) * 100 : 0,
          targetOrders: targetOrdersPerWeek,
          currentOrders: weekOrdersCount,
          ordersProgress: targetOrdersPerWeek > 0 ? (weekOrdersCount / targetOrdersPerWeek) * 100 : 0,
        });
      }
      
      // Datos diarios para gráficos (simplificado por ahora)
      const dailyRevenue: Array<{ date: string; value: number }> = [];
      const monthlyRevenue: Array<{ date: string; value: number }> = [];
      
      progressData.push({
        location,
        targetRevenue,
        currentRevenue,
        progressPercentage,
        targetAov,
        currentAov,
        conversionRate,
        targetOrders,
        currentOrders,
        targetAppointments,
        currentAppointments,
        weeklyBreakdown,
        monthlyRevenue,
        dailyRevenue,
      });
    }
    
    console.log(`[Sales Targets Progress] Calculado progreso para ${progressData.length} ubicaciones`);
    
    return NextResponse.json(progressData);
  } catch (error) {
    console.error('[Sales Targets Progress] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
