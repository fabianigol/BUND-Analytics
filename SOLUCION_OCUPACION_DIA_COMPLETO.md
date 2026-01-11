# Solución: Tracking de Ocupación del Día Completo

## 📋 Problema Identificado

El dashboard mostraba datos incorrectos de ocupación porque:

### **Problema Principal:**
- La API de Acuity solo devuelve slots **disponibles en el futuro**
- Pero contábamos las citas reservadas del **día completo** (pasadas + futuras)

### **Ejemplo del Problema:**
Son las 18:00h:
- **Slots del día:** 10 (de 9am a 8pm)
- **Slots ya pasados:** 8 (de 9am a 5pm) → 8 reservados
- **Slots futuros:** 2 (de 6pm a 8pm) → 2 disponibles

**Cálculo erróneo:**
- `total_slots` = 2 (solo slots futuros de Acuity)
- `booked_slots` = 8 (todas las citas del día)
- **Resultado:** 8/2 = 400% ❌

---

## ✅ Solución Implementada

### **Nueva Arquitectura:**

1. **Snapshot Diario al Inicio del Día**
   - El cron se ejecuta a las **7:00 AM** (antes de que empiecen las citas)
   - Captura el **total de slots del día completo**
   - Guarda en nueva tabla: `acuity_daily_snapshot`

2. **Dashboard Lee del Snapshot**
   - El dashboard ahora lee de `acuity_daily_snapshot`
   - Muestra datos del **día completo**, no solo slots futuros
   - Si no hay snapshot (ej: primer día), usa `acuity_availability_by_store` como fallback

---

## 🗄️ Solución: Usar Tabla Existente con `period_type='daily'`

### **En lugar de crear una tabla nueva**, usamos la tabla existente `acuity_availability_history`:

```sql
-- Simplemente agregamos 'daily' al constraint
ALTER TABLE public.acuity_availability_history 
ADD CONSTRAINT acuity_availability_history_period_type_check 
CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly'));
```

### **Campos Relevantes:**

- `period_type`: Ahora acepta **'daily'** (además de weekly, monthly, quarterly)
- `snapshot_date`: Fecha del snapshot (ej: 2026-01-10)
- `period_start` y `period_end`: Ambos con la misma fecha para snapshots diarios
- `total_slots`: Total de slots del **día completo** (capturado a las 7am)
- `booked_slots`: Citas reservadas
- `available_slots`: Slots libres
- `occupation_percentage`: Porcentaje precalculado

---

## 🔄 Flujo del Sistema

### **1. Cron Job Diario (7:00 AM UTC / 8:00 AM CET)**

**Archivo:** `/api/cron/sync-acuity-daily`

El cron ejecuta 4 pasos en orden:

1. **Sincronizar Citas** → `/api/sync/acuity`
   - Obtiene todas las citas desde Acuity
   - Actualiza `acuity_appointments`

2. **Sincronizar Disponibilidad** → `/api/sync/acuity/availability`
   - Obtiene slots disponibles en tiempo real (próximos 21 días)
   - Actualiza `acuity_availability` y `acuity_availability_by_store`

3. **📸 Snapshot Diario** → `/api/sync/acuity/daily-snapshot` ⭐ **NUEVO**
   - Captura el **total de slots del DÍA ACTUAL**
   - Guarda en `acuity_availability_history` con `period_type='daily'`
   - Este es el que usa el dashboard

4. **Snapshot Histórico** → `/api/sync/acuity/availability/snapshot`
   - Crea snapshot del día ANTERIOR
   - Guarda en `acuity_availability_history` (para comparativas)

### **2. Dashboard (Todo el día)**

**Archivo:** `/api/dashboard` → función `getStoreOccupationToday()`

```typescript
// 1. Intenta leer desde acuity_availability_history con period_type='daily'
const { data: dailySnapshot } = await supabase
  .from('acuity_availability_history')
  .select('...')
  .eq('snapshot_date', todayStr)
  .eq('period_type', 'daily')

// 2. Fallback a acuity_availability_by_store si no hay snapshot
if (!dailySnapshot || dailySnapshot.length === 0) {
  // Usar availability_by_store
}

// 3. Calcular porcentaje
percentage = (booked_slots / total_slots) * 100
```

---

## 🚀 Instalación y Configuración

### **Paso 1: Ejecutar Migración de Base de Datos**

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor**
4. Abre el archivo: `supabase/migration_add_daily_snapshot.sql`
5. Copia y pega el contenido
6. Ejecuta (Run)

### **Paso 2: Configurar Variable de Entorno (si no está configurada)**

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Verifica que existe: `CRON_SECRET`
   - Si no existe, créala con un valor aleatorio seguro
   - Ejemplo: `openssl rand -hex 32`

### **Paso 3: Desplegar Cambios**

```bash
git add .
git commit -m "Fix: Implement full-day occupation tracking with daily snapshot"
git push
```

Vercel desplegará automáticamente.

---

## 🧪 Testing

### **Test 1: Verificar que la migración funcionó**

```sql
-- En Supabase SQL Editor
-- Verificar que 'daily' está permitido en el constraint
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.acuity_availability_history'::regclass
  AND conname = 'acuity_availability_history_period_type_check';
```

Debería mostrar que 'daily' está incluido en el constraint.

### **Test 2: Ejecutar Snapshot Manualmente (Primera Vez)**

```bash
# Reemplaza YOUR_SECRET con el valor de CRON_SECRET
curl -X POST "https://tu-dominio.vercel.app/api/sync/acuity/daily-snapshot" \
  -H "Content-Type: application/json" \
  -H "authorization: Bearer YOUR_SECRET"
```

O desde el navegador (agregar `?secret=YOUR_SECRET` como query param).

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Daily snapshot captured for 2026-01-10",
  "date": "2026-01-10",
  "snapshot_time": "2026-01-10T06:00:00.000Z",
  "records_saved": 18,
  "note": "This snapshot captures the FULL day capacity at the start of the day"
}
```

### **Test 3: Verificar Datos en la Base de Datos**

```sql
-- Ver snapshot de hoy
SELECT 
  snapshot_date,
  store_name,
  appointment_category,
  total_slots,
  booked_slots,
  available_slots,
  occupation_percentage,
  created_at
FROM acuity_availability_history
WHERE snapshot_date = CURRENT_DATE
  AND period_type = 'daily'
ORDER BY store_name, appointment_category;
```

**Resultado esperado:** Ver todas las tiendas con sus datos de ocupación.

### **Test 4: Verificar Dashboard**

1. Abre el dashboard: `https://tu-dominio.vercel.app/`
2. Verifica la sección "Ocupación por Tienda (Hoy)"
3. Los números deberían ser:
   - **Lógicos:** No más del 100% de ocupación
   - **Consistentes:** `booked / total ≤ 1`
4. Verifica en los logs del navegador (Console):
   ```
   [Dashboard] Raw occupation data: {
     source: 'daily_snapshot',  // ← Debería ser 'daily_snapshot'
     ...
   }
   ```

### **Test 5: Ejecutar Cron Completo**

```bash
# Ejecutar el cron job completo manualmente
curl -X GET "https://tu-dominio.vercel.app/api/cron/sync-acuity-daily?secret=YOUR_SECRET"
```

**Respuesta esperada:**
```json
{
  "success": true,
  "duration_ms": 15000,
  "results": {
    "appointments": { "success": true },
    "availability": { "success": true },
    "dailySnapshot": { "success": true },
    "historicalSnapshot": { "success": true }
  }
}
```

---

## 📊 Visualización en el Dashboard

### **Antes (Incorrecto):**
```
Barcelona - Fitting
2 reserv.    1 total    200% ❌
```

### **Después (Correcto):**
```
Barcelona - Fitting
2 reserv.    6 total    33% ✅
```

---

## ⏰ Horarios del Cron Job

### **Configuración Actual:**
- **Horario:** `0 6 * * *` (6:00 AM UTC)
- **Equivale a:**
  - **CET (invierno):** 7:00 AM ✅
  - **CEST (verano):** 8:00 AM

### **¿Por qué a las 7-8 AM?**
- Las tiendas abren normalmente a las 9-10 AM
- El snapshot captura todos los slots ANTES de que empiecen las citas
- Si se ejecuta más tarde, algunos slots ya habrían pasado

### **¿Se puede cambiar?**
Sí, editando `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-acuity-daily",
      "schedule": "0 5 * * *"  // 5 AM UTC = 6 AM CET
    }
  ]
}
```

---

## 🔍 Monitoreo

### **Ver Logs del Cron en Vercel:**
1. Ve a [Vercel Dashboard](https://vercel.com/dashboard)
2. Ve a **Deployments** → Último deployment
3. Ve a **Functions** → `/api/cron/sync-acuity-daily`
4. Revisa los logs después de las 7-8 AM

### **Ver Logs en la Aplicación:**
```bash
# En tu terminal local con el proyecto corriendo
tail -f logs/dev-*.log | grep "Daily Snapshot\|Dashboard"
```

### **Query para Debugging:**
```sql
-- Ver histórico de snapshots diarios
SELECT 
  snapshot_date,
  COUNT(*) as records,
  SUM(total_slots) as total_slots,
  SUM(booked_slots) as total_booked,
  AVG(occupation_percentage) as avg_occupation,
  MIN(created_at) as captured_at
FROM acuity_availability_history
WHERE period_type = 'daily'
GROUP BY snapshot_date
ORDER BY snapshot_date DESC
LIMIT 7;
```

---

## ⚠️ Notas Importantes

### **1. Primera Ejecución**
- El dashboard usará `acuity_availability_by_store` como fallback hasta que se ejecute el primer snapshot
- Ejecuta manualmente el snapshot para poblar los datos iniciales (ver Test 2)

### **2. Actualización Durante el Día**
- `total_slots_day` NO cambia durante el día (se captura a las 7 AM)
- `booked_slots` se puede actualizar ejecutando el cron manualmente si quieres
- O esperar al próximo día para datos actualizados

### **3. Zona Horaria**
- Todos los timestamps están en UTC
- La tabla usa DATE (sin hora) para la fecha del día
- El dashboard siempre muestra el día actual del servidor

### **4. Fallback a Datos en Tiempo Real**
- Si no hay snapshot del día actual, el dashboard automáticamente usa `acuity_availability_by_store`
- Esto significa que funcionará incluso si el cron falla
- Pero los datos serán menos precisos (solo slots futuros)

---

## 🎯 Resumen de Archivos Modificados

### **Nuevos Archivos:**
1. ✅ `supabase/migration_add_daily_snapshot.sql` - Migración de BD
2. ✅ `src/app/api/sync/acuity/daily-snapshot/route.ts` - Endpoint de snapshot
3. ✅ `SOLUCION_OCUPACION_DIA_COMPLETO.md` - Este documento

### **Archivos Modificados:**
1. ✅ `src/app/api/cron/sync-acuity-daily/route.ts` - Cron job actualizado
2. ✅ `src/app/api/dashboard/route.ts` - Dashboard actualizado
3. ✅ `src/types/database.ts` - Types actualizados

### **Archivos No Modificados (pero relevantes):**
- `vercel.json` - Configuración del cron (ya estaba correcta)
- `src/lib/utils/cron-auth.ts` - Autenticación del cron (ya estaba correcta)
- `CRON_SETUP.md` - Documentación del cron (actualizar si es necesario)

---

## ❓ Preguntas Frecuentes

### **P: ¿Qué pasa si el cron falla?**
**R:** El dashboard automáticamente usa `acuity_availability_by_store` como fallback. Los datos seguirán funcionando pero serán menos precisos.

### **P: ¿Puedo ejecutar el snapshot manualmente?**
**R:** Sí, usa el endpoint `/api/sync/acuity/daily-snapshot` con el secret (ver Test 2).

### **P: ¿Los datos históricos se migran automáticamente?**
**R:** No, la nueva tabla empieza vacía. Los snapshots históricos siguen en `acuity_availability_history`.

### **P: ¿Cuánto espacio ocupa?**
**R:** Aproximadamente 18 registros diarios adicionales por día × 365 días = 6,570 registros/año. Se agregan a los registros weekly/monthly/quarterly existentes.

### **P: ¿Puedo borrar los snapshots diarios antiguos?**
**R:** Sí, si no los necesitas para históricos. Solo borra los que tienen `period_type='daily'` y mantén los weekly/monthly/quarterly.

---

## 🚀 Próximos Pasos

1. ✅ Ejecutar migración en Supabase
2. ✅ Desplegar cambios a producción
3. ✅ Ejecutar snapshot manual (primera vez)
4. ✅ Verificar dashboard
5. ⏳ Monitorear cron job automático mañana a las 7-8 AM
6. ⏳ Confirmar que los datos son correctos durante todo el día

---

**Fecha de Implementación:** 2026-01-10  
**Autor:** Juan Fabiani de la Iglesia  
**Estado:** ✅ Implementado - Pendiente Testing en Producción
