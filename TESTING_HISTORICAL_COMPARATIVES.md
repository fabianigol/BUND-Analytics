# Testing de Comparativas Históricas

## ✅ Checklist de Implementación Completada

### Backend

- [x] **Migración de Supabase**: Tabla `historical_appointments` creada con índices
- [x] **Script de Importación**: 57,908 registros importados desde Excel (99.8% éxito)
- [x] **API Principal**: `/api/citas/historical` con filtros y agregaciones
- [x] **API Comparativas**: `/api/citas/historical/compare` multi-año
- [x] **Tipos TypeScript**: Interfaces completas en `src/types/historical.ts`

### Frontend

- [x] **ComparisonKPICard**: Componente estilo Paid Media con flechas de tendencia
- [x] **StoreSelector**: Selector de tiendas reutilizable
- [x] **Vista General**: Comparativas globales con multi-año
- [x] **Vista Por Tienda**: Análisis individual por tienda
- [x] **Vista Patrones**: Heatmaps y análisis de días/horas
- [x] **Vista Acuity vs Histórico**: Comparación período actual vs histórico
- [x] **Integración Principal**: Sub-tabs integrados en página de Citas

## 🧪 Tests a Realizar

### 1. Testing de Datos Importados

```bash
# Verificar registros en Supabase
SELECT COUNT(*) FROM historical_appointments; -- Debe ser ~57,908

# Verificar distribución por tienda
SELECT store_city, COUNT(*) as total
FROM historical_appointments
GROUP BY store_city
ORDER BY total DESC;

# Verificar años disponibles
SELECT year, COUNT(*) as total
FROM historical_appointments
GROUP BY year
ORDER BY year DESC;

# Verificar que year, month, day_of_week, hour están calculados
SELECT year, month, day_of_week, hour, COUNT(*)
FROM historical_appointments
WHERE year IS NULL OR month IS NULL OR day_of_week IS NULL OR hour IS NULL
GROUP BY year, month, day_of_week, hour;
-- Debe retornar 0 filas
```

### 2. Testing de APIs

#### API Principal

```bash
# Test 1: Obtener todas las citas de enero 2024
curl "http://localhost:3002/api/citas/historical?year=2024&month=1"

# Test 2: Filtrar por tienda
curl "http://localhost:3002/api/citas/historical?year=2024&month=1&city=Madrid"

# Test 3: Agregación por día de semana
curl "http://localhost:3002/api/citas/historical?year=2024&month=1&aggregateBy=dayOfWeek"

# Test 4: Agregación por hora
curl "http://localhost:3002/api/citas/historical?year=2024&month=1&aggregateBy=hour"

# Test 5: Rango de fechas
curl "http://localhost:3002/api/citas/historical?startDate=2024-01-01&endDate=2024-01-31"
```

#### API Comparativas

```bash
# Test 1: Comparar 3 años
curl "http://localhost:3002/api/citas/historical/compare?years=2025,2024,2023&month=1"

# Test 2: Comparar para una tienda específica
curl "http://localhost:3002/api/citas/historical/compare?years=2024,2023&month=1&storeCity=Madrid"

# Test 3: Verificar estructura de respuesta
# Debe incluir: month, years[], comparison.years con métricas completas
```

### 3. Testing de UI

#### Vista General

- [ ] Navegar a Citas > Comparativas > General
- [ ] Verificar que se cargan datos del mes actual
- [ ] Cambiar mes con botones ← →
- [ ] Seleccionar diferentes años para comparar (2025, 2024, 2023, 2022, 2021)
- [ ] Verificar KPI Cards:
  - Total Citas
  - Medición
  - Fitting
  - Tasa Cancelación (debe tener flecha hacia abajo si mejora)
  - Canceladas
  - Promedio/Día
- [ ] Verificar gráfica de líneas multi-año
- [ ] Verificar tabla comparativa con todos los años
- [ ] Responsive: Probar en mobile, tablet, desktop

#### Vista Por Tienda

- [ ] Navegar a Comparativas > Por Tienda
- [ ] Seleccionar tienda del dropdown
- [ ] Verificar que datos cambian al seleccionar otra tienda
- [ ] Probar navegación de meses
- [ ] Verificar KPI Cards específicos de tienda
- [ ] Verificar gráfica de barras por tipo de cita
- [ ] Verificar tabla con mensaje "Sin datos" para años sin información
- [ ] Responsive

#### Vista Patrones

- [ ] Navegar a Comparativas > Patrones
- [ ] Verificar gráfica de barras por día de semana
- [ ] Verificar gráfica de distribución horaria
- [ ] Verificar "Top 5 Horas Más Activas" con barras de progreso
- [ ] Verificar tabla detallada por día de semana
- [ ] Filtrar por tienda
- [ ] Cambiar mes/año
- [ ] Responsive

#### Vista Acuity vs Histórico

- [ ] Navegar a Comparativas > Acuity vs Histórico
- [ ] Probar preset "Este Mes"
- [ ] Probar preset "Últimos 30 Días"
- [ ] Probar preset "Este Año"
- [ ] Verificar que datos de Acuity se comparan con años anteriores
- [ ] Verificar KPI Cards con comparación vs año anterior
- [ ] Verificar fila resaltada de "Acuity" en tabla (bg-blue-50)
- [ ] Verificar gráfica comparativa multi-año
- [ ] Responsive

### 4. Testing de Edge Cases

- [ ] **Tienda sin datos en años anteriores**: Debe mostrar "Sin datos para este período"
- [ ] **Mes sin citas**: Debe mostrar métricas en 0, no error
- [ ] **Cancelaciones**: Verificar que tasa de cancelación se calcula correctamente
- [ ] **Navegación a futuro**: Botón siguiente deshabilitado en diciembre 2025
- [ ] **Autenticación**: API debe retornar 401 si no hay sesión
- [ ] **RLS Policies**: Solo admin/marketing_manager pueden ver datos

### 5. Testing de Performance

- [ ] Cargar Vista General: < 2 segundos
- [ ] Cambiar de mes: < 1 segundo
- [ ] Cambiar de tienda: < 1 segundo
- [ ] API con 57K registros: < 500ms
- [ ] Verificar que las queries usan índices (EXPLAIN en Supabase)
- [ ] Probar con múltiples tabs abiertos simultáneamente

### 6. Testing de Cálculos

#### Verificación Manual de Métricas

```sql
-- Enero 2024 Madrid
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN appointment_type = 'medicion' THEN 1 ELSE 0 END) as medicion,
  SUM(CASE WHEN appointment_type = 'fitting' THEN 1 ELSE 0 END) as fitting,
  SUM(CASE WHEN is_cancelled THEN 1 ELSE 0 END) as cancelled,
  ROUND(100.0 * SUM(CASE WHEN is_cancelled THEN 1 ELSE 0 END) / COUNT(*), 2) as cancellation_rate,
  COUNT(DISTINCT DATE(datetime)) as unique_days,
  ROUND(COUNT(*)::numeric / COUNT(DISTINCT DATE(datetime)), 2) as avg_per_day
FROM historical_appointments
WHERE year = 2024 AND month = 1 AND store_city = 'Madrid';
```

Comparar estos resultados con los que muestra la UI.

## 📊 Métricas Esperadas

### Distribución por Tienda (Total Histórico)

- Madrid: ~47.9% (27,776)
- Sevilla: ~29.2% (16,921)
- Málaga: ~10.6% (6,135)
- Barcelona: ~5.4% (3,156)

### Distribución por Tipo

- Medición: ~58-61%
- Fitting: ~39-41%

### Distribución por Categoría

- Regular: ~97%
- Tour: ~2.8%
- Videoconsulta: ~0.01%
- Ponte Traje: ~0.2%

## 🐛 Issues Conocidos a Verificar

1. **Error de Network Interfaces**: Al iniciar servidor (error de sistema, no afecta funcionalidad)
2. **Puerto 3000 ocupado**: Servidor usa puerto 3002 como fallback
3. **Datos de Acuity**: Verificar que API `/api/acuity/appointments` existe y funciona

## ✅ Criterios de Aceptación

- [ ] Todas las vistas cargan sin errores
- [ ] Datos son consistentes entre vistas
- [ ] Comparativas calculan % de cambio correctamente
- [ ] Flechas de tendencia apuntan en la dirección correcta
- [ ] Filtros funcionan correctamente
- [ ] Navegación de meses/años es fluida
- [ ] Diseño es responsive en todos los dispositivos
- [ ] Performance es aceptable (< 2s carga inicial)
- [ ] No hay errores en consola del navegador
- [ ] No hay errores de linting
- [ ] Datos importados coinciden con estadísticas del Excel

## 🚀 Próximos Pasos (Post-Testing)

1. Documentar cualquier issue encontrado
2. Optimizar queries lentas
3. Agregar loading skeletons si es necesario
4. Considerar caché de datos históricos (no cambian)
5. Agregar tooltips explicativos en KPI Cards
6. Exportar datos a CSV/Excel desde UI

