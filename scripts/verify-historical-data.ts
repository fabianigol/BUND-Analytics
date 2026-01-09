/**
 * Script de verificación de datos históricos importados
 * Valida métricas y distribuciones
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase credentials in environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyData() {
  console.log('🔍 Verificando datos históricos importados...\n');
  
  try {
    // 1. Total de registros
    console.log('1️⃣ Total de registros:');
    const { count: totalCount, error: countError } = await supabase
      .from('historical_appointments')
      .select('*', { count: 'exact', head: true });
    
    if (countError) throw countError;
    console.log(`   ✓ Total: ${totalCount?.toLocaleString()} registros\n`);
    
    // 2. Distribución por tienda
    console.log('2️⃣ Distribución por tienda:');
    const { data: byStore, error: storeError } = await supabase
      .from('historical_appointments')
      .select('store_city')
      .then(async (result) => {
        if (result.error) throw result.error;
        
        // Agrupar manualmente
        const storeMap = new Map<string, number>();
        result.data?.forEach((row) => {
          const count = storeMap.get(row.store_city) || 0;
          storeMap.set(row.store_city, count + 1);
        });
        
        return Array.from(storeMap.entries())
          .map(([store, count]) => ({ store_city: store, count }))
          .sort((a, b) => b.count - a.count);
      });
    
    if (storeError) throw storeError;
    
    if (byStore) {
      byStore.forEach((s: any) => {
        const percentage = ((s.count / (totalCount || 1)) * 100).toFixed(1);
        console.log(`   ${s.store_city}: ${s.count.toLocaleString()} (${percentage}%)`);
      });
      console.log();
    }
    
    // 3. Distribución por año
    console.log('3️⃣ Distribución por año:');
    const { data: byYear, error: yearError } = await supabase
      .from('historical_appointments')
      .select('year')
      .then(async (result) => {
        if (result.error) throw result.error;
        
        const yearMap = new Map<number, number>();
        result.data?.forEach((row) => {
          const count = yearMap.get(row.year) || 0;
          yearMap.set(row.year, count + 1);
        });
        
        return Array.from(yearMap.entries())
          .map(([year, count]) => ({ year, count }))
          .sort((a, b) => b.year - a.year);
      });
    
    if (yearError) throw yearError;
    
    if (byYear) {
      byYear.forEach((y: any) => {
        console.log(`   ${y.year}: ${y.count.toLocaleString()} citas`);
      });
      console.log();
    }
    
    // 4. Distribución por tipo de cita
    console.log('4️⃣ Distribución por tipo de cita:');
    const { data: byType, error: typeError } = await supabase
      .from('historical_appointments')
      .select('appointment_type')
      .then(async (result) => {
        if (result.error) throw result.error;
        
        const typeMap = new Map<string, number>();
        result.data?.forEach((row) => {
          const count = typeMap.get(row.appointment_type) || 0;
          typeMap.set(row.appointment_type, count + 1);
        });
        
        return Array.from(typeMap.entries())
          .map(([type, count]) => ({ type, count }));
      });
    
    if (typeError) throw typeError;
    
    if (byType) {
      byType.forEach((t: any) => {
        const percentage = ((t.count / (totalCount || 1)) * 100).toFixed(1);
        console.log(`   ${t.type}: ${t.count.toLocaleString()} (${percentage}%)`);
      });
      console.log();
    }
    
    // 5. Tasa de cancelación
    console.log('5️⃣ Tasa de cancelación:');
    const { data: cancelled, error: cancelError } = await supabase
      .from('historical_appointments')
      .select('is_cancelled')
      .then(async (result) => {
        if (result.error) throw result.error;
        
        const cancelledCount = result.data?.filter((r) => r.is_cancelled).length || 0;
        const totalForCancel = result.data?.length || 0;
        
        return {
          cancelled: cancelledCount,
          total: totalForCancel,
          rate: totalForCancel > 0 ? (cancelledCount / totalForCancel) * 100 : 0,
        };
      });
    
    if (cancelError) throw cancelError;
    
    if (cancelled) {
      console.log(`   Canceladas: ${cancelled.cancelled.toLocaleString()}`);
      console.log(`   No canceladas: ${(cancelled.total - cancelled.cancelled).toLocaleString()}`);
      console.log(`   Tasa: ${cancelled.rate.toFixed(2)}%\n`);
    }
    
    // 6. Verificar campos calculados (year, month, day_of_week, hour)
    console.log('6️⃣ Verificando campos calculados:');
    const { data: nullFields, error: nullError } = await supabase
      .from('historical_appointments')
      .select('id')
      .or('year.is.null,month.is.null,day_of_week.is.null,hour.is.null');
    
    if (nullError) throw nullError;
    
    if (!nullFields || nullFields.length === 0) {
      console.log('   ✓ Todos los campos calculados están completos\n');
    } else {
      console.warn(`   ⚠ ${nullFields.length} registros con campos calculados nulos\n`);
    }
    
    // 7. Muestra de datos
    console.log('7️⃣ Muestra de datos (primeros 3 registros):');
    const { data: sample, error: sampleError } = await supabase
      .from('historical_appointments')
      .select('datetime, store_city, appointment_type, is_cancelled, year, month')
      .order('datetime', { ascending: false })
      .limit(3);
    
    if (sampleError) throw sampleError;
    
    if (sample) {
      sample.forEach((s) => {
        console.log(`   ${s.datetime} | ${s.store_city} | ${s.appointment_type} | Cancelada: ${s.is_cancelled} | ${s.year}-${String(s.month).padStart(2, '0')}`);
      });
      console.log();
    }
    
    console.log('✅ Verificación completada con éxito\n');
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    process.exit(1);
  }
}

verifyData();

