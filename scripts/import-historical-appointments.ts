/**
 * Script para importar citas históricas desde Excel a Supabase
 * Basado en análisis real: 58,011 registros desde 2020-2025
 * 
 * Columnas del Excel:
 * A: Event Type Name (73 variaciones únicas, 98.8% con corchetes)
 * B: Invitee Name
 * C: Invitee Email
 * D: Start Date & Time (formato: YYYY-MM-DD HH:MM)
 * E: Canceled (string "true" o "false")
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const EXCEL_PATH = path.join(__dirname, '..', 'public', 'Citas historico', 'Calendly Código Histórico.xlsx');
const BATCH_SIZE = 500; // Insertar en lotes de 500 registros

// Interfaces
interface ExcelRow {
  'Event Type Name': string;
  'Invitee Name': string;
  'Invitee Email': string;
  'Start Date & Time': string;
  'Canceled': string;
}

interface ParsedAppointment {
  datetime: string; // ISO 8601 timestamp
  client_name: string;
  client_email: string;
  store_city: string;
  appointment_type: 'medicion' | 'fitting';
  event_category: 'regular' | 'tour' | 'videoconsulta' | 'ponte_traje';
  event_type_name_original: string;
  is_cancelled: boolean;
  year: number;
  month: number;
  day_of_week: number;
  hour: number;
}

interface ParseResult {
  city: string | null;
  appointmentType: 'medicion' | 'fitting';
  eventCategory: 'regular' | 'tour' | 'videoconsulta' | 'ponte_traje';
}

// Estadísticas
interface Stats {
  totalProcessed: number;
  totalInserted: number;
  totalSkipped: number;
  byCity: Record<string, number>;
  byType: { medicion: number; fitting: number };
  byCategory: Record<string, number>;
  errors: Array<{ row: number; reason: string; event: string }>;
}

/**
 * Normaliza el nombre de una ciudad
 */
function normalizeCity(city: string): string {
  const cityMap: Record<string, string> = {
    'madrid': 'Madrid',
    'barcelona': 'Barcelona',
    'sevilla': 'Sevilla',
    'seville': 'Sevilla',
    'málaga': 'Málaga',
    'malaga': 'Málaga',
    'bilbao': 'Bilbao',
    'valencia': 'Valencia',
    'murcia': 'Murcia',
    'zaragoza': 'Zaragoza',
    'cdmx': 'CDMX',
    'méxico': 'CDMX',
    'mexico': 'CDMX',
    'polanco': 'CDMX',
    'granada': 'Granada',
    'córdoba': 'Córdoba',
    'cordoba': 'Córdoba',
    'salamanca': 'Salamanca',
    'almería': 'Almería',
    'almeria': 'Almería',
    'coruña': 'A Coruña',
    'a coruña': 'A Coruña',
  };
  
  return cityMap[city.toLowerCase()] || city;
}

/**
 * Parsea el Event Type Name para extraer ciudad, tipo y categoría
 * Maneja 73 variaciones diferentes del formato
 */
function parseEventTypeName(eventName: string): ParseResult {
  // Validar que eventName no sea undefined o null
  if (!eventName || typeof eventName !== 'string') {
    return {
      city: null,
      appointmentType: 'medicion',
      eventCategory: 'regular'
    };
  }
  
  const normalized = eventName.toLowerCase().trim();
  
  // 1. Detectar tipo de cita (fitting vs medición)
  const isFitting = normalized.includes('fitting');
  
  // 2. Detectar categoría especial
  let eventCategory: 'regular' | 'tour' | 'videoconsulta' | 'ponte_traje' = 'regular';
  
  if (normalized.includes('bundtour') || normalized.includes('tour')) {
    eventCategory = 'tour';
  } else if (normalized.includes('videoconsulta')) {
    eventCategory = 'videoconsulta';
  } else if (normalized.includes('ponte traje') || normalized.includes('viste a medida')) {
    eventCategory = 'ponte_traje';
  }
  
  // 3. Extraer ciudad de lista fija
  // Lista basada en análisis real: Madrid 47.9%, Sevilla 29.2%, Málaga 10.6%, Barcelona 5.4%, etc.
  const cities = [
    'madrid', 'barcelona', 'sevilla', 'seville', 
    'málaga', 'malaga', 'bilbao', 'valencia', 
    'murcia', 'zaragoza', 'cdmx', 'méxico', 'mexico', 'polanco',
    'granada', 'córdoba', 'cordoba', 'salamanca', 
    'almería', 'almeria', 'coruña', 'a coruña',
    'el puerto', 'sta. maría', 'santa maría'
  ];
  
  let foundCity: string | null = null;
  
  // Buscar ciudad en el texto
  for (const city of cities) {
    if (normalized.includes(city)) {
      foundCity = normalizeCity(city);
      break;
    }
  }
  
  return {
    city: foundCity,
    appointmentType: isFitting ? 'fitting' : 'medicion',
    eventCategory
  };
}

/**
 * Parsea la fecha y hora del formato Excel
 */
function parseDateTime(dateTimeStr: string): string | null {
  try {
    // Formato esperado: "YYYY-MM-DD HH:MM"
    // Ejemplo: "2020-10-25 09:00"
    const trimmed = dateTimeStr.trim();
    
    // Validar formato básico
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) {
      return null;
    }
    
    // Convertir a ISO 8601 timestamp (añadir segundos y timezone)
    const isoTimestamp = `${trimmed}:00+00:00`;
    
    // Validar que sea una fecha válida
    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return isoTimestamp;
  } catch (error) {
    return null;
  }
}

/**
 * Parsea el valor de cancelación
 */
function parseCanceled(canceledStr: string): boolean {
  return canceledStr.trim().toLowerCase() === 'true';
}

/**
 * Procesa una fila del Excel
 */
function processRow(row: ExcelRow, rowNumber: number): { appointment: ParsedAppointment | null; error: string | null } {
  // Parsear Event Type Name
  const parseResult = parseEventTypeName(row['Event Type Name']);
  
  if (!parseResult.city) {
    return {
      appointment: null,
      error: `No se pudo detectar ciudad en: "${row['Event Type Name']}"`
    };
  }
  
  // Parsear fecha y hora
  const datetime = parseDateTime(row['Start Date & Time']);
  if (!datetime) {
    return {
      appointment: null,
      error: `Fecha inválida: "${row['Start Date & Time']}"`
    };
  }
  
  // Calcular campos derivados de datetime para optimizar consultas
  const dateObj = new Date(datetime);
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth() + 1; // getUTCMonth() devuelve 0-11
  const day_of_week = dateObj.getUTCDay(); // 0=Domingo, 6=Sábado
  const hour = dateObj.getUTCHours();
  
  // Crear objeto de cita
  const appointment: ParsedAppointment = {
    datetime,
    client_name: row['Invitee Name']?.trim() || '',
    client_email: row['Invitee Email']?.trim() || '',
    store_city: parseResult.city,
    appointment_type: parseResult.appointmentType,
    event_category: parseResult.eventCategory,
    event_type_name_original: row['Event Type Name'],
    is_cancelled: parseCanceled(row['Canceled']),
    year,
    month,
    day_of_week,
    hour
  };
  
  return { appointment, error: null };
}

/**
 * Inserta un lote de citas en Supabase
 */
async function insertBatch(supabase: any, appointments: ParsedAppointment[]): Promise<{ success: number; errors: number }> {
  try {
    const { data, error } = await supabase
      .from('historical_appointments')
      .insert(appointments);
    
    if (error) {
      console.error('Error insertando lote:', error);
      return { success: 0, errors: appointments.length };
    }
    
    return { success: appointments.length, errors: 0 };
  } catch (error) {
    console.error('Error en insertBatch:', error);
    return { success: 0, errors: appointments.length };
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando importación de citas históricas...\n');
  console.log(`📂 Excel: ${EXCEL_PATH}`);
  console.log(`📦 Tamaño de lote: ${BATCH_SIZE} registros\n`);
  
  // Verificar variables de entorno
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno SUPABASE no configuradas');
    console.error('   Verifica .env.local');
    process.exit(1);
  }
  
  // Crear cliente de Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Leer Excel
  console.log('📖 Leyendo archivo Excel...');
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convertir a JSON
  const rawData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
  console.log(`✅ Excel leído: ${rawData.length} registros encontrados\n`);
  
  // Inicializar estadísticas
  const stats: Stats = {
    totalProcessed: 0,
    totalInserted: 0,
    totalSkipped: 0,
    byCity: {},
    byType: { medicion: 0, fitting: 0 },
    byCategory: {},
    errors: []
  };
  
  // Procesar registros
  let batch: ParsedAppointment[] = [];
  
  console.log('⚙️  Procesando registros...\n');
  
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    stats.totalProcessed++;
    
    // Mostrar progreso cada 1000 registros
    if (stats.totalProcessed % 1000 === 0) {
      console.log(`   Procesados: ${stats.totalProcessed}/${rawData.length} (${((stats.totalProcessed / rawData.length) * 100).toFixed(1)}%)`);
    }
    
    // Procesar fila
    const { appointment, error } = processRow(row, i + 2); // +2 porque Excel empieza en 1 y hay header
    
    if (error) {
      stats.totalSkipped++;
      stats.errors.push({
        row: i + 2,
        reason: error,
        event: row['Event Type Name']
      });
      continue;
    }
    
    if (appointment) {
      batch.push(appointment);
      
      // Actualizar estadísticas
      stats.byCity[appointment.store_city] = (stats.byCity[appointment.store_city] || 0) + 1;
      stats.byType[appointment.appointment_type]++;
      stats.byCategory[appointment.event_category] = (stats.byCategory[appointment.event_category] || 0) + 1;
      
      // Insertar lote cuando alcanza el tamaño
      if (batch.length >= BATCH_SIZE) {
        const result = await insertBatch(supabase, batch);
        stats.totalInserted += result.success;
        batch = [];
      }
    }
  }
  
  // Insertar último lote si quedó algo
  if (batch.length > 0) {
    const result = await insertBatch(supabase, batch);
    stats.totalInserted += result.success;
  }
  
  console.log(`\n✅ Procesamiento completado!\n`);
  
  // Mostrar estadísticas finales
  console.log('📊 ESTADÍSTICAS FINALES:');
  console.log('========================\n');
  console.log(`Total procesado: ${stats.totalProcessed}`);
  console.log(`Total insertado: ${stats.totalInserted} (${((stats.totalInserted / stats.totalProcessed) * 100).toFixed(1)}%)`);
  console.log(`Total omitido:   ${stats.totalSkipped} (${((stats.totalSkipped / stats.totalProcessed) * 100).toFixed(1)}%)\n`);
  
  console.log('📍 Distribución por ciudad:');
  const sortedCities = Object.entries(stats.byCity).sort((a, b) => b[1] - a[1]);
  sortedCities.forEach(([city, count]) => {
    const percentage = ((count / stats.totalInserted) * 100).toFixed(1);
    console.log(`   ${city.padEnd(15)} ${count.toString().padStart(6)}  (${percentage}%)`);
  });
  
  console.log('\n📋 Distribución por tipo:');
  console.log(`   Medición: ${stats.byType.medicion} (${((stats.byType.medicion / stats.totalInserted) * 100).toFixed(1)}%)`);
  console.log(`   Fitting:  ${stats.byType.fitting} (${((stats.byType.fitting / stats.totalInserted) * 100).toFixed(1)}%)`);
  
  console.log('\n🏷️  Distribución por categoría:');
  Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
    const percentage = ((count / stats.totalInserted) * 100).toFixed(1);
    console.log(`   ${category.padEnd(15)} ${count.toString().padStart(6)}  (${percentage}%)`);
  });
  
  // Mostrar errores si los hay (solo primeros 20)
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Registros con problemas: ${stats.errors.length}`);
    console.log('\nPrimeros 20 errores:');
    stats.errors.slice(0, 20).forEach(err => {
      console.log(`   Fila ${err.row}: ${err.reason}`);
      console.log(`      Event: "${err.event}"`);
    });
    
    if (stats.errors.length > 20) {
      console.log(`\n   ... y ${stats.errors.length - 20} errores más`);
    }
  }
  
  console.log('\n✨ Importación finalizada!\n');
}

// Ejecutar
main().catch(error => {
  console.error('\n❌ Error fatal en la importación:', error);
  process.exit(1);
});

