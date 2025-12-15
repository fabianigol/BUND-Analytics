# 🚀 Guía Paso a Paso: Despliegue en Vercel

Esta guía te ayudará a desplegar tu aplicación Next.js en Vercel de forma profesional.

---

## 📋 Requisitos Previos

- ✅ Cuenta en GitHub (con tu repositorio subido)
- ✅ Cuenta en Vercel (gratuita)
- ✅ Todas las variables de entorno configuradas localmente

---

## PASO 1: Conectar el Repositorio de GitHub a Vercel

### 1.1. Acceder a Vercel Dashboard

1. Ve a [vercel.com](https://vercel.com)
2. Inicia sesión con tu cuenta (puedes usar GitHub para autenticarte)
3. Si es tu primera vez, verás el dashboard principal

### 1.2. Importar Proyecto

1. En el dashboard de Vercel, haz clic en el botón **"Add New..."** o **"New Project"**
2. Selecciona **"Import Git Repository"**
3. Si no has conectado GitHub antes:
   - Haz clic en **"Connect Git Provider"**
   - Selecciona **"GitHub"**
   - Autoriza a Vercel para acceder a tus repositorios
   - Puedes dar acceso a todos los repositorios o solo a repositorios específicos

### 1.3. Seleccionar el Repositorio

1. Busca tu repositorio en la lista (ej: `bund-dashboard` o el nombre que le hayas dado)
2. Haz clic en **"Import"** junto a tu repositorio

### 1.4. Configurar el Proyecto

1. **Project Name**: Vercel detectará automáticamente el nombre, puedes cambiarlo si quieres
2. **Root Directory**: 
   - Si tu proyecto está en la raíz del repo, déjalo vacío
   - Si está en una subcarpeta (como `bund-dashboard`), escribe: `bund-dashboard`
3. **Framework Preset**: Vercel detectará automáticamente "Next.js" ✅
4. **Build Command**: Debería ser `npm run build` (automático)
5. **Output Directory**: `.next` (automático para Next.js)
6. **Install Command**: `npm install` (automático)

⚠️ **IMPORTANTE**: No hagas clic en "Deploy" todavía. Primero necesitas configurar las variables de entorno.

---

## PASO 2: Configurar Variables de Entorno en Vercel Dashboard

### 2.1. Acceder a la Configuración de Variables

1. En la página de configuración del proyecto (antes de hacer deploy)
2. Busca la sección **"Environment Variables"** o **"Variables de Entorno"**
3. Haz clic para expandirla

### 2.2. Agregar Variables de Entorno

Necesitas agregar todas las variables que están en tu archivo `env.example`. Aquí está la lista completa:

#### 🔐 Supabase (OBLIGATORIAS)
```
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
SUPABASE_SERVICE_ROLE_KEY=tu_clave_de_servicio
```

#### 📅 Calendly (Opcional - si usas Calendly)
```
CALENDLY_API_KEY=tu_calendly_api_key
CALENDLY_WEBHOOK_SECRET=tu_webhook_secret
```

#### 🛒 Shopify (Opcional - si usas Shopify)
```
SHOPIFY_SHOP_DOMAIN=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=tu_token_de_acceso
SHOPIFY_API_VERSION=2024-01
```

#### 📱 Meta/Facebook (Opcional - si usas Meta Ads)
```
META_ACCESS_TOKEN=tu_meta_access_token
META_AD_ACCOUNT_ID=act_tu_ad_account_id
META_APP_SECRET=tu_meta_app_secret
```

#### 📊 Google Analytics (Opcional - si usas GA)
```
GOOGLE_ANALYTICS_PROPERTY_ID=tu_ga4_property_id
GOOGLE_APPLICATION_CREDENTIALS=contenido_del_json_como_string
```

#### 📋 Airtable (Opcional - si usas Airtable)
```
AIRTABLE_API_KEY=tu_airtable_api_key
AIRTABLE_BASE_ID=tu_airtable_base_id
```

#### 🌐 App URL (OBLIGATORIA)
```
NEXT_PUBLIC_APP_URL=https://tu-proyecto.vercel.app
```

### 2.3. Cómo Agregar Cada Variable

Para cada variable:

1. Haz clic en **"Add"** o **"Add Variable"**
2. En **"Key"**: Escribe el nombre de la variable (ej: `NEXT_PUBLIC_SUPABASE_URL`)
3. En **"Value"**: Pega el valor de tu variable de entorno local
4. Selecciona los **entornos** donde se usará:
   - ✅ **Production** (obligatorio)
   - ✅ **Preview** (recomendado para testing)
   - ✅ **Development** (opcional, solo si usas Vercel para desarrollo)
5. Haz clic en **"Save"**

### 2.4. Variables Especiales

#### Para `GOOGLE_APPLICATION_CREDENTIALS`:
Si normalmente es un archivo JSON, tienes dos opciones:
- **Opción 1**: Convertir el JSON a string y pegarlo como variable
- **Opción 2**: Usar las variables individuales de Google Cloud si tu código lo soporta

#### Para `NEXT_PUBLIC_APP_URL`:
- Primero déjala como `https://tu-proyecto.vercel.app` (Vercel te dará la URL después del primer deploy)
- Después del primer deploy, actualiza esta variable con la URL real que Vercel te asigne

### 2.5. Verificar Variables

Antes de continuar, verifica que hayas agregado:
- ✅ Todas las variables de Supabase (obligatorias)
- ✅ `NEXT_PUBLIC_APP_URL` (obligatoria)
- ✅ Las variables de las integraciones que realmente uses

---

## PASO 3: Deploy Automático

### 3.1. Realizar el Primer Deploy

1. Una vez configuradas todas las variables de entorno
2. Haz clic en el botón **"Deploy"** en la parte inferior de la página
3. Vercel comenzará a:
   - Instalar dependencias (`npm install`)
   - Compilar el proyecto (`npm run build`)
   - Desplegar la aplicación

### 3.2. Monitorear el Proceso

1. Verás un log en tiempo real del proceso de build
2. Si hay errores, aparecerán en rojo
3. El proceso típicamente toma 1-3 minutos

### 3.3. Verificar el Deploy

1. Cuando termine, verás un mensaje de éxito ✅
2. Vercel te dará una URL como: `https://tu-proyecto.vercel.app`
3. Haz clic en **"Visit"** para ver tu aplicación en vivo

### 3.4. Actualizar NEXT_PUBLIC_APP_URL

1. Ve a **Settings** → **Environment Variables**
2. Busca `NEXT_PUBLIC_APP_URL`
3. Actualízala con la URL real que Vercel te asignó
4. Haz un nuevo deploy (o espera al siguiente automático)

---

## 🔄 Deploy Automático (Configuración Continua)

### ¿Cómo Funciona el Deploy Automático?

Una vez conectado tu repositorio, Vercel automáticamente:

1. **Detecta cambios en GitHub**: Cada vez que hagas `git push` a la rama principal
2. **Crea un nuevo deploy**: Automáticamente inicia el proceso
3. **Ejecuta el build**: Compila tu aplicación con las últimas variables de entorno
4. **Despliega**: Publica la nueva versión en producción

### Configurar Ramas

1. Ve a **Settings** → **Git**
2. Aquí puedes configurar:
   - **Production Branch**: La rama que se despliega en producción (normalmente `main` o `master`)
   - **Preview Deployments**: Cada pull request crea un preview automático
   - **Ignored Build Step**: Condiciones para saltarse el build

### Pull Requests y Previews

- Cada Pull Request en GitHub crea automáticamente un **preview deployment**
- Obtienes una URL única para cada PR (ej: `tu-proyecto-git-nombre-rama.vercel.app`)
- Perfecto para testing antes de mergear a producción

---

## ✅ Checklist Final

Antes de considerar el despliegue completo, verifica:

- [ ] Repositorio conectado a Vercel
- [ ] Todas las variables de entorno configuradas
- [ ] Primer deploy exitoso
- [ ] La aplicación carga correctamente en la URL de Vercel
- [ ] Las integraciones funcionan (Supabase, etc.)
- [ ] `NEXT_PUBLIC_APP_URL` actualizada con la URL real
- [ ] Deploy automático funcionando (haz un pequeño cambio y verifica que se despliega)

---

## 🐛 Solución de Problemas Comunes

### Error: "Build Failed"
- Verifica que todas las variables de entorno estén configuradas
- Revisa los logs de build para ver el error específico
- Asegúrate de que `package.json` tenga el script `build`

### Error: "Environment Variable Missing"
- Ve a Settings → Environment Variables
- Verifica que todas las variables necesarias estén agregadas
- Asegúrate de que estén marcadas para "Production"

### La aplicación no carga
- Verifica que el build haya sido exitoso
- Revisa los logs de runtime en Vercel Dashboard
- Comprueba que las URLs de las APIs estén correctas

### Variables no se actualizan
- Después de cambiar variables de entorno, necesitas hacer un nuevo deploy
- Ve a Deployments → selecciona el último → "Redeploy"

---

## 📚 Recursos Adicionales

- [Documentación oficial de Vercel](https://vercel.com/docs)
- [Guía de Next.js en Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Variables de entorno en Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

---

¡Listo! Tu aplicación debería estar desplegada y funcionando en Vercel. 🎉
