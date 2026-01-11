# Solución: Cron Jobs de Acuity Fallidos

## 🔍 Problema Identificado

Los cron jobs de Acuity no estaban funcionando debido a un **error de autenticación** en la comunicación interna entre endpoints.

### Causa Raíz

El flujo del cron job es el siguiente:

1. **Vercel Cron** llama a `/api/cron/sync-acuity-daily` (con el `CRON_SECRET`)
2. Este endpoint llama internamente a:
   - `/api/sync/acuity`
   - `/api/sync/acuity/availability`
   - `/api/sync/acuity/daily-snapshot`
   - `/api/sync/acuity/availability/snapshot`

**El problema:** El endpoint de cron NO estaba pasando el `CRON_SECRET` en las llamadas internas a los endpoints de sync. Como resultado:
- Los endpoints internos verificaban autenticación de usuario
- No encontraban un usuario autenticado (los cron jobs no tienen usuario)
- Retornaban error 401 Unauthorized
- La sincronización fallaba

## ✅ Solución Implementada

### 1. Actualización del Endpoint de Cron de Acuity

He modificado `/api/cron/sync-acuity-daily/route.ts` para que **pase el secret** en todas las llamadas internas:

```typescript
// ANTES (❌ fallaba)
const response = await fetch(`${origin}/api/sync/acuity`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
})

// DESPUÉS (✅ funciona)
const response = await fetch(`${origin}/api/sync/acuity`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-cron-secret': cronSecret, // Pasa el secret
  },
})
```

### 2. Actualización del Endpoint de Sync de Shopify

También he añadido la verificación de cron jobs en `/api/sync/shopify/route.ts`:

```typescript
import { isAuthorizedCronRequest } from '@/lib/utils/cron-auth'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Permitir acceso desde cron jobs autorizados
  const isCronRequest = isAuthorizedCronRequest(request)

  // Verificar autenticación solo si NO es un cron job
  if (!isCronRequest) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  // ... resto del código
}
```

### 3. Actualización del Endpoint de Cron de Shopify

He aplicado la misma corrección al nuevo endpoint de Shopify.

## 📋 Archivos Modificados

1. **`src/app/api/cron/sync-acuity-daily/route.ts`**
   - Añadido header `x-cron-secret` en todas las llamadas fetch internas

2. **`src/app/api/cron/sync-shopify-periodic/route.ts`**
   - Añadido header `x-cron-secret` en la llamada fetch interna

3. **`src/app/api/sync/shopify/route.ts`**
   - Añadida verificación de cron jobs con `isAuthorizedCronRequest`
   - Permite bypass de autenticación de usuario para cron jobs

## 🚀 Próximos Pasos

### 1. Desplegar los Cambios
```bash
git add .
git commit -m "fix: autenticación de cron jobs para Acuity y Shopify"
git push
```

### 2. Verificar que Funciona

Una vez desplegado, puedes probar manualmente:

```bash
# Obtén tu CRON_SECRET desde Vercel (Settings → Environment Variables)
export CRON_SECRET="tu-secret-aqui"

# Probar Acuity
curl -X GET "https://tu-dominio.vercel.app/api/cron/sync-acuity-daily?secret=$CRON_SECRET"

# Probar Shopify
curl -X GET "https://tu-dominio.vercel.app/api/cron/sync-shopify-periodic?secret=$CRON_SECRET"
```

**Respuestas esperadas:**
```json
{
  "success": true,
  "timestamp": "2026-01-10T...",
  "duration_ms": 15234,
  "results": {
    "appointments": { "success": true, "error": null },
    "availability": { "success": true, "error": null },
    "dailySnapshot": { "success": true, "error": null },
    "historicalSnapshot": { "success": true, "error": null }
  }
}
```

### 3. Monitorear el Próximo Cron Job

El próximo cron job de Acuity se ejecutará automáticamente a las **07:00 (CET)**.

Para verificar que funcionó:

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard) → tu proyecto
2. **Deployments** → Último deployment → **Functions**
3. Busca `/api/cron/sync-acuity-daily` en los logs
4. Verifica que:
   - ✅ El endpoint retorna status 200
   - ✅ Los 4 pasos se ejecutan correctamente
   - ✅ Se sincronizan registros

### 4. Verificar en Supabase

También puedes verificar directamente en Supabase:

```sql
-- Ver últimas sincronizaciones
SELECT * FROM sync_logs 
WHERE integration IN ('acuity', 'shopify')
ORDER BY created_at DESC 
LIMIT 10;

-- Ver últimas citas sincronizadas
SELECT COUNT(*), MAX(updated_at) 
FROM acuity_appointments;

-- Ver últimos snapshots
SELECT * FROM acuity_daily_snapshot 
ORDER BY date DESC 
LIMIT 5;
```

## 🎯 Resultado Esperado

Después de desplegar estos cambios:

- ✅ El cron job de Acuity funcionará correctamente todos los días a las 07:00
- ✅ El cron job de Shopify funcionará cada 4 horas (07:00, 11:00, 15:00, 19:00, 23:00)
- ✅ Los datos se sincronizarán automáticamente
- ✅ Los logs mostrarán ejecuciones exitosas
- ✅ La página de integraciones mostrará "Última sync: hace X minutos"

## 🔧 Mecanismo de Autenticación

Los endpoints de sync ahora soportan **dos métodos de autenticación**:

### 1. Autenticación de Usuario (para llamadas desde la UI)
- El usuario debe estar autenticado con Supabase
- Se verifica `supabase.auth.getUser()`

### 2. Autenticación de Cron Job (para llamadas automáticas)
- Se verifica el header `x-cron-secret`
- Debe coincidir con la variable de entorno `CRON_SECRET`
- Si coincide, se permite el acceso sin usuario autenticado

Esta arquitectura permite que:
- Los usuarios sincronicen manualmente desde la página de integraciones
- Los cron jobs sincronicen automáticamente sin intervención del usuario
- Ambos métodos están protegidos y son seguros

## 📝 Notas Importantes

1. **CRON_SECRET es crítico**: Asegúrate de que esté configurado en Vercel
2. **No compartir el secret**: Es como una contraseña, manténlo privado
3. **Logs disponibles**: Siempre puedes revisar los logs en Vercel Dashboard
4. **Rollback fácil**: Si algo falla, puedes hacer rollback en Vercel a un deployment anterior

## ✅ Checklist de Verificación

Después de desplegar, verifica:

- [ ] Los cambios están desplegados en Vercel
- [ ] `CRON_SECRET` está configurado en Environment Variables
- [ ] Los 6 cron jobs aparecen en Vercel Dashboard → Cron Jobs
- [ ] Prueba manual exitosa de ambos endpoints
- [ ] El próximo cron automático se ejecuta correctamente
- [ ] Los logs muestran sincronizaciones exitosas
- [ ] Los datos en el dashboard están actualizados

¡Con esto, tus cron jobs deberían funcionar perfectamente! 🎉
