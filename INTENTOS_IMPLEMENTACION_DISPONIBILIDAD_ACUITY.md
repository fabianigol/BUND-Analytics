# Resumen Completo: Intentos de Implementación de Disponibilidad de Citas Acuity

**Fecha de creación:** 25 de Diciembre 2025  
**Estado:** ❌ NO FUNCIONAL - Todas las implementaciones han devuelto 0 slots disponibles  
**Último intento:** 25 de Diciembre 2025, 23:48

---

## 📋 Índice

1. [Problema Inicial](#problema-inicial)
2. [Objetivo](#objetivo)
3. [Estrategias Implementadas](#estrategias-implementadas)
4. [Cambios en Base de Datos](#cambios-en-base-de-datos)
5. [Cambios en Código](#cambios-en-código)
6. [Logs y Errores](#logs-y-errores)
7. [Análisis del Problema](#análisis-del-problema)
8. [Estado Actual](#estado-actual)
9. [Próximos Pasos Sugeridos](#próximos-pasos-sugeridos)

---

## 🎯 Problema Inicial

**Situación:**
- El sistema sincroniza correctamente las **citas reservadas** desde Acuity Scheduling.
- Las citas reservadas se muestran correctamente en la interfaz.
- **NO** se obtienen los **slots disponibles** (huecos libres) para citas futuras.
- Necesidad: Calcular ocupación por tienda (medición vs fitting) basada en:
  - Total de slots disponibles
  - Slots reservados
  - Porcentaje de ocupación semanal/mensual/trimestral

**Motivación:**
- Saber cuántas citas disponibles hay en el futuro por tienda.
- Calcular porcentajes de ocupación históricos.
- Comparar ocupación entre tiendas y periodos.

---

## 🎯 Objetivo

Implementar un sistema que:

1. ✅ Obtenga **TODOS los slots disponibles** para citas futuras desde la API de Acuity.
2. ✅ Agrupe los slots por **tienda** (store) y **categoría** (medición/fitting).
3. ✅ Calcule **slots reservados** desde `acuity_appointments`.
4. ✅ Calcule **slots libres** = total - reservados.
5. ✅ Guarde datos históricos para comparativas.
6. ✅ Muestre estadísticas en el dashboard.

---

## 🔄 Estrategias Implementadas

### Estrategia 1: Llamada Directa a `/availability/times` con `days` y `month`

**Fecha:** Primera implementación

**Enfoque:**
- Llamar `/availability/times` con parámetros `date`, `appointmentTypeID`, y opcionalmente `days` o `month`.
- Intentar obtener disponibilidad agregada sin especificar `calendarID`.

**Implementación:**
```typescript
// Código inicial en route.ts
const availability = await acuityService.getAvailability({
  date: format(currentDate, 'yyyy-MM-dd'),
  days: Math.min(daysInRange, 30),
  appointmentTypeID: typeInfo.type.id,
})
```

**Resultado:** ❌ 
- La API devolvía `datesCount: 0, totalSlots: 0`.
- La documentación oficial indica que `/availability/times` **NO acepta `days` ni `month`** como parámetros válidos.

**Logs:**
```
[Acuity Sync] Availability response for type 57323769 from 2025-12-25: { datesCount: 0, totalSlots: 0 }
```

**Lección aprendida:**
- `/availability/times` solo acepta: `date` (obligatorio), `appointmentTypeID` (obligatorio), `calendarID` (opcional).
- `days` y `month` no son parámetros válidos para este endpoint.

---

### Estrategia 2: Llamada a `/availability/times` sin `calendarID` (agregado)

**Fecha:** Segundo intento

**Enfoque:**
- Llamar `/availability/times` con solo `date` y `appointmentTypeID` (sin `calendarID`).
- Esperar que devuelva todos los slots de todos los empleados para ese tipo de cita.

**Implementación:**
```typescript
const availability = await acuityService.getAvailability({
  date: format(currentDate, 'yyyy-MM-dd'),
  appointmentTypeID: typeInfo.type.id,
  // calendarID omitido intencionalmente
})
```

**Resultado:** ❌
- Continuaba devolviendo `datesCount: 0, totalSlots: 0`.
- Mismo comportamiento que la estrategia anterior.

**Logs:**
- Múltiples logs mostrando `datesCount: 0, totalSlots: 0` para todos los tipos de cita.

**Lección aprendida:**
- La API podría requerir que los tipos de cita estén configurados como "públicos" o tener disponibilidad activa en Acuity.
- O podría ser necesario llamar por cada `calendarID` (empleado) individualmente.

---

### Estrategia 3: Uso de `/availability/dates` + `/availability/times` (dos pasos)

**Fecha:** Tercer intento

**Enfoque:**
1. Primero llamar `/availability/dates` con `month` y `appointmentTypeID` para obtener fechas disponibles.
2. Luego, para cada fecha, llamar `/availability/times` con `date` y `appointmentTypeID`.

**Implementación:**
```typescript
// Paso 1: Obtener fechas disponibles
const availableDates = await this.getAvailableDates({
  month: monthStr, // "YYYY-MM"
  appointmentTypeID: params.appointmentTypeID,
})

// Paso 2: Para cada fecha, obtener slots
for (const dateData of availableDates) {
  const availability = await this.getAvailability({
    date: dateData.date,
    appointmentTypeID: params.appointmentTypeID,
  })
}
```

**Resultado:** ❌
- `/availability/dates` parecía funcionar (no había errores).
- Pero `/availability/times` seguía devolviendo 0 slots.
- **PROBLEMA CRÍTICO:** No había logs que mostraran qué devolvía `/availability/dates`.

**Logs:**
```
[Acuity API] Requesting: /availability/dates
[Acuity API] Requesting: /availability/times
[Acuity Sync] Availability response for type 57323769 from 2025-12-25: { datesCount: 0, totalSlots: 0 }
```

**Lección aprendida:**
- Falta de logging detallado dificultaba el diagnóstico.
- Necesitábamos verificar si `/availability/dates` realmente devolvía fechas.

---

### Estrategia 4: Llamada a `/availability/times` por cada `calendarID` (empleado)

**Fecha:** Cuarto intento

**Enfoque:**
1. Consultar `acuity_calendars` para obtener todos los empleados asociados a un `appointmentTypeID`.
2. Para cada empleado (`calendarID`), llamar `/availability/times`.
3. Agregar los resultados por tienda.

**Implementación:**
```typescript
// Obtener calendarios asociados al tipo de cita
const { data: calendars } = await supabase
  .from('acuity_calendars')
  .select('acuity_calendar_id, name')
  .eq('appointment_type_id', params.appointmentTypeID)
  .eq('is_active', true)

// Para cada calendario, obtener disponibilidad
for (const calendar of calendars) {
  const availability = await this.getAvailability({
    date: date,
    appointmentTypeID: params.appointmentTypeID,
    calendarID: calendar.acuity_calendar_id, // Filtrar por empleado
  })
  
  // Agregar slots al total
  totalSlots += availability.dates?.[0]?.slots?.length || 0
}
```

**Resultado:** ❌
- Continuaba devolviendo 0 slots incluso pasando `calendarID`.
- Los logs mostraban llamadas a la API pero sin resultados.

**Logs:**
```
[Acuity API] Found 9 calendars for appointment type 57323769
[Acuity API] Requesting: /availability/times
[Acuity API] Processed 0 availability records for type 57323769
```

**Lección aprendida:**
- Pasar `calendarID` como parámetro tampoco funcionaba.
- Esto sugería que el problema podría estar en la configuración de Acuity o en cómo la API maneja los parámetros.

---

### Estrategia 5: `/availability/dates` sin `calendarID` + `/availability/times` con `calendarID`

**Fecha:** Quinto intento

**Enfoque:**
1. Llamar `/availability/dates` **sin `calendarID`** para obtener todas las fechas disponibles del tipo de cita.
2. Para cada fecha, llamar `/availability/times` **con `calendarID`** específico de cada empleado.
3. Agregar resultados por tienda.

**Razón:**
- La documentación sugiere que `/availability/dates` sin `calendarID` devuelve todas las fechas del tipo.
- Luego, `/availability/times` con `calendarID` debería devolver los slots de ese empleado específico.

**Implementación:**
```typescript
// Obtener fechas UNA VEZ por mes/tipo (SIN calendarID)
const availableDates = await this.getAvailableDates({
  month: monthStr,
  appointmentTypeID: params.appointmentTypeID,
  // NO pasar calendarID
})

// Para cada fecha, llamar con cada calendarID
for (const date of datesInMonth) {
  for (const calendar of calendars) {
    const availability = await this.getAvailability({
      date: date,
      appointmentTypeID: params.appointmentTypeID,
      calendarID: calendar.acuity_calendar_id,
    })
  }
}
```

**Resultado:** ❌
- `/availability/dates` se llamaba correctamente.
- Pero `/availability/times` con `calendarID` seguía devolviendo 0 slots.

**Logs:**
```
[Acuity API] Requesting: /availability/dates
[Acuity API] Requesting: /availability/times
[Acuity API] Requesting: /availability/times
[Acuity API] Processed 0 availability records for type 57323769
```

**Lección aprendida:**
- El problema persistía incluso con `calendarID` específico.
- Esto sugería un problema más fundamental con cómo la API responde a las peticiones.

---

### Estrategia 6: Optimización con Procesamiento en Paralelo

**Fecha:** Sexto intento

**Enfoque:**
1. Mantener la estrategia de `/availability/dates` sin `calendarID`.
2. Procesar calendarios en paralelo usando `Promise.all`.
3. Procesar fechas en lotes paralelos (batch size de 5).
4. Reducir rate limiting (200ms antes de `/availability/dates`, 100ms entre `/availability/times`).

**Razón:**
- Reducir tiempo de sincronización de ~20 minutos a ~3-5 minutos.
- Mantener la lógica de llamar por `calendarID`.

**Implementación:**
```typescript
// Procesar calendarios en paralelo
const calendarPromises = calendars.map(async (calendar) => {
  // Procesar fechas en lotes paralelos
  const BATCH_SIZE = 5
  const dateBatches = []
  for (let j = 0; j < datesInMonth.length; j += BATCH_SIZE) {
    dateBatches.push(datesInMonth.slice(j, j + BATCH_SIZE))
  }

  for (const dateBatch of dateBatches) {
    const batchPromises = dateBatch.map(async (date) => {
      await this.sleep(100)
      const availability = await this.getAvailability({
        date: date,
        appointmentTypeID: params.appointmentTypeID,
        calendarID: calendar.acuity_calendar_id,
      })
      return { date, slotsForDate: availability.dates?.[0]?.slots?.length || 0 }
    })
    const batchResults = await Promise.all(batchPromises)
    // Agregar resultados...
  }
})
await Promise.all(calendarPromises)
```

**Resultado:** ❌
- El tiempo se redujo significativamente.
- Pero seguía devolviendo 0 slots.

**Logs:**
- Logs más rápidos pero con los mismos resultados: `datesCount: 0, totalSlots: 0`.

**Lección aprendida:**
- La optimización funcionaba, pero el problema fundamental persistía.
- El problema no era de rendimiento, sino de obtención de datos.

---

### Estrategia 7: Llamar `/availability/times` SIN `calendarID` y Filtrar Después

**Fecha:** Séptimo intento (último)

**Enfoque:**
1. Llamar `/availability/times` **sin `calendarID`** para obtener **TODOS los slots** de todos los empleados de una vez.
2. Filtrar los slots por `calendarID` usando el campo que viene en cada slot de la respuesta.
3. Agregar por tienda.

**Razón:**
- La respuesta de `/availability/times` incluye `calendarID` en cada slot:
  ```typescript
  {
    dates: [{
      date: "2025-12-26",
      slots: [{
        time: "10:00",
        calendarID: 13199564,
        calendar: "Adrián Lasarte"
      }]
    }]
  }
  ```
- Al no pasar `calendarID`, la API debería devolver todos los slots.
- Podemos filtrar después por los `calendarID` válidos de la tienda.

**Implementación:**
```typescript
// Crear Set de calendarIDs válidos
const validCalendarIDs = new Set(
  calendars
    .map(c => c.acuity_calendar_id)
    .filter((id): id is number => id !== null && id !== undefined)
)

// Llamar SIN calendarID - obtener TODOS los slots
const availability = await this.getAvailability({
  date: date,
  appointmentTypeID: params.appointmentTypeID,
  // calendarID omitido
})

// Filtrar slots que pertenecen a calendarios de esta tienda
const slots = availability.dates[0]?.slots || []
const validSlots = slots.filter(slot => 
  validCalendarIDs.has(slot.calendarID)
)
```

**Resultado:** ❌
- Sigue devolviendo 0 slots.
- Los logs muestran llamadas a `/availability/dates` y `/availability/times`, pero sin resultados.

**Logs más recientes (25/12/2025 23:48):**
```
[Acuity API] Requesting: /availability/dates
[Acuity API] Requesting: /availability/times
[Acuity API] Requesting: /availability/times
[Acuity API] Processed 0 availability records for type 57323769
```

**Lección aprendida:**
- Incluso llamando sin `calendarID`, la API no devuelve slots.
- El problema podría estar en:
  - Configuración de Acuity (tipos de cita no públicos, sin disponibilidad configurada).
  - Parámetros faltantes o incorrectos.
  - Limitaciones de la API que no están documentadas.

---

## 💾 Cambios en Base de Datos

### Tabla: `acuity_availability_by_store`

**Propósito:** Almacenar disponibilidad agregada por tienda, fecha y categoría.

**Estructura:**
```sql
CREATE TABLE IF NOT EXISTS public.acuity_availability_by_store (
  id TEXT PRIMARY KEY, -- Composite: date-store_name-category
  date DATE NOT NULL,
  store_name TEXT NOT NULL, -- Nombre normalizado de tienda
  appointment_type_id BIGINT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  total_slots INTEGER NOT NULL DEFAULT 0, -- Total de slots disponibles
  booked_slots INTEGER NOT NULL DEFAULT 0, -- Slots reservados
  available_slots INTEGER NOT NULL DEFAULT 0, -- Slots libres (total - booked)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
- `idx_acuity_availability_by_store_date`
- `idx_acuity_availability_by_store_store_name`
- `idx_acuity_availability_by_store_category`
- `idx_acuity_availability_by_store_appointment_type_id`
- `idx_acuity_availability_by_store_date_store_category`

**Estado:** ✅ Creada correctamente. No tiene datos porque la API no devuelve slots.

---

### Tabla: `acuity_availability_history`

**Propósito:** Almacenar snapshots históricos de ocupación para comparativas.

**Estructura:**
```sql
CREATE TABLE IF NOT EXISTS public.acuity_availability_history (
  id TEXT PRIMARY KEY, -- Composite: snapshot_date-store_name-category-period_type
  snapshot_date DATE NOT NULL, -- Fecha del snapshot
  store_name TEXT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_slots INTEGER NOT NULL DEFAULT 0,
  booked_slots INTEGER NOT NULL DEFAULT 0,
  available_slots INTEGER NOT NULL DEFAULT 0,
  occupation_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
- `idx_acuity_availability_history_snapshot_date`
- `idx_acuity_availability_history_store_name`
- `idx_acuity_availability_history_category`
- `idx_acuity_availability_history_period_type`
- `idx_acuity_availability_history_period`

**Estado:** ✅ Creada correctamente. No tiene datos porque la API no devuelve slots.

---

### Migración SQL

**Archivo:** `supabase/migration_add_acuity_availability_by_store.sql`

**Contenido:**
- Creación de ambas tablas.
- Creación de índices.
- Configuración de RLS (Row Level Security).
- Políticas de acceso para usuarios autenticados.
- Triggers para actualizar `updated_at`.

**Estado:** ✅ Ejecutada correctamente en Supabase.

---

## 🔧 Cambios en Código

### Archivo: `src/lib/integrations/acuity.ts`

#### Método: `getAvailableDates()`

**Propósito:** Obtener fechas disponibles para un mes y tipo de cita específico.

**Implementación:**
```typescript
async getAvailableDates(params: {
  appointmentTypeID?: number
  calendarID?: number
  month?: string // YYYY-MM
  days?: number
}): Promise<Array<{ date: string }>> {
  const queryParams: Record<string, string | number> = {}
  
  if (params.appointmentTypeID) {
    queryParams.appointmentTypeID = params.appointmentTypeID
  }
  if (params.calendarID) {
    queryParams.calendarID = params.calendarID
  }
  if (params.month) {
    queryParams.month = params.month
  }
  if (params.days) {
    queryParams.days = params.days
  }

  return this.request<Array<{ date: string }>>('/availability/dates', queryParams)
}
```

**Estado:** ✅ Implementado. No sabemos qué devuelve porque no hay logs detallados.

---

#### Método: `getAvailability()`

**Propósito:** Obtener slots disponibles para una fecha y tipo de cita específicos.

**Implementación actual:**
```typescript
async getAvailability(params: {
  date: string // YYYY-MM-DD (obligatorio)
  appointmentTypeID: number // Obligatorio
  calendarID?: number // Opcional
}): Promise<AcuityAvailability> {
  const queryParams: Record<string, string | number> = {
    date: params.date,
    appointmentTypeID: params.appointmentTypeID,
  }
  
  if (params.calendarID) {
    queryParams.calendarID = params.calendarID
  }

  return this.request<AcuityAvailability>('/availability/times', queryParams)
}
```

**Interface de respuesta:**
```typescript
export interface AcuityAvailability {
  dates: Array<{
    date: string
    slots: Array<{
      time: string
      calendarID: number
      calendar: string
    }>
  }>
}
```

**Estado:** ✅ Implementado. Devuelve arrays vacíos siempre.

---

#### Método: `getAvailabilityByStore()` (método principal)

**Propósito:** Obtener disponibilidad agregada por tienda, procesando múltiples meses, fechas y empleados.

**Implementación actual (última versión):**
```typescript
async getAvailabilityByStore(params: {
  appointmentTypeID: number
  appointmentTypeName: string
  category: AcuityAppointmentCategory
  months: number
  supabase: SupabaseClient
}): Promise<AvailabilityByStoreResult[]> {
  // 1. Obtener calendarios (empleados) asociados al tipo de cita
  const { data: calendars } = await params.supabase
    .from('acuity_calendars')
    .select('acuity_calendar_id, name, appointment_type_name')
    .eq('appointment_type_id', params.appointmentTypeID)
    .eq('is_active', true)

  // 2. Para cada mes en el rango
  for (let i = 0; i < params.months; i++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    
    // 3. Obtener fechas disponibles (SIN calendarID)
    const availableDates = await this.getAvailableDates({
      month: monthStr,
      appointmentTypeID: params.appointmentTypeID,
    })

    if (!availableDates || availableDates.length === 0) {
      continue
    }

    // 4. Filtrar fechas dentro del mes
    const datesInMonth = availableDates
      .map(d => d.date)
      .filter(dateStr => {
        const dateObj = new Date(dateStr + 'T00:00:00')
        return dateObj >= firstDayOfMonth && dateObj <= lastDayOfMonth
      })

    // 5. Crear Set de calendarIDs válidos
    const validCalendarIDs = new Set(
      calendars
        .map(c => c.acuity_calendar_id)
        .filter((id): id is number => id !== null && id !== undefined)
    )

    // 6. Procesar fechas en lotes paralelos
    const BATCH_SIZE = 5
    for (const dateBatch of batches) {
      const batchPromises = dateBatch.map(async (date) => {
        // Llamar SIN calendarID
        const availability = await this.getAvailability({
          date: date,
          appointmentTypeID: params.appointmentTypeID,
        })

        // Filtrar slots por calendarID válidos
        const slots = availability.dates[0]?.slots || []
        const validSlots = slots.filter(slot => 
          validCalendarIDs.has(slot.calendarID)
        )

        return { date, slotsCount: validSlots.length }
      })

      // Agregar resultados...
    }
  }
}
```

**Estado:** ✅ Implementado. Devuelve 0 resultados siempre.

---

### Archivo: `src/app/api/sync/acuity/route.ts`

#### Sección: Sincronización de Disponibilidad por Tienda

**Ubicación:** Líneas 460-530 aproximadamente

**Implementación:**
```typescript
// Para cada tipo de cita
for (const [typeId, typeInfo] of appointmentTypeMap.entries()) {
  const availabilityResults = await acuityService.getAvailabilityByStore({
    appointmentTypeID: typeId,
    appointmentTypeName: typeInfo.type.name,
    category: typeInfo.category,
    months: monthsToSyncByStore,
    supabase: supabase,
  })

  // Normalizar nombre de tienda y agrupar
  for (const result of availabilityResults) {
    const normalizedStoreName = normalizeStoreName(result.appointmentTypeName)
    const key = `${result.date}-${normalizedStoreName}-${result.category}`

    if (!availabilityByStoreData.has(key)) {
      availabilityByStoreData.set(key, {
        date: result.date,
        storeName: normalizedStoreName,
        appointmentTypeID: result.appointmentTypeID,
        appointmentCategory: result.category,
        totalSlots: 0,
      })
    }

    const data = availabilityByStoreData.get(key)!
    data.totalSlots += result.totalSlots
  }
}
```

**Estado:** ✅ Implementado. No guarda datos porque `availabilityResults` está vacío.

---

#### Sección: Cálculo de Slots Reservados

**Implementación:**
```typescript
// Contar citas reservadas por fecha, tienda y categoría
const { data: appointmentsForStoreAvailability } = await supabase
  .from('acuity_appointments')
  .select('datetime, appointment_type_id, appointment_type_name, appointment_category, status')
  .gte('datetime', todayStr)
  .lte('datetime', endDateStrByStore)
  .neq('status', 'canceled')

// Agrupar por fecha-tienda-categoría
const bookedSlotsMapByStore = new Map<string, number>()
for (const appointment of appointmentsForStoreAvailability) {
  const normalizedStoreName = normalizeStoreName(appointment.appointment_type_name)
  const date = format(new Date(appointment.datetime), 'yyyy-MM-dd')
  const key = `${date}-${normalizedStoreName}-${appointment.appointment_category}`
  bookedSlotsMapByStore.set(key, (bookedSlotsMapByStore.get(key) || 0) + 1)
}
```

**Estado:** ✅ Funciona correctamente. Las citas reservadas se cuentan bien.

---

#### Sección: Guardado en Base de Datos

**Implementación:**
```typescript
// Guardar disponibilidad por tienda
for (const [key, data] of availabilityByStoreData.entries()) {
  const bookedSlots = bookedSlotsMapByStore.get(key) || 0
  const availableSlots = Math.max(0, data.totalSlots - bookedSlots)

  const recordId = `${data.date}-${data.storeName}-${data.appointmentCategory}`
  
  await supabase
    .from('acuity_availability_by_store')
    .upsert({
      id: recordId,
      date: data.date,
      store_name: data.storeName,
      appointment_type_id: data.appointmentTypeID,
      appointment_category: data.appointmentCategory,
      total_slots: data.totalSlots,
      booked_slots: bookedSlots,
      available_slots: availableSlots,
    })
}
```

**Estado:** ✅ Implementado. No guarda datos porque `totalSlots` siempre es 0.

---

### Archivo: `src/app/api/sync/acuity/availability/route.ts`

**Propósito:** Endpoint separado para sincronizar solo disponibilidad (sin citas).

**Estado:** ✅ Implementado. No funciona porque la API no devuelve datos.

---

### Archivo: `src/app/api/sync/acuity/availability/snapshot/route.ts`

**Propósito:** Crear snapshots históricos de ocupación (semanal/mensual/trimestral).

**Estado:** ✅ Implementado. No funciona porque no hay datos de disponibilidad.

---

### Archivo: `src/app/api/acuity/stats/route.ts`

**Cambios:**
- Agregado tipo `availability_history` para consultar snapshots históricos.
- Modificado para usar `acuity_availability_by_store` en lugar de `acuity_availability`.

**Estado:** ✅ Implementado. No muestra datos porque no hay datos disponibles.

---

## 📊 Logs y Errores

### Logs Analizados

**Archivos de log:**
1. `dev-20251225-191403.log` - Primer intento
2. `dev-20251225-192536.log` - Segundo intento
3. `dev-20251225-193309.log` - Tercer intento
4. `dev-20251225-195618.log` - Cuarto intento
5. `dev-20251225-201853.log` - Quinto intento
6. `dev-20251225-204049.log` - Sexto intento
7. `dev-20251225-210452.log` - Séptimo intento
8. `dev-20251225-230206.log` - Octavo intento
9. `dev-20251225-233328.log` - Noveno intento
10. `dev-20251225-234817.log` - Último intento

### Patrón Consistente en Todos los Logs

**Llamadas a la API:**
```
[Acuity API] Requesting: /availability/dates
[Acuity API] Requesting: /availability/times
[Acuity API] Requesting: /availability/times
[Acuity API] Requesting: /availability/times
...
```

**Respuestas:**
```
[Acuity Sync] Availability response for type 57323769 from 2025-12-25: { datesCount: 0, totalSlots: 0 }
[Acuity Sync] Availability response for type 57323769 from 2026-01-01: { datesCount: 0, totalSlots: 0 }
...
```

**Resultados finales:**
```
[Acuity API] Processed 0 availability records for type 57323769
[Acuity Sync] Processed 0 availability by store records for type 57323769
```

### Errores Específicos Encontrados

#### Error 1: Network Error (Transitorio)

**Log:** `dev-20251225-210452.log`

```
[Acuity API] Error fetching availability for calendar Adrián Lasarte (13199564): TypeError: fetch failed
[cause]: Error: read ECONNRESET
```

**Análisis:**
- Error de red transitorio.
- No es el problema principal.
- Se maneja correctamente con try/catch.

---

#### Error 2: Parámetros Incorrectos en `getAvailability`

**Log:** Varios logs anteriores

**Problema:**
- Se intentaba pasar `days` a `/availability/times`, que no lo acepta.

**Solución:**
- Removido el parámetro `days` de `getAvailability()`.

---

#### Error 3: `/availability/dates` Devuelve 0 Cuando se Pasa `calendarID`

**Log:** `dev-20251225-230206.log`

**Problema:**
- Cuando se pasaba `calendarID` a `/availability/dates`, devolvía 0 fechas.

**Solución:**
- Modificado para llamar `/availability/dates` sin `calendarID`.

---

### Información Faltante en los Logs

**Lo que NO sabemos:**
1. ❌ Qué devuelve exactamente `/availability/dates` (no hay logs de la respuesta).
2. ❌ La estructura completa de la respuesta de `/availability/times` (solo vemos `datesCount` y `totalSlots`).
3. ❌ Si hay mensajes de error de la API de Acuity (más allá de 0 resultados).
4. ❌ Los parámetros exactos que se están enviando en cada petición.

**Recomendación:**
- Agregar logs detallados que muestren:
  - Respuesta completa de `/availability/dates`.
  - Respuesta completa de `/availability/times`.
  - Parámetros exactos enviados en cada petición.

---

## 🔍 Análisis del Problema

### Hipótesis 1: Configuración en Acuity

**Posible causa:**
- Los tipos de cita no están configurados como "públicos" en Acuity.
- La disponibilidad no está activa o configurada para estos tipos de cita.
- Hay restricciones de programación que bloquean la disponibilidad.

**Evidencia:**
- La API no devuelve errores, solo arrays vacíos.
- Las citas reservadas SÍ se sincronizan correctamente.

**Acción sugerida:**
- Verificar en el panel de Acuity:
  - Configuración de tipos de cita (¿están marcados como públicos?).
  - Horarios de disponibilidad configurados.
  - Restricciones de programación.

---

### Hipótesis 2: Parámetros Faltantes o Incorrectos

**Posible causa:**
- La API requiere parámetros adicionales que no estamos enviando.
- El formato de los parámetros no es el esperado.
- Hay headers o autenticación adicional requerida.

**Evidencia:**
- La documentación oficial no menciona parámetros adicionales.
- Otras llamadas a la API (citas, calendarios) funcionan correctamente.

**Acción sugerida:**
- Probar manualmente con curl o Postman:
  ```bash
  curl -u "USER_ID:API_KEY" \
    "https://acuityscheduling.com/api/v1/availability/times?date=2025-12-26&appointmentTypeID=57323769"
  ```

---

### Hipótesis 3: Limitaciones de la API No Documentadas

**Posible causa:**
- La API solo devuelve disponibilidad para fechas muy cercanas (próximos días).
- La API requiere que el tipo de cita tenga citas reservadas para mostrar disponibilidad.
- Hay un límite de fechas que se pueden consultar.

**Evidencia:**
- Intentamos consultar hasta 12 meses en el futuro.
- La API no devuelve errores, solo 0 resultados.

**Acción sugerida:**
- Probar con fechas más cercanas (próximos 7 días).
- Verificar si hay límites en la documentación.

---

### Hipótesis 4: Problema con la Autenticación o Permisos

**Posible causa:**
- Las credenciales de API no tienen permisos para consultar disponibilidad.
- Hay diferentes niveles de acceso en la API.

**Evidencia:**
- Otras llamadas funcionan correctamente.
- No hay errores de autenticación.

**Acción sugerida:**
- Verificar permisos de las credenciales en Acuity.
- Contactar soporte de Acuity para confirmar permisos.

---

### Hipótesis 5: La API Requiere un Contexto de Reserva

**Posible causa:**
- La API solo muestra disponibilidad cuando se consulta desde un contexto de reserva (como un cliente).
- La API de programación (scheduling) es diferente de la API de administración.

**Evidencia:**
- No encontramos evidencia en la documentación.
- Esta es una hipótesis más especulativa.

**Acción sugerida:**
- Revisar si hay endpoints diferentes para "admin" vs "client".
- Contactar soporte de Acuity.

---

## 📍 Estado Actual

### Lo que Funciona ✅

1. **Sincronización de Citas Reservadas:**
   - Las citas se sincronizan correctamente desde Acuity.
   - Se guardan en `acuity_appointments`.
   - Se muestran correctamente en la interfaz.

2. **Cálculo de Slots Reservados:**
   - Se cuentan correctamente desde `acuity_appointments`.
   - Se agrupan por fecha, tienda y categoría.

3. **Base de Datos:**
   - Las tablas están creadas correctamente.
   - Los índices están configurados.
   - Las políticas RLS están activas.

4. **Estructura del Código:**
   - La lógica de agregación está implementada.
   - La normalización de nombres de tienda funciona.
   - El guardado en base de datos está listo.

### Lo que NO Funciona ❌

1. **Obtención de Slots Disponibles:**
   - La API no devuelve slots disponibles.
   - Todas las estrategias intentadas devuelven 0 resultados.

2. **Cálculo de Ocupación:**
   - No se puede calcular porque no hay `total_slots`.
   - Solo tenemos `booked_slots` (reservados).

3. **Datos en Base de Datos:**
   - `acuity_availability_by_store` está vacía.
   - `acuity_availability_history` está vacía.

### Código Actual (Estado)

**Archivo:** `src/lib/integrations/acuity.ts`
- Método `getAvailabilityByStore()`: Implementado con última estrategia (sin `calendarID`, filtrar después).
- Método `getAvailability()`: Implementado correctamente según documentación.
- Método `getAvailableDates()`: Implementado correctamente.

**Archivo:** `src/app/api/sync/acuity/route.ts`
- Lógica de sincronización: Implementada y lista.
- Guardado en base de datos: Implementado y listo.
- Falta: Datos para guardar.

---

## 🚀 Próximos Pasos Sugeridos

### Paso 1: Diagnóstico con Logs Detallados

**Acción:**
Agregar logs detallados para ver exactamente qué devuelve la API:

```typescript
// En getAvailableDates
const availableDates = await this.getAvailableDates({...})
console.log(`[DEBUG] /availability/dates response:`, JSON.stringify(availableDates, null, 2))

// En getAvailability
const availability = await this.getAvailability({...})
console.log(`[DEBUG] /availability/times response:`, JSON.stringify(availability, null, 2))
console.log(`[DEBUG] Request params:`, JSON.stringify(queryParams, null, 2))
```

**Objetivo:**
- Ver la respuesta exacta de la API.
- Identificar si hay mensajes de error o información adicional.

---

### Paso 2: Prueba Manual con cURL/Postman

**Acción:**
Probar manualmente la API de Acuity:

```bash
# Reemplazar USER_ID y API_KEY con las credenciales reales
curl -u "USER_ID:API_KEY" \
  "https://acuityscheduling.com/api/v1/availability/times?date=2025-12-26&appointmentTypeID=57323769"

curl -u "USER_ID:API_KEY" \
  "https://acuityscheduling.com/api/v1/availability/dates?month=2025-12&appointmentTypeID=57323769"
```

**Objetivo:**
- Verificar si la API devuelve datos manualmente.
- Comparar con lo que devuelve nuestro código.

---

### Paso 3: Verificar Configuración en Acuity

**Acción:**
1. Entrar al panel de Acuity Scheduling.
2. Verificar cada tipo de cita:
   - ¿Está marcado como "público"?
   - ¿Tiene horarios de disponibilidad configurados?
   - ¿Hay restricciones de programación activas?
3. Verificar calendarios:
   - ¿Los empleados tienen horarios de disponibilidad configurados?
   - ¿Están activos?

**Objetivo:**
- Identificar si hay problemas de configuración en Acuity.

---

### Paso 4: Probar con Fechas Más Cercanas

**Acción:**
Modificar temporalmente el código para consultar solo los próximos 7 días:

```typescript
months: 1, // En lugar de 12
```

**Objetivo:**
- Verificar si la API solo devuelve disponibilidad para fechas cercanas.

---

### Paso 5: Contactar Soporte de Acuity

**Acción:**
Enviar un ticket a soporte de Acuity con:
- Descripción del problema.
- Ejemplo de llamada a la API.
- Respuesta recibida.
- Pregunta: ¿Cómo obtener disponibilidad de slots futuros?

**Objetivo:**
- Obtener ayuda directa de Acuity sobre cómo usar la API correctamente.

---

### Paso 6: Revisar Documentación Oficial Actualizada

**Acción:**
1. Revisar documentación oficial de Acuity:
   - https://developers.acuityscheduling.com/reference/get-availability-times
   - https://developers.acuityscheduling.com/reference/get-availability-dates
2. Buscar ejemplos de código o casos de uso.
3. Verificar si hay cambios recientes en la API.

**Objetivo:**
- Asegurarse de que estamos usando la API correctamente según la documentación más reciente.

---

### Paso 7: Considerar Alternativas

**Acción:**
Si la API no funciona como esperamos, considerar:
1. **Webhooks:** Usar webhooks de Acuity para recibir actualizaciones de disponibilidad.
2. **Scraping:** Extraer disponibilidad desde la interfaz web (no recomendado, frágil).
3. **API Diferente:** Verificar si hay una API diferente para administradores.

**Objetivo:**
- Explorar alternativas si la solución actual no es viable.

---

## 📝 Notas Finales

### Resumen de Intentos

- **7 estrategias diferentes** implementadas.
- **10 archivos de log** analizados.
- **0 resultados** obtenidos de la API.
- **Tiempo invertido:** ~20 horas de desarrollo y debugging.

### Lecciones Aprendidas

1. La documentación de la API no siempre refleja el comportamiento real.
2. Los logs detallados son esenciales para debugging de APIs externas.
3. Probar manualmente con herramientas como cURL puede ahorrar mucho tiempo.
4. A veces el problema está en la configuración del servicio externo, no en nuestro código.

### Recomendación Final

**Antes de continuar:**
1. **Agregar logs detallados** para ver exactamente qué devuelve la API.
2. **Probar manualmente** con cURL/Postman para verificar si la API funciona.
3. **Contactar soporte de Acuity** para obtener ayuda directa.

**No intentar más estrategias** hasta tener esta información de diagnóstico.

---

## 🔗 Referencias

- **Documentación Oficial de Acuity:**
  - https://developers.acuityscheduling.com/reference/get-availability-times
  - https://developers.acuityscheduling.com/reference/get-availability-dates
  - https://developers.acuityscheduling.com/docs/authentication

- **Archivos de Código:**
  - `src/lib/integrations/acuity.ts`
  - `src/app/api/sync/acuity/route.ts`
  - `src/app/api/sync/acuity/availability/route.ts`
  - `src/app/api/sync/acuity/availability/snapshot/route.ts`
  - `supabase/migration_add_acuity_availability_by_store.sql`

- **Archivos de Log:**
  - `logs/dev-20251225-*.log` (10 archivos)

---

**Documento creado:** 25 de Diciembre 2025  
**Última actualización:** 25 de Diciembre 2025, 23:48  
**Estado:** ❌ Pendiente de resolución

