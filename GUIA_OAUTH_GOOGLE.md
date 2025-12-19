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

