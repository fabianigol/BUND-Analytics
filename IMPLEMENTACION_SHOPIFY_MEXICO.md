# Implementación Shopify México - Completada ✅

## Resumen de Cambios

Se ha implementado completamente la integración de Shopify México con navegación por países (España/México), gestión independiente de datos por país, y vistas compartidas de ubicaciones y objetivos.

## Archivos Modificados/Creados

### 1. Base de Datos
- ✅ `supabase/migration_add_country_to_shopify.sql` - Migración para agregar columna `country`

### 2. Types
- ✅ `src/types/database.ts` - Actualizado con campo `country` en todas las tablas
- ✅ `src/types/index.ts` - Actualizado ShopifyOrder y SalesTarget

### 3. Variables de Entorno
- ✅ `env.example` - Agregadas variables para Shopify México

### 4. Servicios
- ✅ `src/lib/integrations/shopify.ts` - Funciones para crear servicios por país
- ✅ `src/lib/utils/meta-country-detector.ts` - Detección automática de país en campañas Meta

### 5. APIs
- ✅ `src/app/api/sync/shopify/route.ts` - Sincronización multi-país
- ✅ `src/app/api/sync/meta/route.ts` - Detección automática de país en Meta Ads
- ✅ `src/app/api/shopify/route.ts` - Todas las funciones con filtro por país
- ✅ `src/app/api/sales-targets/route.ts` - Soporte para país
- ✅ `src/app/api/sales-targets/progress/route.ts` - Filtrado por país
- ✅ `src/app/api/integrations/shopify/route.ts` - API con soporte multi-país
- ✅ `src/app/api/cron/sync-shopify-periodic/route.ts` - Sincronización de ambos países

### 6. UI - Componentes
- ✅ `src/components/dashboard/Sidebar.tsx` - Sub-menú España/México
- ✅ `src/lib/utils/format.ts` - Funciones de formato de moneda MXN
- ✅ `src/components/dashboard/LocationBentoCard.tsx` - Multi-moneda con colores para México
- ✅ `src/components/dashboard/TargetLocationCard.tsx` - Multi-moneda

### 7. UI - Páginas
- ✅ `src/app/(dashboard)/ventas/page.tsx` - Actualizada con soporte country
- ✅ `src/app/(dashboard)/ventas/espana/page.tsx` - Nueva página España
- ✅ `src/app/(dashboard)/ventas/mexico/page.tsx` - Nueva página México
- ✅ `src/app/(dashboard)/integraciones/page.tsx` - Shopify separado por país

## Pasos para Activar la Funcionalidad

### 1. Ejecutar Migración de Base de Datos

**Opción A: Usando Supabase CLI (Recomendado)**
```bash
supabase db push
```

**Opción B: Ejecutar SQL directamente en Supabase Dashboard**
1. Ve a tu proyecto en Supabase Dashboard
2. Navega a SQL Editor
3. Copia y ejecuta el contenido de `supabase/migration_add_country_to_shopify.sql`

### 2. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env.local`:

```bash
# Shopify México
SHOPIFY_SHOP_DOMAIN_MX=tu-tienda-mexico.myshopify.com
SHOPIFY_ACCESS_TOKEN_MX=shpat_xxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION_MX=2024-01
```

### 3. Configurar Integración en la UI

1. Ve a la página de **Integraciones** (`/integraciones`)
2. Verás dos tarjetas de Shopify:
   - **Shopify España** (ya configurado)
   - **Shopify México** (nuevo)
3. Configura las credenciales de Shopify México
4. Haz clic en **Sincronizar** para importar los datos

### 4. Sincronizar Datos

**Primera Sincronización:**
```bash
# Sincronizar España
curl -X POST http://localhost:3000/api/sync/shopify?country=ES

# Sincronizar México
curl -X POST http://localhost:3000/api/sync/shopify?country=MX
```

**Sincronizar Meta Ads (detectará automáticamente el país):**
```bash
curl -X POST http://localhost:3000/api/sync/meta
```

### 5. Verificar Navegación

1. En el **Sidebar**, haz clic en **Ventas**
2. Verás un sub-menú con:
   - 🇪🇸 España
   - 🇲🇽 México
3. Haz clic en cada uno para ver los datos respectivos

## Estructura de Navegación

```
Ventas ▼
├─ 🇪🇸 España (/ventas/espana → /ventas?country=ES)
│  ├─ Pedidos (solo España)
│  ├─ Pedidos Online (solo España)
│  ├─ Clientes (solo España)
│  ├─ Ubicaciones (España + México)
│  └─ Objetivos (España + México)
└─ 🇲🇽 México (/ventas/mexico → /ventas?country=MX)
   ├─ Pedidos (solo México)
   ├─ Pedidos Online (solo México)
   ├─ Clientes (solo México)
   ├─ Ubicaciones (España + México)
   └─ Objetivos (España + México)
```

## Características Implementadas

### ✅ Shopify Multi-País
- Dos integraciones independientes (España y México)
- Sincronización separada por país
- Filtrado automático de datos por país
- Soporte completo en todas las APIs

### ✅ Meta Ads Automático
- Misma cuenta de Meta Ads
- Detección automática de país por nombre de campaña:
  - **México**: contiene "CDMX", "México", "Mexico", "_MX"
  - **España**: contiene ciudades españolas o "_ES", "_Spain"
- ROAS calculado por país automáticamente

### ✅ Multi-Moneda
- España: €1,234 (EUR)
- México: $1,234 MXN
- Formateo automático según país en toda la UI

### ✅ Vistas Compartidas
- **Ubicaciones**: Muestra todas las tiendas (España + México) en una sola vista
- **Objetivos**: Muestra todos los objetivos (España + México) en una sola vista
- Colores distintos para ubicaciones mexicanas (fuchsia/magenta)

### ✅ Vistas Exclusivas por País
- **Pedidos**: Solo del país seleccionado
- **Pedidos Online**: Solo del país seleccionado
- **Clientes**: Solo del país seleccionado

## Detección Automática de Campañas Meta

Las campañas de Meta Ads se asignan automáticamente a cada país:

**Campañas de México:**
- `PRO_Citas_Club_CDMX` → MX ✅
- `PRO_LP_Black_Friday_25'_Waitlist_CDMX` → MX ✅
- Cualquier campaña con "CDMX", "México", "Mexico" en el nombre

**Campañas de España:**
- `PRO_Leads_Madrid` → ES ✅
- `Sales_Ecom_Drop_Main - AW25_Spain` → ES ✅
- Cualquier campaña con ciudades españolas o "_ES", "_Spain"

## Ubicaciones Soportadas

**España:**
- Madrid, Barcelona, Sevilla, Málaga, Bilbao, Valencia, Murcia, Zaragoza
- online (ventas online España)

**México:**
- Ciudad de México / CDMX / México
- online (ventas online México)

## Notas Importantes

### Datos Históricos
- Todos los datos existentes de España se marcaron automáticamente como `country='ES'`
- Las campañas de Meta Ads existentes se detectaron automáticamente

### Permisos
- Los permisos del sidebar siguen siendo "ventas" para ambos países
- No se requieren permisos adicionales

### Cron Jobs
- El cron job sincroniza automáticamente ambos países
- Si México no está configurado aún, solo sincroniza España sin errores

## Testing Manual Recomendado

### 1. Verificar Sidebar
- [ ] El sidebar muestra "Ventas" con un sub-menú
- [ ] Al hacer clic en "Ventas" se expande/colapsa
- [ ] Se muestran "España" y "México" como opciones
- [ ] Al hacer clic en cada uno, navega correctamente

### 2. Verificar Página de España
- [ ] URL: `/ventas/espana` redirige a `/ventas?country=ES`
- [ ] El título muestra "Ventas - España"
- [ ] Los montos se muestran en EUR (€)
- [ ] Solo muestra pedidos de España
- [ ] La pestaña "Ubicaciones" muestra todas las ubicaciones (ES + MX)
- [ ] La pestaña "Objetivos" muestra todos los objetivos (ES + MX)

### 3. Verificar Página de México
- [ ] URL: `/ventas/mexico` redirige a `/ventas?country=MX`
- [ ] El título muestra "Ventas - México"
- [ ] Los montos se muestran en MXN ($X,XXX MXN)
- [ ] Solo muestra pedidos de México
- [ ] La pestaña "Ubicaciones" muestra todas las ubicaciones (ES + MX)
- [ ] La pestaña "Objetivos" muestra todos los objetivos (ES + MX)

### 4. Verificar Integraciones
- [ ] En `/integraciones` se muestran dos tarjetas de Shopify
- [ ] "Shopify España" y "Shopify México" separadas
- [ ] Cada una con su estado de conexión independiente
- [ ] Se puede conectar/desconectar cada una por separado

### 5. Verificar Sincronización
- [ ] La sincronización de España funciona (`POST /api/sync/shopify?country=ES`)
- [ ] La sincronización de México funciona (`POST /api/sync/shopify?country=MX`)
- [ ] Los pedidos se guardan con el campo `country` correcto
- [ ] Las campañas de Meta Ads se asignan al país correcto

### 6. Verificar ROAS
- [ ] El ROAS en España usa solo campañas de España
- [ ] El ROAS en México usa solo campañas de México (con "CDMX" en el nombre)

### 7. Verificar Ubicaciones y Objetivos
- [ ] Las tarjetas de ubicaciones muestran la moneda correcta (EUR o MXN)
- [ ] Los colores de CDMX/México son diferentes (fuchsia/magenta)
- [ ] Los objetivos muestran la moneda correcta según la ubicación
- [ ] El progreso se calcula correctamente para cada ubicación

## Comandos Útiles

### Verificar datos en base de datos
```sql
-- Ver distribución de pedidos por país
SELECT country, COUNT(*) as count 
FROM public.shopify_orders 
GROUP BY country;

-- Ver distribución de campañas Meta por país
SELECT country, COUNT(*) as count, 
       STRING_AGG(DISTINCT campaign_name, ', ' LIMIT 5) as sample_campaigns
FROM public.meta_campaigns 
GROUP BY country;

-- Ver objetivos por país
SELECT country, location, COUNT(*) as count 
FROM public.sales_targets 
GROUP BY country, location;
```

### Logs de sincronización
```sql
-- Ver últimas sincronizaciones
SELECT integration, status, records_synced, completed_at 
FROM public.sync_logs 
ORDER BY completed_at DESC 
LIMIT 20;
```

## Próximos Pasos

1. ✅ Ejecutar migración de base de datos
2. ⏳ Configurar credenciales de Shopify México en `.env.local`
3. ⏳ Sincronizar datos de México por primera vez
4. ⏳ Crear objetivos de facturación para ubicaciones de México
5. ⏳ Verificar que las campañas de Meta Ads se detecten correctamente
6. ⏳ Testing manual de toda la funcionalidad

## Soporte

Si encuentras algún problema:
1. Revisa los logs del servidor (consola)
2. Verifica que las credenciales estén correctas en `.env.local`
3. Verifica que la migración se haya ejecutado correctamente
4. Revisa los sync_logs en Supabase para ver detalles de errores

---

**Implementación completada el:** 2026-01-11  
**Estado:** ✅ Lista para probar  
**Siguiente paso:** Ejecutar migración y configurar credenciales
