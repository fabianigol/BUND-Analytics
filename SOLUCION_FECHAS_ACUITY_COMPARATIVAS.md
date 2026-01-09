# Solución: Fechas Incorrectas en Vista de Comparativas

## 🔴 Problema Identificado

La vista "Acuity vs Histórico" mostraba números **muy superiores** a los reales:

### Datos Reales (Acuity + Vista Principal de Citas)
Período: 1-8 enero 2026
- **Madrid**: 57 citas (46 medición + 11 fitting)
- **Sevilla**: 26 citas (23 medición + 3 fitting)

### Datos Incorrectos (Vista de Comparativas)
Período: 1-8 enero 2026
- **Madrid**: 154 citas ❌ (casi 3x más)
- **Sevilla**: 62 citas ❌ (más del doble)

## 🔍 Causa Raíz

El API `/api/acuity/appointments/route.ts` tenía una lógica que **modificaba automáticamente las fechas**:

```typescript
// CÓDIGO ANTERIOR (INCORRECTO)
if (startDate) {
  const pastDate = new Date(todayStart)
  pastDate.setFullYear(pastDate.getFullYear() - 1) // Retrocede 1 año
  startDateStr = pastDate.toISOString()
}
```

**Cuando pedías del 1 al 8 de enero de 2026:**
- El API buscaba desde: `2025-01-01` (1 año atrás)
- Hasta: `2026-01-08`
- **Resultado**: 13 meses de datos en lugar de 8 días

Esta lógica probablemente se agregó para algún otro propósito (vista principal de citas con datos históricos), pero estaba rompiendo las comparativas.

## ✅ Solución Implementada

Modificado el API para detectar cuándo se proporcionan **ambas fechas** y usarlas exactamente como están:

```typescript
// CÓDIGO NUEVO (CORRECTO)
if (startDate && endDate) {
  // Modo exacto: usar las fechas proporcionadas sin modificar
  startDateStr = parseISO(startDate).toISOString()
  endDateStr = parseISO(endDate).toISOString()
} else {
  // Modo amplio: rango de 1 año (para otras vistas que lo necesiten)
  // ... lógica anterior preservada
}
```

### Comportamiento Actualizado

1. **Si se proporcionan startDate Y endDate** (caso de comparativas):
   - ✅ Usa las fechas **exactas** sin modificar
   - ✅ Del 1 al 8 de enero = del 1 al 8 de enero

2. **Si solo se proporciona startDate** (otros casos):
   - Busca desde 1 año atrás hasta 1 año adelante
   - Mantiene compatibilidad con otras vistas

3. **Si no se proporciona ninguna fecha**:
   - Busca los últimos 12 meses
   - Comportamiento por defecto

## 🎯 Resultado Esperado

Ahora la vista de comparativas mostrará:
- ✅ **Madrid**: 57 citas (46 medición + 11 fitting)
- ✅ **Sevilla**: 26 citas (23 medición + 3 fitting)
- ✅ Todos los datos coincidirán con Acuity y la vista principal

## 📋 Archivos Modificados

- ✅ `src/app/api/acuity/appointments/route.ts` - Lógica de fechas corregida

## ⚠️ Nota Importante

Esta corrección **no afecta** a otras vistas del dashboard que puedan estar usando el API con un solo parámetro de fecha o sin fechas. Solo afecta cuando se proporcionan ambos `startDate` y `endDate`, que es el caso de la vista de comparativas.

