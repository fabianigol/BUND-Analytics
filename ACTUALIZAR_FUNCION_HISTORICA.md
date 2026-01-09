# Actualizar Función SQL para Canceladas por Tipo

## Problema Identificado
La función RPC de PostgreSQL `get_historical_stats_by_year_month` no está devolviendo las canceladas separadas por tipo de cita (medición/fitting). Por eso no aparecen las canceladas de 2025, 2024 y años previos en la tabla.

## Solución
Ejecutar la función SQL actualizada que ahora incluye:
- `cancelled_medicion`: Número de citas de medición canceladas
- `cancelled_fitting`: Número de citas de fitting canceladas
- `cancellation_rate_medicion`: Porcentaje de cancelación para mediciones
- `cancellation_rate_fitting`: Porcentaje de cancelación para fittings

## Pasos para Ejecutar

### 1. Ir a Supabase Dashboard
1. Abre https://supabase.com/dashboard
2. Selecciona tu proyecto **BUND-Analytics**
3. Ve a **SQL Editor** en el menú lateral

### 2. Ejecutar el Script SQL
1. Copia TODO el contenido del archivo `supabase/create_historical_stats_function.sql`
2. Pégalo en el SQL Editor
3. Haz clic en **Run** (o presiona Cmd+Enter)

### 3. Verificar
Deberías ver el mensaje:
```
Success. No rows returned
```

Esto significa que la función se ha actualizado correctamente.

### 4. Refrescar el Dashboard
Una vez ejecutado, recarga la página del dashboard en el navegador para que los cambios se reflejen.

## Qué hace esta actualización

La función ahora calcula correctamente:
- Las canceladas totales por tienda
- Las canceladas de medición por tienda
- Las canceladas de fitting por tienda
- Los porcentajes de cancelación separados por tipo

Esto permitirá que la tabla "Acuity vs Histórico" muestre correctamente:
- ✅ Canceladas de 2025 (datos históricos)
- ✅ Canceladas de 2024 y años previos (datos históricos)
- ✅ Porcentajes de cancelación correctos por tipo de cita

## Archivos Modificados
- ✅ `src/app/api/citas/historical/route.ts` - API actualizada para devolver canceladas por tipo
- ✅ `supabase/create_historical_stats_function.sql` - Función SQL actualizada
- ✅ `src/app/(dashboard)/citas/comparativas/acuity-vs-historical-view.tsx` - Frontend ya preparado para recibir estos datos

