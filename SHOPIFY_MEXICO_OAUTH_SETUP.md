# Configuración de Shopify México con OAuth

## 🎯 Resumen

Se ha implementado **Client Credentials Grant** (OAuth) exclusivamente para la tienda de Shopify México, mientras que España mantiene el método tradicional de token directo (`shpat_`).

## 🔐 Diferencias por País

### España (Custom App)
- ✅ Método: Token directo `shpat_` o `shpca_`
- ✅ Configuración: Variables de entorno estáticas
- ✅ Sin cambios en la configuración actual

### México (Dev App con OAuth)
- 🆕 Método: Client Credentials Grant (OAuth)
- 🆕 Configuración: `Client ID` + `Client Secret` (`shpss_`)
- 🆕 Tokens renovados automáticamente cada 24h

## 📋 Pasos para Configurar México

### 1. Obtener Credenciales de la Dev App

1. Ve al **Shopify Partner Dashboard**
2. Selecciona tu Dev App para México
3. Ve a **Configuration** o **Settings**
4. Copia:
   - **Client ID**: Un string alfanumérico
   - **Client Secret**: Comienza con `shpss_`

### 2. Instalar la App en tu Tienda de México

⚠️ **Importante**: La Dev App debe estar **instalada** en tu tienda de México.

1. En el Partner Dashboard, ve a tu Dev App
2. Click en **Install app** o **Test your app**
3. Selecciona tu tienda de México
4. Autoriza los permisos necesarios:
   - ⚠️ **`read_all_orders`** (IMPORTANTE: En Dev Apps 2026+ usa `read_all_orders` NO solo `read_orders`)
   - O alternativamente: `read_orders` + `write_orders` (ambos juntos)
   - `read_products`
   - `read_customers`
   - `read_locations`

### 3. Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env.local`:

```bash
# Shopify México (Dev App - OAuth)
SHOPIFY_SHOP_DOMAIN_MX=tu-tienda-mx.myshopify.com
SHOPIFY_CLIENT_ID_MX=tu_client_id_aqui
SHOPIFY_CLIENT_SECRET_MX=shpss_tu_client_secret_aqui
SHOPIFY_API_VERSION_MX=2024-01
```

⚠️ **No uses** `SHOPIFY_ACCESS_TOKEN_MX` - el sistema generará los tokens automáticamente.

### 4. Conectar en la Interfaz

1. Ve a **Integraciones** en tu dashboard
2. Encuentra **Shopify México**
3. Click en **Conectar**
4. Completa el formulario:
   - **Shop Domain**: `tu-tienda-mx.myshopify.com`
   - **Client ID**: Tu Client ID
   - **Client Secret**: Tu Client Secret (`shpss_...`)
5. Click en **Conectar**

El sistema automáticamente:
- Obtendrá un access token válido usando OAuth
- Lo guardará en Supabase con fecha de expiración
- Lo renovará automáticamente cada 24h

### 5. Sincronizar Datos

Una vez conectado, sincroniza los datos:

```bash
# Desde el dashboard: Integraciones → Shopify México → Sincronizar
# O manualmente:
curl -X POST "http://localhost:3000/api/sync/shopify?country=MX"
```

## 🔄 Renovación Automática de Tokens

### Cómo Funciona

1. **Duración**: Los tokens de Shopify OAuth expiran cada **24 horas**
2. **Renovación**: El sistema renueva automáticamente el token cuando:
   - Expira o está próximo a expirar (< 1h restante)
   - Se hace una petición a la API
3. **Almacenamiento**: Los tokens se guardan en `integration_settings` con:
   - `access_token`: El token actual
   - `expires_at`: Fecha/hora de expiración
   - `client_id` y `client_secret`: Para renovar el token

### Verificar Estado del Token

El token se renueva automáticamente en cada petición, pero puedes verificar el estado:

1. Ve a Supabase → `integration_settings`
2. Busca el registro con `integration = 'shopify_mx'`
3. Revisa `settings.expires_at`

## 🛠️ Arquitectura Técnica

### Archivos Modificados/Creados

1. **`src/lib/integrations/shopify-oauth.ts`** (NUEVO)
   - `getShopifyAccessToken()`: Obtiene token usando Client Credentials
   - `getShopifyAccessTokenMX()`: Obtiene token de México (con renovación automática)
   - `refreshShopifyAccessTokenMX()`: Renueva el token cuando expira
   - `saveShopifyAccessTokenMX()`: Guarda token en Supabase

2. **`src/lib/integrations/shopify.ts`** (MODIFICADO)
   - `createShopifyServiceMexicoAsync()`: Nueva función async con soporte OAuth
   - `createShopifyServiceByCountryAsync()`: Versión async del factory

3. **`src/app/api/sync/shopify/route.ts`** (MODIFICADO)
   - Detecta si México tiene OAuth configurado
   - Obtiene token automáticamente antes de sincronizar
   - Fallback a token directo si OAuth no está disponible

4. **`src/app/api/integrations/shopify/route.ts`** (MODIFICADO)
   - POST: Acepta `clientId` + `clientSecret` para México
   - Obtiene token OAuth automáticamente al conectar
   - Valida y guarda credenciales en Supabase

5. **`src/app/(dashboard)/integraciones/page.tsx`** (MODIFICADO)
   - UI diferente para México (campos OAuth) vs España (token directo)
   - Validación específica por país
   - Manejo de errores mejorado

6. **`env.example`** (ACTUALIZADO)
   - Documentación de variables OAuth para México
   - Explicación de diferencias entre países

## 🐛 Troubleshooting

### Error: "This action requires merchant approval for read_orders scope"

**Causa**: Scopes incorrectos o insuficientes en la Dev App

**Solución**:
1. ⚠️ **Dev Apps 2026+ requieren `read_all_orders` en lugar de solo `read_orders`**
2. En Partner Dashboard → Tu Dev App → Configuration → Access:
   - Activa: `read_all_orders` (recomendado)
   - O activa: `read_orders` + `write_orders` juntos
3. **IMPORTANTE**: Después de cambiar scopes, debes **REINSTALAR** la app
4. Desconecta y reconecta en Integraciones → Shopify México

### Error: "Failed to get Shopify access token"

**Causa**: Credenciales incorrectas o app no instalada

**Solución**:
1. Verifica que el Client ID y Client Secret sean correctos
2. Asegúrate de que la Dev App esté **instalada** en tu tienda de México
3. Verifica los permisos de la app (read_all_orders, read_products)

### Error: "No authentication method available"

**Causa**: Variables de entorno no configuradas

**Solución**:
1. Verifica que existan las variables en `.env.local`:
   - `SHOPIFY_SHOP_DOMAIN_MX`
   - `SHOPIFY_CLIENT_ID_MX`
   - `SHOPIFY_CLIENT_SECRET_MX`
2. Reinicia el servidor de Next.js

### Token expira demasiado rápido

**Causa**: Los tokens de Shopify OAuth expiran cada 24h (es normal)

**Solución**:
- El sistema renueva automáticamente el token
- No requiere acción manual
- Si ves errores persistentes, reconecta la integración

### "Invalid API key or access token"

**Causa**: Token expirado y falló la renovación

**Solución**:
1. Ve a Integraciones → Shopify México
2. Click en **Desconectar**
3. Vuelve a conectar con tus credenciales OAuth

## 📊 Comparación: España vs México

| Característica | España (Custom App) | México (Dev App OAuth) |
|----------------|---------------------|------------------------|
| Tipo de App | Custom App | Dev App |
| Autenticación | Token directo | OAuth Client Credentials |
| Token Format | `shpat_...` o `shpca_...` | `shpss_...` (Client Secret) |
| Expiración | Sin expiración | 24 horas |
| Renovación | No necesaria | Automática |
| Variables de entorno | `SHOPIFY_ACCESS_TOKEN` | `SHOPIFY_CLIENT_ID_MX` + `SHOPIFY_CLIENT_SECRET_MX` |
| UI de conexión | Campo Access Token | Campos Client ID + Secret |
| **Scopes principales** | `read_orders` | `read_all_orders` ⚠️ |

### ⚠️ Diferencia Crítica de Scopes

Las **Dev Apps (2026+)** tienen un sistema de permisos diferente:

- **Custom App (España)**: `read_orders` da acceso completo a pedidos
- **Dev App (México)**: Requiere `read_all_orders` para acceso completo a pedidos
  - O alternativamente: `read_orders` + `write_orders` juntos

**¿Por qué?** Shopify cambió el modelo de seguridad para separar:
- `read_orders`: Solo pedidos del usuario actual (limitado)
- `read_all_orders`: Todos los pedidos de la tienda (necesario para analytics)

## ✅ Validación de la Instalación

Para verificar que todo funciona correctamente:

1. **Conectar integración**: 
   - Ve a Integraciones → Shopify México → Conectar
   - Completa los campos de OAuth
   - Deberías ver "Shopify México conectado correctamente"

2. **Sincronizar datos**:
   - Click en **Sincronizar**
   - Verifica en logs que dice "Using OAuth to get access token"
   - Debería completar sin errores

3. **Verificar datos**:
   - Ve a Ventas → México
   - Deberías ver las métricas actualizadas
   - Las ubicaciones de México deberían mostrar formato MXN

4. **Verificar renovación automática**:
   - Después de 23 horas, el sistema debería renovar el token automáticamente
   - Revisa los logs en la próxima sincronización

## 🔗 Referencias

- [Shopify Client Credentials Grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant)
- [Shopify Dev Apps Documentation](https://shopify.dev/docs/apps)
- [Shopify Admin API](https://shopify.dev/docs/api/admin)

## 📝 Notas Importantes

- ⚠️ **CRÍTICO**: Dev Apps 2026+ requieren `read_all_orders` (o `read_orders` + `write_orders`) - NO solo `read_orders`
- ⚠️ El Client Secret (`shpss_`) es sensible - nunca lo expongas en el código frontend
- ⚠️ Después de cambiar scopes, DEBES reinstalar la app en tu tienda
- ✅ España sigue funcionando con el método tradicional sin cambios
- 🔄 La renovación de tokens es completamente automática y transparente
- 📊 Los datos de México se almacenan con `country = 'MX'` en la base de datos
- 🎨 Las ubicaciones de México se muestran en formato MXN ($XXX MXN)
- 🔐 Los scopes de Dev Apps son diferentes a los de Custom Apps
