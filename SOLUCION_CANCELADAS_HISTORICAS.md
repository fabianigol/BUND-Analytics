# Solución Completa: Canceladas Históricas no Aparecen

## 🔴 Problema
Las "Canceladas 2025" (datos históricos del Excel) aparecen como **0** en todas las tiendas, cuando deberían mostrar valores reales.

## 🔍 Causa Raíz - DOS PROBLEMAS

### Problema 1: Frontend no copiaba los campos ✅ RESUELTO
El código que construye los objetos `year1`, `year2`, `year3`, `year4` **no estaba copiando** los campos:
- `cancelled_medicion`
- `cancelled_fitting`
- `cancellation_rate_medicion`
- `cancellation_rate_fitting`

```typescript
// ANTES (INCORRECTO)
year1: year1Data ? {
  total: year1Data.total || 0,
  medicion: year1Data.medicion || 0,
  fitting: year1Data.fitting || 0,
  cancelled: year1Data.cancelled || 0,
  cancellation_rate: year1Data.cancellation_rate || 0,
  // ❌ Faltaban los campos por tipo
} : undefined
```

**Solución**: Agregados los campos faltantes a year1, year2, year3, year4.

### Problema 2: Función SQL no actualizada ⚠️ PENDIENTE

El archivo `supabase/create_historical_stats_function.sql` fue actualizado, pero **necesitas ejecutarlo en Supabase** para que la base de datos devuelva los nuevos campos.

## ✅ Solución Implementada

### 1. Frontend - ✅ CORREGIDO
Ahora los objetos year1, year2, year3, year4 incluyen todos los campos:

```typescript
year1: year1Data ? {
  total: year1Data.total || 0,
  medicion: year1Data.medicion || 0,
  fitting: year1Data.fitting || 0,
  cancelled: year1Data.cancelled || 0,
  cancellation_rate: year1Data.cancellation_rate || 0,
  avg_per_day: 0,
  cancelled_medicion: year1Data.cancelled_medicion || 0,        // ✅ NUEVO
  cancelled_fitting: year1Data.cancelled_fitting || 0,          // ✅ NUEVO
  cancellation_rate_medicion: year1Data.cancellation_rate_medicion || 0,  // ✅ NUEVO
  cancellation_rate_fitting: year1Data.cancellation_rate_fitting || 0,    // ✅ NUEVO
} : undefined
```

### 2. Base de Datos - ⚠️ REQUIERE ACCIÓN

**DEBES EJECUTAR** el script SQL actualizado en Supabase:

#### Pasos:
1. Ve a Supabase Dashboard → SQL Editor
2. Copia **TODO** el contenido de: `supabase/create_historical_stats_function.sql`
3. Pégalo en el SQL Editor
4. Haz clic en **Run** (o Cmd+Enter)

Deberías ver: `Success. No rows returned`

#### Qué hace el script:
Actualiza la función `get_historical_stats_by_year_month` para que calcule y devuelva:

```sql
COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = true) as cancelled_medicion,
COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = true) as cancelled_fitting,
-- Y los porcentajes correspondientes
```

## 📊 Flujo de Datos

```
Excel → Supabase (historical_appointments table)
  ↓
PostgreSQL Function (get_historical_stats_by_year_month) ← NECESITA ACTUALIZARSE
  ↓
API (/api/citas/historical) ✅ Ya actualizada
  ↓
Frontend (acuity-vs-historical-view.tsx) ✅ Ya actualizado
  ↓
Tabla muestra: Canceladas 2025, 2024, etc.
```

## 🎯 Resultado Esperado

**ANTES de ejecutar el SQL:**
- Canceladas 2025: `0` ❌
- % Cancel. 2025: `0.0%` ❌

**DESPUÉS de ejecutar el SQL:**
- Canceladas 2025: Valores reales (ej: 0, 4, 9, 11, etc.) ✅
- % Cancel. 2025: Porcentajes reales ✅

## ⚡ Acción Inmediata Requerida

1. **Ejecuta el script SQL** en Supabase (ver pasos arriba)
2. **Recarga el navegador** (Cmd+R o Ctrl+R)
3. **Filtra del 1 al 8 de enero** en la vista de comparativas
4. **Verifica** que ahora aparezcan las canceladas históricas

## 📝 Archivos Modificados

- ✅ `src/app/api/citas/historical/route.ts` - API calcula canceladas por tipo
- ✅ `src/app/(dashboard)/citas/comparativas/acuity-vs-historical-view.tsx` - Frontend copia todos los campos
- ⚠️ `supabase/create_historical_stats_function.sql` - **PENDIENTE DE EJECUTAR**

## 🔍 Cómo Verificar si el SQL fue Ejecutado

Después de ejecutar el script SQL, prueba haciendo una petición a:
```
/api/citas/historical?startDate=2025-01-01&endDate=2025-01-08
```

Deberías ver en la respuesta JSON:
```json
{
  "metrics": {
    "by_store": [
      {
        "store_city": "Madrid",
        "cancelled_medicion": 36,  // ← Debe aparecer
        "cancelled_fitting": 2,     // ← Debe aparecer
        ...
      }
    ]
  }
}
```

Si estos campos no aparecen, significa que el script SQL aún no se ejecutó.

