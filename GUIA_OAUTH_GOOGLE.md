# Guía: Configurar OAuth de Google Analytics

## Problema: "Access blocked" - App en modo prueba

Cuando ves el error "Access blocked: MARKETING HUB has not completed the Google verification process", significa que tu aplicación OAuth está en **modo de prueba** y solo usuarios autorizados pueden acceder.

## Solución Rápida: Agregar Usuarios de Prueba

### Paso 1: Ir a Google Cloud Console
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto (mkth-hub)

### Paso 2: Configurar Usuarios de Prueba
1. Ve a **APIs y servicios** → **Pantalla de consentimiento de OAuth**
2. En la sección **"Usuarios de prueba"**, haz clic en **"+ Agregar usuarios"**
3. Agrega los emails que usarás para autorizar:
   - `hola@bundcompany.com`
   - Cualquier otro email que vaya a usar la aplicación
4. Haz clic en **"Guardar"**

### Paso 3: Esperar y Probar
- Espera 2-5 minutos para que los cambios se propaguen
- Intenta conectar Google Analytics de nuevo
- Deberías poder autorizar sin problemas

## Solución Permanente: Publicar la Aplicación

Si quieres que cualquier usuario pueda usar la aplicación sin estar en la lista de prueba:

### Requisitos para Publicar:
1. **Política de Privacidad** (URL pública)
2. **Términos de Servicio** (URL pública)
3. **Información de la aplicación completa**
4. **Scopes justificados** (por qué necesitas cada permiso)

### Pasos:
1. Ve a **Pantalla de consentimiento de OAuth**
2. Completa todos los campos requeridos:
   - Nombre de la aplicación
   - Email de soporte
   - Dominios autorizados
   - URLs de política de privacidad y términos
3. Haz clic en **"Publicar aplicación"**
4. Google revisará tu solicitud (puede tardar días o semanas)

## Configuración Recomendada para Desarrollo

### Tipo de Usuario:
- **Externo**: Si quieres que usuarios fuera de tu organización puedan usar la app
- **Interno**: Solo para usuarios de tu organización (requiere Google Workspace)

### Scopes Necesarios:
- `https://www.googleapis.com/auth/analytics.readonly` - Para leer datos de Analytics
- `https://www.googleapis.com/auth/webmasters.readonly` - Para leer datos de Search Console (NUEVO)

## Habilitar API de Search Console

Para que la funcionalidad de consultas de búsqueda funcione, **solo necesitas habilitar la API**. Los scopes ya están configurados en el código y se solicitarán automáticamente.

### Paso 1: Habilitar la API de Search Console
1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto (ej: `mkth-hub`)
3. En el menú lateral izquierdo, ve a **APIs y servicios** → **Biblioteca**
4. En el buscador, escribe: **"Search Console API"** o **"Google Search Console API"**
5. Haz clic en el resultado
6. Haz clic en el botón azul **"Habilitar"**
7. Espera unos segundos hasta que aparezca el mensaje de confirmación

### Paso 2: Verificar que la API esté habilitada
1. Ve a **APIs y servicios** → **APIs habilitadas** (o **Enabled APIs**)
2. Busca en la lista y deberías ver:
   - ✅ **Analytics Data API** (si ya la tenías antes)
   - ✅ **Google Search Console API** (nueva - debe aparecer después del paso anterior)

### Paso 3: Configurar Scopes en Google Auth Platform

En la nueva interfaz de Google Auth Platform, los scopes se pueden configurar de dos formas:

#### Opción A: A través de "Acceso a los datos" (Recomendado)
1. En Google Cloud Console, ve a **Google Auth Platform** → **Acceso a los datos**
2. Aquí puedes ver/agregar los scopes que tu aplicación necesita
3. Si no ves esta opción o no puedes editarla, no te preocupes - el código ya está configurado para solicitarlos automáticamente

#### Opción B: Automático (Ya configurado)
✅ **Buenas noticias**: El código de tu aplicación **ya está configurado** para solicitar ambos scopes automáticamente cuando el usuario autoriza:
- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/webmasters.readonly`

Esto significa que **no necesitas configurar los scopes manualmente**. Se solicitarán automáticamente cuando reconectes.

### Paso 4: Reconectar Google Analytics
⚠️ **IMPORTANTE**: Después de habilitar la API y agregar el scope, necesitas:
1. Desconectar Google Analytics desde la página de Integraciones (si ya estaba conectado)
2. Volver a conectar Google Analytics
3. Durante la autorización, Google te pedirá permiso para ambos servicios (Analytics y Search Console)
4. Acepta ambos permisos

### Verificación
Una vez completados los pasos, deberías poder:
- ✅ Ver datos de Analytics como antes
- ✅ Ver la nueva sección "Consultas que llevan a tu sitio" en la página de Analytics
- ✅ Ver datos actualizados de Search Console cuando cambies el filtro de fechas

### Redirect URIs Configurados:
- Desarrollo: `http://localhost:3000/api/integrations/analytics/callback`
- Producción: `https://tu-dominio.com/api/integrations/analytics/callback`

## Notas Importantes

⚠️ **Modo de Prueba:**
- Máximo 100 usuarios de prueba
- Los tokens expiran después de 7 días
- Ideal para desarrollo y testing

✅ **Aplicación Publicada:**
- Sin límite de usuarios
- Tokens no expiran (si tienes refresh token)
- Requiere verificación de Google

## Troubleshooting

### Si sigues viendo el error después de agregar usuarios:
1. Verifica que el email esté correctamente escrito
2. Espera 5-10 minutos
3. Cierra sesión y vuelve a iniciar sesión en Google
4. Verifica que estés usando el mismo email que agregaste

### Si necesitas agregar más usuarios:
- Puedes agregar hasta 100 usuarios de prueba
- Cada usuario debe autorizar individualmente

