# Vista de Patrones - Documentación Completa

## 📋 Resumen

La **Vista de Patrones** es un sistema completo de análisis avanzado de patrones temporales para citas históricas. Incluye 9 secciones principales con visualizaciones interactivas, insights automáticos y soporte multi-anual.

## 🎯 Características Principales

### ✅ Implementado

1. **Header & Controles Inteligentes**
   - Selector multi-año con toggle individual
   - Modo multi-anual vs año único
   - Selector de tienda (individual o todas)
   - Badges informativos con total de datos analizados

2. **9 Secciones Completas**
   - ✅ Insights Destacados (automáticos con badges sutiles)
   - ✅ Patrones Temporales Estacionales (heatmap mes × día)
   - ✅ Patrones Semanales (radial + comparativo)
   - ✅ Patrones Horarios (heatmap día × hora + radial)
   - ✅ Patrones por Tienda (tabla comparativa)
   - ✅ Patrones por Tipo de Cita (Medición vs Fitting)
   - ✅ Patrones de Cancelación (heatmap + alertas)
   - ✅ Picos y Valles de Demanda (indicadores visuales)
   - ✅ Tendencias de Evolución (crecimiento año tras año)

3. **Componentes Visuales Nuevos**
   - ✅ `RadialClockChart`: Gráficas radiales para patrones de 24h y 7 días
   - ✅ `MultiHeatmap`: Heatmaps multi-dimensión con anotaciones
   - ✅ `InsightBadge`: Badges sutiles para insights automáticos
   - ✅ `PeakValleyIndicator`: Visualización de picos y valles
   - ✅ `AnimatedCard`: Cards con animaciones suaves
   - ✅ `SkeletonLoader`: Loaders skeleton para mejor UX

4. **APIs Robustas**
   - ✅ `/api/citas/historical/patterns`: Consultas avanzadas de patrones
   - ✅ `/api/citas/historical/insights`: Cálculo automático de insights

5. **Optimizaciones de Rendimiento**
   - ✅ Hook `usePatterns` con caching en memoria
   - ✅ Hook `useLazyLoad` para lazy loading de secciones
   - ✅ Memoización con `useMemo` y `useCallback`
   - ✅ Cache de 5 minutos para resultados de API

6. **Lógica de Insights Automáticos**
   - ✅ Detección de picos (> 1.5× promedio)
   - ✅ Análisis de tendencias (> 15% cambio)
   - ✅ Detección de anomalías (2 desviaciones estándar)
   - ✅ Identificación de patrones estacionales
   - ✅ Alertas de cancelación crítica

## 📁 Estructura de Archivos

```
src/
├── app/
│   ├── api/
│   │   └── citas/
│   │       └── historical/
│   │           ├── patterns/
│   │           │   └── route.ts          # API de patrones
│   │           └── insights/
│   │               └── route.ts          # API de insights
│   └── (dashboard)/
│       └── citas/
│           └── comparativas/
│               └── patrones-view.tsx     # Vista principal
├── components/
│   ├── citas/
│   │   ├── RadialClockChart.tsx          # Gráfica radial
│   │   ├── MultiHeatmap.tsx              # Heatmap avanzado
│   │   ├── InsightBadge.tsx              # Badges de insights
│   │   ├── PeakValleyIndicator.tsx       # Picos y valles
│   │   ├── AnimatedCard.tsx              # Cards animados
│   │   └── SkeletonLoader.tsx            # Loaders skeleton
│   └── ui/
│       └── tooltip.tsx                   # Tooltips (existente)
├── lib/
│   ├── hooks/
│   │   ├── usePatterns.ts                # Hook optimizado
│   │   └── useLazyLoad.ts                # Hook lazy loading
│   └── utils/
│       └── patternInsights.ts            # Lógica de insights
├── types/
│   └── patterns.ts                       # Tipos TypeScript
└── styles/
    └── patterns-animations.css           # Estilos y animaciones
```

## 🔧 APIs Implementadas

### 1. `/api/citas/historical/patterns`

**Parámetros:**
- `years`: Array de años (ej: `2025,2024,2023`)
- `stores`: Array de tiendas o `'all'`
- `patternType`: `temporal|hourly|weekly|store|cancellation|peak|growth|all`
- `compareMode`: `multi-year|single-year`

**Respuesta:**
```typescript
{
  filters: { years, stores, patternType, compareMode },
  seasonal?: SeasonalPattern[],
  weekly?: Record<number, WeeklyPattern[]>,
  hourly?: Record<number, HourlyPattern[]>,
  dayHourHeatmap?: { dayOfWeek, hour, count }[],
  storePatterns?: StorePattern[],
  cancellationPatterns?: { byDay, byHour, heatmap },
  peaksAndValleys?: { avgPerSlot, peaks, valleys },
  growthTrends?: GrowthTrend[]
}
```

### 2. `/api/citas/historical/insights`

**Parámetros:**
- `years`: Array de años
- `stores`: Array de tiendas o `'all'`
- `insightTypes`: `day|hour|cancellation|growth|anomaly|all`

**Respuesta:**
```typescript
{
  filters: { years, stores, insightTypes },
  totalInsights: number,
  insights: PatternInsight[]
}
```

## 🎨 Componentes Visuales

### RadialClockChart

Gráfica radial tipo reloj para visualizar patrones de 24 horas o 7 días de la semana.

```tsx
<RadialClockChart
  data={[{ label: 'Lun', value: 150 }, ...]}
  type="weekly" // o "hourly"
  colors={['#8B0000', '#3B82F6']}
  height={350}
/>
```

### MultiHeatmap

Heatmap multi-dimensión con soporte para anotaciones y comparaciones lado a lado.

```tsx
<MultiHeatmap
  data={[{ x: 0, y: 'Lun', value: 50 }, ...]}
  xLabel="Hora"
  yLabel="Día"
  title="Mapa de Calor"
  annotations={true}
  formatValue={(v) => `${v} citas`}
/>
```

### InsightBadge

Badge sutil para mostrar insights automáticos con tooltip.

```tsx
<InsightBadge
  type="peak" // peak|trend|growth|warning|info
  message="Sábado: Día más activo"
  detail="250 citas (+35% vs promedio)"
/>
```

### PeakValleyIndicator

Visualización de picos y valles de demanda.

```tsx
<PeakValleyIndicator
  peaks={[{ dayOfWeek: 6, hour: 12, count: 250 }]}
  valleys={[{ dayOfWeek: 1, hour: 8, count: 20 }]}
  avgValue={85}
/>
```

## 🚀 Optimizaciones

### 1. Hook usePatterns

Hook personalizado con caching automático:

```tsx
const { patternsData, insightsData, loading, error, refetch } = usePatterns({
  years: [2025, 2024],
  stores: 'all',
  enabled: true,
});
```

**Características:**
- Cache en memoria de 5 minutos
- Carga paralela de patterns e insights
- Gestión automática de estados

### 2. Hook useLazyLoad

Para lazy loading de secciones pesadas:

```tsx
const { ref, isVisible, hasBeenVisible } = useLazyLoad({
  threshold: 0.1,
  rootMargin: '100px',
});

return (
  <div ref={ref}>
    {hasBeenVisible ? <HeavySection /> : <Skeleton />}
  </div>
);
```

### 3. Memoización

Uso extensivo de `useMemo` para cálculos pesados:

```tsx
const weeklyChartData = useMemo(() => {
  // Procesamiento intensivo de datos
  return processedData;
}, [patternsData]);
```

## 📊 Insights Automáticos

### Tipos de Insights

1. **Peak**: Momentos de alta actividad
   - Detecta valores > 1.5× promedio
   - Identifica horas y días pico

2. **Trend**: Tendencias y preferencias
   - Preferencia matutina vs vespertina
   - Preferencia por tipo de cita

3. **Growth**: Crecimiento año tras año
   - Cambios > 15% considerados significativos
   - Análisis por segmento horario

4. **Warning**: Alertas de cancelación
   - Tasa > 35% = Crítico
   - Tasa > 25% = Alto
   - Tasa > 15% = Medio

5. **Info**: Información contextual
   - Oportunidades de promoción
   - Características específicas por día/hora

### Algoritmos de Detección

```typescript
// Peak Detection
if (value > average * 1.5) {
  insights.push({ type: 'peak', ... });
}

// Anomaly Detection (IQR Method)
const outliers = detectOutliers(values);
if (value > mean + 2 * stdDev) {
  insights.push({ type: 'info', category: 'anomaly', ... });
}

// Trend Analysis
const growth = ((current - previous) / previous) * 100;
if (Math.abs(growth) > 15) {
  insights.push({ type: growth > 0 ? 'growth' : 'warning', ... });
}
```

## 🎨 Estilos y Animaciones

### Animaciones CSS

- `slideInFromBottom`: Entrada suave desde abajo
- `fadeInUp`: Fade in con movimiento
- `pulse-subtle`: Pulso sutil para elementos destacados
- `shimmer`: Efecto shimmer para skeletons

### Gradientes por Categoría

```css
.gradient-card-purple /* Patrones generales */
.gradient-card-blue   /* Análisis temporal */
.gradient-card-green  /* Picos y crecimiento */
.gradient-card-amber  /* Insights y alertas */
.gradient-card-red    /* Cancelaciones */
```

### Efectos de Hover

```css
.hover-lift   /* Elevación al hover */
.hover-scale  /* Escala al hover */
.hover-glow   /* Brillo sutil al hover */
```

## 📱 Responsive Design

La vista es completamente responsive con breakpoints:

- **Mobile** (< 768px): 1 columna, layout vertical
- **Tablet** (768px - 1024px): 2 columnas para grids
- **Desktop** (> 1024px): Layout completo con todas las columnas

## 🔍 Casos de Uso

### 1. Identificar Horas Pico

**Objetivo**: Saber cuándo hay más demanda para optimizar personal.

**Cómo**: 
- Ver Sección 4 (Patrones Horarios)
- Observar heatmap día × hora
- Revisar insights automáticos de horas pico

### 2. Detectar Oportunidades de Promoción

**Objetivo**: Identificar momentos con baja demanda.

**Cómo**:
- Ver Sección 8 (Picos y Valles)
- Observar "Valles" (momentos de baja demanda)
- Crear promociones para esos horarios

### 3. Reducir Cancelaciones

**Objetivo**: Identificar cuándo se cancelan más citas.

**Cómo**:
- Ver Sección 7 (Patrones de Cancelación)
- Identificar momentos críticos (> 35% cancelación)
- Implementar recordatorios adicionales en esos momentos

### 4. Analizar Preferencias por Tienda

**Objetivo**: Entender patrones específicos de cada ubicación.

**Cómo**:
- Seleccionar tienda específica en header
- Ver Sección 5 (Patrones por Tienda)
- Comparar días y horas preferidas

### 5. Evaluar Crecimiento

**Objetivo**: Ver cómo han evolucionado los patrones.

**Cómo**:
- Activar modo "Multi-anual"
- Seleccionar múltiples años
- Ver Sección 9 (Tendencias de Evolución)

## 🐛 Debugging y Troubleshooting

### Problema: No se muestran datos

**Solución**:
1. Verificar que hay datos históricos en la BD
2. Revisar consola del navegador para errores de API
3. Verificar que los años seleccionados tienen datos

### Problema: Carga lenta

**Solución**:
1. El cache debería activarse después de la primera carga
2. Reducir número de años seleccionados
3. Verificar red en DevTools

### Problema: Insights no aparecen

**Solución**:
1. Verificar que hay suficientes datos para análisis
2. Revisar endpoint `/api/citas/historical/insights`
3. Algunos insights solo aparecen con datos significativos

## 🚀 Próximas Mejoras Posibles

1. **Exportación de Reportes**
   - PDF con insights principales
   - Excel con datos detallados

2. **Filtros Adicionales**
   - Por tipo de evento (regular, tour, videoconsulta)
   - Por rango de fechas personalizado

3. **Comparaciones Personalizadas**
   - Comparar dos tiendas específicas
   - Comparar dos períodos específicos

4. **Predicciones**
   - Machine Learning para predecir demanda futura
   - Sugerencias automáticas de staffing

5. **Notificaciones**
   - Alertas cuando se detectan anomalías
   - Recordatorios para revisar patrones mensuales

## 📞 Contacto y Soporte

Para preguntas o problemas:
1. Revisar esta documentación primero
2. Verificar logs del navegador y servidor
3. Revisar código fuente con comentarios JSDoc

---

**Versión**: 1.0.0  
**Fecha de Implementación**: Enero 2026  
**Estado**: ✅ Producción
