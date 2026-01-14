# Solución: Error "redirect_uri_mismatch" al Reconectar Google Analytics

## 🔴 Problema
Cuando intentas reconectar Google Analytics, aparece el error:
```
Error 400: redirect_uri_mismatch
```

Este error significa que la URL de redirección que usa tu aplicación no está autorizada en Google Cloud Console.

## ✅ Solución Paso a Paso

### Paso 1: Identificar tu URL de Redirección

Tu aplicación usa una de estas URLs dependiendo de tu entorno:

**Desarrollo (localhost):**
```
http://localhost:3000/api/integrations/analytics/callback
```

**Producción (tu dominio):**
```
https://tu-dominio.com/api/integrations/analytics/callback
```

### Paso 2: Verificar Variables de Entorno

Revisa tu archivo `.env.local` o las variables de entorno en producción:

```env
GOOGLE_REDIRECT_URI=https://tu-dominio.com/api/integrations/analytics/callback
# O si usas NEXT_PUBLIC_APP_URL:
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

**IMPORTANTE:** Si usas `NEXT_PUBLIC_APP_URL`, la URL se construye automáticamente como:
`${NEXT_PUBLIC_APP_URL}/api/integrations/analytics/callback`

### Paso 3: Configurar URLs en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto (ej: `mkth-hub`)
3. Ve a **APIs y servicios** → **Credenciales**
4. Busca tu **OAuth 2.0 Client ID** (debe tener el mismo `GOOGLE_CLIENT_ID` que usas en tu `.env`)
5. Haz clic en el nombre del cliente OAuth para editarlo
6. En la sección **"URIs de redirección autorizados"**, verifica que estén TODAS las URLs que necesitas:

**Para Desarrollo:**
```
http://localhost:3000/api/integrations/analytics/callback
```

**Para Producción:**
```
https://tu-dominio.com/api/integrations/analytics/callback
https://www.tu-dominio.com/api/integrations/analytics/callback
```

**⚠️ IMPORTANTE:**
- Si estás en **producción**, DEBES usar `https://` (no `http://`)
- La URL debe coincidir EXACTAMENTE (incluye o no la barra final `/`)
- Puedes agregar múltiples URLs (una por cada entorno)

7. Haz clic en **"Guardar"**
8. Espera 2-5 minutos para que los cambios se propaguen

### Paso 4: Verificar que la URL Coincida Exactamente

La URL debe ser EXACTAMENTE igual en ambos lugares:

**En tu variable de entorno:**
```env
GOOGLE_REDIRECT_URI=https://tu-dominio.com/api/integrations/analytics/callback
```

**En Google Cloud Console:**
```
https://tu-dominio.com/api/integrations/analytics/callback
```

**Errores comunes:**
- ❌ `http://` vs `https://` (diferente protocolo)
- ❌ `tu-dominio.com` vs `www.tu-dominio.com` (con/sin www)
- ❌ Terminación con `/` vs sin `/`
- ❌ Puerto diferente: `:3000` vs `:8080`

### Paso 5: Reconectar Después de Configurar

1. Una vez agregada la URL correcta en Google Cloud Console
2. Espera 2-5 minutos
3. Intenta reconectar Google Analytics desde tu aplicación

## 🔍 Cómo Verificar la URL que Está Usando tu Aplicación

Para debug, puedes revisar los logs de tu aplicación. La URL se construye así:

```typescript
// En src/app/api/integrations/analytics/auth/route.ts
const redirectUri = process.env.GOOGLE_REDIRECT_URI || 
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/analytics/callback`
```

**Prioridad:**
1. Primero usa `GOOGLE_REDIRECT_URI` si está definida
2. Si no, construye desde `NEXT_PUBLIC_APP_URL`
3. Si no hay ninguna, usa `http://localhost:3000` (fallback)

## 🔍 Solución para Search Console Vacío

Si después de reconectar, la sección de Search Console aparece vacía, puede ser por:

### Verificar que el Dominio Esté en Search Console

1. Ve a [Google Search Console](https://search.google.com/search-console)
2. Verifica que tu dominio esté agregado y verificado
3. Los formatos válidos pueden ser:
   - `https://bundcompany.com` (prefijo completo)
   - `sc-domain:bundcompany.com` (dominio completo)

### Configurar el Site URL (Opcional)

El código usa por defecto `sc-domain:bundcompany.com`. Si tu dominio es diferente, puedes:

1. Ir a tu página de Integraciones
2. Buscar la configuración de Google Analytics
3. Si hay un campo para "Site URL" o "Search Console URL", configúralo

O actualiza directamente en Supabase la tabla `integration_settings`, en el campo `settings.site_url` del registro con `integration = 'analytics'`.

## 🆘 Si el Problema Persiste

### Verificar en Logs
Revisa los logs de tu aplicación cuando intentas conectar. Deberías ver la URL que se está usando.

### Verificar Variables de Entorno
Asegúrate de que las variables de entorno estén correctamente configuradas en tu entorno de producción (Vercel, Railway, etc.)

### Verificar el Dominio
Si estás usando un dominio personalizado, asegúrate de que esté correctamente configurado y que use HTTPS.

## 📝 Notas Adicionales

- Los cambios en Google Cloud Console pueden tardar hasta 5 minutos en aplicarse
- Si cambias de entorno (desarrollo → producción), necesitas actualizar tanto las variables de entorno como Google Cloud Console
- Puedes tener múltiples URLs autorizadas para soportar diferentes entornos
