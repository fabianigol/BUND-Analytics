# Instrucciones para Completar la Implementación de Comparativas Mejoradas

## 1. Ejecutar las Funciones RPC en Supabase

Antes de que las nuevas funcionalidades funcionen completamente, necesitas ejecutar el script SQL que crea las funciones RPC en tu base de datos de Supabase.

### Pasos:

1. Ve a tu proyecto de Supabase en https://supabase.com/dashboard
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido completo del archivo:
   ```
   supabase/create_additional_historical_stats_functions.sql
   ```
5. Ejecuta el script (botón "Run" o Ctrl/Cmd + Enter)
6. Verifica que las 3 funciones se hayan creado correctamente:
   - `get_historical_stats_annual`
   - `get_historical_stats_monthly_breakdown`
   - `get_historical_stats_by_store`

## 2. Verificar que la Tabla `historical_appointments` Existe

Las nuevas funciones RPC requieren que exista la tabla `historical_appointments`. Si no existe, ejecuta la migración correspondiente primero.

## 3. Cambios Implementados

### Frontend (general-view.tsx):

✅ **Selector de Años**: Todos los años (2025-2021) pre-seleccionados automáticamente
✅ **Selector de Mes**: 12 botones (Ene-Dic) en lugar de flechas de navegación
✅ **Quick Stats Mejoradas**: Cards con gradientes sutiles y colores vibrantes según el tipo
✅ **Gráfica Evolución por Años**: Muestra totales anuales en lugar de datos del mes
✅ **Tabla Expandible**: Click en cada año para ver desglose mensual
✅ **Gráfica con Opciones**: 3 visualizaciones (Totales Anuales / Desglose Mensual / Por Tipo)
✅ **Gráfica Mensual por Tienda**: Evolución mes a mes de cada tienda en el año seleccionado
✅ **Gráfica Anual por Tienda**: Comparación de totales anuales por tienda

### Backend:

✅ **3 Nuevos Endpoints API**:
   - `/api/citas/historical/annual-totals` - Totales anuales
   - `/api/citas/historical/monthly-breakdown` - Desglose mensual
   - `/api/citas/historical/by-store` - Datos por tienda

✅ **3 Nuevas Funciones RPC en Supabase** (archivo SQL creado)

### Componentes:

✅ **ComparisonKPICard**: Mejorado con prop `variant` para gradientes personalizados

## 4. Estructura de Colores por Tienda

Las gráficas de tiendas utilizan los siguientes colores consistentes:

- 🔴 Madrid: `#EF4444`
- 🟠 Sevilla: `#F59E0B`
- 🟢 Málaga: `#10B981`
- 🔵 Barcelona: `#3B82F6`
- 🟣 Murcia: `#8B5CF6`
- 🩷 Bilbao: `#EC4899`
- 🩵 Valencia: `#14B8A6`
- 🟧 Zaragoza: `#F97316`
- 🟦 CDMX: `#6366F1`

**⚠️ IMPORTANTE - Normalización de Nombres:**
Los nombres de tiendas deben coincidir EXACTAMENTE con cómo están en la columna `store_city` de la base de datos:
- México/México/Polanco se normalizan como **CDMX** (TODO MAYÚSCULAS)
- Las demás ciudades están con primera letra mayúscula: Madrid, Sevilla, Málaga, etc.

## 5. Testing Manual Recomendado

Una vez ejecutadas las migraciones SQL, verifica:

1. **Filtros**: Selecciona/deselecciona años y meses - los datos deben actualizarse
2. **Quick Stats**: Verifica que muestren gradientes y colores correctos
3. **Tabla Expandible**: Click en cada año para ver desglose mensual
4. **Gráfica Evolución**: Verifica que muestre totales anuales
5. **Análisis Comparativo**: Prueba las 3 opciones de visualización
6. **Gráficas de Tiendas**: Cambia el año y verifica que los datos se actualicen
7. **Responsive**: Prueba en móvil - los botones de mes deben ajustarse

## 6. Consideraciones de Performance

- Los datos anuales se cargan solo una vez por sesión
- Los datos mensuales se cargan bajo demanda (al expandir o cambiar vista)
- Las funciones RPC evitan el límite de 1000 registros de Supabase JS
- Los colores de tiendas son consistentes en todas las visualizaciones

## 7. Próximos Pasos Opcionales

Si quieres optimizar aún más:

1. Añadir caché de datos anuales (React Query o similar)
2. Implementar lazy loading para las gráficas de tiendas
3. Añadir exportación de datos a CSV/Excel
4. Añadir filtros adicionales (por tipo de cita, por tienda)

## 8. Solución de Problemas

### "Error al cargar datos anuales"
- Verifica que las funciones RPC se hayan creado en Supabase
- Revisa los logs del navegador para más detalles
- Verifica que la tabla `historical_appointments` tenga datos

### "No se muestran datos en las gráficas de tiendas"
- Asegúrate de que los nombres de tiendas en la BD coincidan EXACTAMENTE con los del código
- Los nombres deben ser: Madrid, Sevilla, Málaga, Barcelona, Murcia, Bilbao, Valencia, Zaragoza, **CDMX** (todo mayúsculas)
- Para verificar: `SELECT DISTINCT store_city FROM historical_appointments ORDER BY store_city;`

### "Los botones de mes no funcionan"
- Verifica que el prop `onMonthChange` se esté pasando correctamente
- Revisa la consola del navegador para errores

## ¡Implementación Completada!

Todos los cambios solicitados han sido implementados. Disfruta de las nuevas funcionalidades de comparativas históricas mejoradas.
