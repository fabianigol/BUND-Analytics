# Solución: Citas vs Canceladas - Corrección Crítica

## 🔴 Problema Identificado

Las columnas "Citas 2026", "Citas 2025", "Citas 2024", etc. estaban **incluyendo las canceladas** en el conteo, lo cual era incorrecto.

### Ejemplo Real - Madrid (Medición):
```
ANTES (INCORRECTO):
- Citas 2025: 73 ❌
  - Incluía: 59 confirmadas + 14 canceladas
- Canceladas 2025: 14 ✅

El problema: La columna "Citas" mostraba 73, pero ese número incluía las 14 canceladas
```

## 🎯 Lógica Correcta

```
Total = Todas las citas en la BD (confirmadas + canceladas)
Citas = Solo citas confirmadas/programadas (NO canceladas)
Canceladas = Solo citas canceladas

Fórmula: Total = Citas + Canceladas
```

### Ejemplo Madrid Corregido:
```
AHORA (CORRECTO):
- Citas 2025: 59 ✅ (solo confirmadas)
- Canceladas 2025: 14 ✅
- Total 2025: 73 (59 + 14)
```

## ✅ Cambios Implementados

### 1. Frontend (acuity-vs-historical-view.tsx)

**ANTES:**
```typescript
const currentMedicion = apts.filter(a => a.appointment_category === 'medición').length;
// ❌ Incluía canceladas
```

**AHORA:**
```typescript
const currentMedicion = apts.filter(a => 
  a.appointment_category === 'medición' && 
  a.status !== 'canceled'  // ✅ Excluye canceladas
).length;
```

### 2. API Backend (historical/route.ts)

**ANTES:**
```typescript
const medicion = appointments.filter(a => a.appointment_type === 'medicion').length;
// ❌ Incluía canceladas
```

**AHORA:**
```typescript
const medicion = appointments.filter(a => 
  a.appointment_type === 'medicion' && 
  !a.is_cancelled  // ✅ Excluye canceladas
).length;
```

### 3. Función SQL (create_historical_stats_function.sql)

**ANTES:**
```sql
COUNT(*) FILTER (WHERE appointment_type = 'medicion') as medicion
-- ❌ Incluía canceladas
```

**AHORA:**
```sql
COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = false) as medicion
-- ✅ Excluye canceladas
```

## 📊 Impacto en Todas las Vistas

Este cambio afecta consistentemente a:

### ✅ Acuity (2026) - Datos Actuales
- **Citas 2026** = Solo confirmadas (sin canceladas)
- **Canceladas Actual** = Solo canceladas

### ✅ Histórico (2025, 2024, 2023, 2022) - Datos del Excel
- **Citas 2025** = Solo confirmadas (sin canceladas)
- **Canceladas 2025** = Solo canceladas
- Y lo mismo para 2024, 2023, 2022...

### ✅ Porcentajes de Cancelación
Se calculan ahora correctamente:
```
% Cancelación = (Canceladas / (Citas + Canceladas)) * 100
```

## 🎯 Resultado Esperado

Después de ejecutar el script SQL actualizado en Supabase, verás:

### Madrid (Medición) - Período 1-8 enero:
```
Citas 2026: 39 (antes: 48) ← 48 - 9 canceladas = 39
Citas 2025: 59 (antes: 73) ← 73 - 14 canceladas = 59
Canceladas Actual: 9 ✅
Canceladas 2025: 14 ✅
% Cancel. Actual: 18.8% ✅
% Cancel. 2025: 19.2% ✅
```

### Sevilla (Medición):
```
Citas 2026: 19 (antes: 23) ← 23 - 4 canceladas = 19
Citas 2025: 32 (antes: 39) ← 39 - 7 canceladas = 32
Canceladas Actual: 4 ✅
Canceladas 2025: 7 ✅
% Cancel. Actual: 17.4% ✅
% Cancel. 2025: 17.9% ✅
```

### Málaga (Medición):
```
Citas 2026: 12 (sin cambio, no hay canceladas) ✅
Citas 2025: 17 (antes: 20) ← 20 - 3 canceladas = 17
Canceladas Actual: 0 ✅
Canceladas 2025: 3 ✅
% Cancel. Actual: 0.0% ✅
% Cancel. 2025: 15.0% ✅
```

## ⚠️ ACCIÓN REQUERIDA

**DEBES EJECUTAR el script SQL actualizado:**

1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Copia **TODO** el contenido de: `supabase/create_historical_stats_function.sql`
3. Pégalo y ejecuta (Run o Cmd+Enter)
4. Verifica: `Success. No rows returned`
5. **Recarga el navegador** (Cmd+R)

## 📝 Archivos Modificados

- ✅ `src/app/(dashboard)/citas/comparativas/acuity-vs-historical-view.tsx`
- ✅ `src/app/api/citas/historical/route.ts`
- ✅ `supabase/create_historical_stats_function.sql` ← **Ejecutar en Supabase**

## 🔍 Verificación

Para confirmar que todo funciona:

1. **Filtra del 1 al 8 de enero 2026**
2. **Madrid (Medición)**:
   - Citas 2026 debe ser menor que antes (porque ahora excluye canceladas)
   - Citas 2026 + Canceladas Actual = Total que veías antes
3. **Los porcentajes de cancelación deben mantenerse igual** (el denominador ahora incluye todo el total)

## 💡 Interpretación

**ANTES**: "Citas" era confuso porque incluía canceladas
**AHORA**: "Citas" es claro - son solo las citas confirmadas/programadas que realmente sucedieron o sucederán

Esta es la forma correcta de analizar el negocio:
- **Citas confirmadas** = Capacidad productiva real
- **Canceladas** = Pérdida/desperdicio de capacidad
- **Total** = Demanda total (confirmadas + canceladas)

