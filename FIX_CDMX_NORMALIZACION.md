# FIX: Problema de Normalización de CDMX

## 🐛 Problema Identificado

Las gráficas de "Evolución Mensual por Tienda" y "Comparación Anual por Tienda" mostraban **0 citas para CDMX** a pesar de que existen datos en el Excel histórico.

## 🔍 Análisis de la Causa

### En la Base de Datos:
El script de importación (`scripts/import-historical-appointments.ts`) normaliza todos los nombres de México como **`CDMX`** (TODO EN MAYÚSCULAS):

```typescript
// Líneas 80-83 del script de importación
'cdmx': 'CDMX',
'méxico': 'CDMX',
'mexico': 'CDMX',
'polanco': 'CDMX',
```

Por lo tanto, en la columna `store_city` de la tabla `historical_appointments`, los datos están guardados como:
- ✅ `CDMX` (mayúsculas)

### En el Código Frontend:
El archivo `general-view.tsx` buscaba por **`Cdmx`** (solo primera letra mayúscula):

```typescript
// ANTES (INCORRECTO):
{ name: 'Cdmx', color: '#6366F1' },
```

### Resultado:
Las consultas SQL buscaban `store_city = 'Cdmx'` pero los datos estaban como `store_city = 'CDMX'`, por lo que no encontraba coincidencias y devolvía 0.

## ✅ Solución Aplicada

Se corrigió el nombre en `general-view.tsx` para que coincida EXACTAMENTE con la base de datos:

```typescript
// DESPUÉS (CORRECTO):
{ name: 'CDMX', color: '#6366F1' }, // CDMX en mayúsculas según normalización en import script
```

## 📝 Verificación

Para verificar los nombres de tiendas en la BD, ejecuta:

```sql
SELECT DISTINCT store_city, COUNT(*) as total 
FROM historical_appointments 
GROUP BY store_city 
ORDER BY total DESC;
```

Deberías ver:
- Madrid
- Sevilla
- Málaga
- Barcelona
- Murcia
- Bilbao
- Valencia
- Zaragoza
- **CDMX** ← TODO MAYÚSCULAS

## ⚠️ Lección Aprendida

Cuando se trabaja con datos normalizados:

1. **Documentar la normalización**: El comentario en la migración SQL decía "CDMX" pero no estaba claro que era TODO mayúsculas
2. **Consistencia estricta**: Los nombres deben coincidir EXACTAMENTE (case-sensitive)
3. **Verificar con datos reales**: Siempre verificar en la BD cómo están guardados los datos

## 🎯 Impacto

Después de este fix:
- ✅ CDMX aparecerá correctamente en "Evolución Mensual por Tienda"
- ✅ CDMX aparecerá correctamente en "Comparación Anual por Tienda"
- ✅ Los datos de México/Polanco ahora se visualizarán correctamente

## 🔗 Archivos Afectados

- ✏️ `src/app/(dashboard)/citas/comparativas/general-view.tsx` - Corregido nombre de 'Cdmx' a 'CDMX'
- 📝 `INSTRUCCIONES_MIGRACION_COMPARATIVAS.md` - Documentado el detalle de normalización
- 📝 `FIX_CDMX_NORMALIZACION.md` - Este archivo (documentación del fix)

---

**Fecha del Fix:** 2025-01-09
**Reportado por:** Usuario (identificó que CDMX mostraba 0 pero había datos en el Excel)
**Estado:** ✅ Resuelto
