# 🔧 Solución: Límite de 1000 Registros en Comparativas Históricas

## 🔍 Problema Identificado

Supabase JS Client tiene un **límite máximo de 1000 registros** por query que no se puede superar con `.limit()`. Esto causaba que:
- Enero 2025: mostraba 1000 en lugar de ~2,500 citas reales
- Enero 2024: mostraba 1000 en lugar de ~2,300 citas reales

**Evidencia en logs:**
```
[Historical Compare API] Year 2025: 1000 appointments found
[Historical Compare API] Year 2024: 1000 appointments found
[Historical Compare API] Year 2023: 910 appointments found  ✓ (menos de 1000)
```

## ✅ Solución Implementada

Usar **agregaciones SQL directamente en PostgreSQL** mediante una función RPC (Remote Procedure Call), evitando traer registros individuales a JavaScript.

### Paso 1: Crear Función RPC en Supabase

**⚠️ ACCIÓN REQUERIDA**: Debes ejecutar este SQL en Supabase:

1. Ve a tu proyecto Supabase: https://supabase.com/dashboard/project/tu-proyecto
2. Click en **SQL Editor** (sidebar izquierdo)
3. Click en **New Query**
4. Copia y pega el contenido del archivo: `supabase/create_historical_stats_function.sql`
5. Click en **Run** (o Cmd/Ctrl + Enter)

**Contenido del script:**
```sql
-- Ver archivo: supabase/create_historical_stats_function.sql
-- Crea la función: get_historical_stats_by_year_month
```

### Paso 2: Verificar que la Función Funciona

Ejecuta este test en el SQL Editor de Supabase:

```sql
-- Test: Obtener estadísticas de Enero 2025
SELECT * FROM get_historical_stats_by_year_month(2025, 1, NULL);

-- Deberías ver un JSON con:
-- {
--   "period": "2025-01",
--   "total": 2500,  -- O el número real de citas
--   "medicion": 1750,
--   "fitting": 750,
--   ...
-- }
```

Si ves un número mayor a 1000 en "total", **¡funciona! ✅**

### Paso 3: Recargar la Aplicación

Una vez creada la función RPC:
1. **Recarga la página** de Citas > Comparativas
2. Los totales ahora deberían ser diferentes (no todos 1000)
3. Los logs mostrarán: `Year 2025: XXXX appointments found (via RPC)`

---

## 🔄 Alternativa: Modificar RLS Policies

Si la función RPC da errores de permisos, asegúrate de que las RLS policies permiten acceso:

```sql
-- Verificar que authenticated users pueden ejecutar la función
SELECT has_function_privilege('authenticated', 'get_historical_stats_by_year_month(integer, integer, text)', 'EXECUTE');
-- Debería retornar: true
```

Si retorna `false`, ejecuta:

```sql
GRANT EXECUTE ON FUNCTION get_historical_stats_by_year_month TO authenticated;
```

---

## 📊 Resultados Esperados

### Antes (Limitado a 1000)
```
2025: 1000 citas
2024: 1000 citas
2023: 910 citas
```

### Después (Datos Reales)
```
2025: ~2,500 citas
2024: ~2,300 citas
2023: ~910 citas
2022: ~168 citas
2021: ~58 citas
```

---

## 🐛 Troubleshooting

### Error: "function get_historical_stats_by_year_month does not exist"

**Causa**: La función no se ha creado en Supabase.
**Solución**: Ejecuta el script SQL en el paso 1.

### Error: "permission denied for function"

**Causa**: El usuario autenticado no tiene permisos EXECUTE.
**Solución**: Ejecuta:
```sql
GRANT EXECUTE ON FUNCTION get_historical_stats_by_year_month TO authenticated;
```

### Sigue mostrando 1000 registros

**Causa**: La función RPC tiene un error y está usando el fallback.
**Solución**: 
1. Revisa los logs del servidor: busca "RPC Error"
2. Verifica que la función se creó correctamente en Supabase SQL Editor
3. Ejecuta el test del Paso 2 para verificar manualmente

### Ver los logs en tiempo real

```bash
# En la terminal del proyecto:
tail -f logs/dev-*.log | grep "Historical Compare"
```

---

## ✅ Checklist

- [ ] He ejecutado el script SQL en Supabase SQL Editor
- [ ] La función se ejecuta correctamente (test del Paso 2)
- [ ] He recargado la página de Citas > Comparativas
- [ ] Los totales ahora son diferentes (no todos 1000)
- [ ] Los logs muestran "(via RPC)" en lugar de "appointments found"

---

## 📝 Archivos Modificados

1. **`supabase/create_historical_stats_function.sql`** ← Ejecutar en Supabase
2. **`src/app/api/citas/historical/compare/route.ts`** ← Ya actualizado
3. **Este documento** ← Instrucciones

---

## 🚀 Una vez completado

La aplicación mostrará **todos los datos históricos sin límite de 1000**, usando agregaciones eficientes de PostgreSQL en lugar de traer registros individuales.

**Performance mejorada:**
- ✅ Menos transferencia de datos (solo JSON agregado vs 1000+ registros)
- ✅ Más rápido (agregación en DB vs JavaScript)
- ✅ Sin límites (PostgreSQL puede agregar millones de filas)

