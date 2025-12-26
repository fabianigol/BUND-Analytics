# Configuración de Sincronización Automática Diaria

Este documento explica cómo configurar la sincronización automática diaria de Acuity usando Vercel Cron Jobs.

## ✅ ¿Es seguro y fiable?

**Sí, es completamente seguro y fiable** cuando se configura correctamente:

1. **Seguridad**: Usa un secret compartido entre Vercel y tu aplicación
2. **Fiable**: Vercel Cron Jobs tiene 99.9% de uptime
3. **Automático**: Se ejecuta sin necesidad de abrir la web
4. **Monitoreo**: Los logs están disponibles en Vercel Dashboard

## 📋 Requisitos Previos

1. **Proyecto desplegado en Vercel**
2. **Variable de entorno `CRON_SECRET` configurada** (ver más abajo)

## 🔧 Configuración Paso a Paso

### Paso 1: Configurar Variable de Entorno

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Ve a **Settings** → **Environment Variables**
3. Agrega una nueva variable:
   - **Name**: `CRON_SECRET`
   - **Value**: Genera un string aleatorio seguro (ej: `openssl rand -hex 32`)
   - **Environment**: Production (y Preview si quieres probarlo)
4. Guarda los cambios

### Paso 2: Verificar vercel.json

El archivo `vercel.json` ya está configurado con:
- **Ruta**: `/api/cron/sync-acuity-daily`
- **Horario**: `0 6 * * *` (6:00 AM UTC = 7:00 AM CET / 8:00 AM CEST diariamente)

**Nota sobre zonas horarias:**
- **CET (invierno, UTC+1)**: 6:00 AM UTC = 7:00 AM CET ✅
- **CEST (verano, UTC+2)**: 6:00 AM UTC = 8:00 AM CEST

Si necesitas cambiar la hora, modifica el `schedule` en formato cron:
- `0 6 * * *` = 6:00 AM UTC (7:00 AM CET en invierno)
- `0 5 * * *` = 5:00 AM UTC (6:00 AM CET / 7:00 AM CEST en verano)
- `0 0 * * *` = Medianoche UTC diariamente

### Paso 3: Desplegar

1. Haz commit y push de los cambios:
   ```bash
   git add .
   git commit -m "Add automatic daily sync cron job"
   git push
   ```

2. Vercel desplegará automáticamente

3. Verifica que el cron job esté activo en **Vercel Dashboard** → **Cron Jobs**

## 🔍 Verificación

### Verificar que funciona:

1. **Logs en Vercel**:
   - Ve a **Deployments** → Selecciona el último deployment
   - Ve a **Functions** → Busca `/api/cron/sync-acuity-daily`
   - Revisa los logs después de la primera ejecución

2. **Verificar en la base de datos**:
   - Revisa `sync_logs` para ver las sincronizaciones
   - Revisa `acuity_availability_history` para ver los snapshots diarios

### Probar manualmente (sin esperar al cron):

Puedes probar el endpoint manualmente desde tu terminal:

```bash
# Reemplaza YOUR_SECRET con el valor de CRON_SECRET
curl -X GET "https://tu-dominio.vercel.app/api/cron/sync-acuity-daily?secret=YOUR_SECRET"
```

O desde el navegador (solo para pruebas):
```
https://tu-dominio.vercel.app/api/cron/sync-acuity-daily?secret=YOUR_SECRET
```

## 📊 ¿Qué hace el cron job?

El cron job ejecuta automáticamente (en este orden):

1. **Sincronizar Citas** (`/api/sync/acuity`)
   - Obtiene todas las citas desde Acuity
   - Actualiza `acuity_appointments`

2. **Sincronizar Disponibilidad** (`/api/sync/acuity/availability`)
   - Obtiene slots disponibles desde Acuity (próximos 21 días)
   - Calcula `booked_slots` desde las citas
   - Actualiza `acuity_availability` y `acuity_availability_by_store`

3. **Crear Snapshot Diario** (`/api/sync/acuity/availability/snapshot`)
   - Crea un snapshot del día anterior
   - Guarda en `acuity_availability_history` con `period_type: 'daily'`

## ⚠️ Manejo de Errores

El cron job está diseñado para ser resiliente:

- Si un paso falla, continúa con los siguientes
- Los errores se registran en los logs de Vercel
- El endpoint retorna un código `207 Multi-Status` si algunos pasos fallaron
- Puedes revisar qué pasos fallaron en la respuesta JSON

## 🔐 Seguridad

- **Secret compartido**: Solo Vercel conoce el secret y lo envía automáticamente
- **No requiere autenticación de usuario**: El secret es suficiente
- **No accesible públicamente**: Sin el secret, el endpoint retorna 401
- **Logs seguros**: Los secrets no aparecen en los logs

## 🕐 Zona Horaria

**Importante**: El horario está en UTC. El cron está configurado para ejecutarse a las **7:00 AM CET**:

- **Horario actual**: `0 6 * * *` (6:00 AM UTC)
- **CET (invierno, UTC+1)**: 6:00 AM UTC = **7:00 AM CET** ✅
- **CEST (verano, UTC+2)**: 6:00 AM UTC = **8:00 AM CEST**

Si quieres ajustar el horario:
- Para mantener 7:00 AM todo el año: usa `0 5 * * *` (será 6:00 AM CET en invierno, 7:00 AM CEST en verano)
- Para mantener 8:00 AM todo el año: usa `0 6 * * *` (será 7:00 AM CET en invierno, 8:00 AM CEST en verano) ← **Configuración actual**

## 📝 Notas

- El cron job se ejecuta **una vez al día** automáticamente
- No necesitas abrir la web ni hacer nada manualmente
- Los datos se actualizan automáticamente cada día
- Los snapshots históricos se guardan para análisis futuro

## 🆘 Troubleshooting

### El cron no se ejecuta:
1. Verifica que `CRON_SECRET` esté configurado en Vercel
2. Verifica que `vercel.json` esté en la raíz del proyecto
3. Revisa los logs en Vercel Dashboard

### Errores de autenticación:
1. Verifica que el `CRON_SECRET` en Vercel coincida con el código
2. Asegúrate de que la variable esté en el environment correcto (Production)

### Errores de sincronización:
1. Verifica que Acuity esté conectado en la configuración
2. Revisa los logs detallados en Vercel
3. Verifica que las credenciales de Acuity sean válidas

