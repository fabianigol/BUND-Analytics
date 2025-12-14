# BUND Analytics

Dashboard de marketing y analytics para el equipo de BUND. Integra datos de Calendly, Shopify, Meta Ads y Google Analytics 4 en una interfaz unificada.

## Stack Tecnológico

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Estilos**: Tailwind CSS + Shadcn/ui
- **Gráficos**: Recharts
- **Backend**: Next.js API Routes
- **Base de datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth con Row Level Security

## Características

- Dashboard principal con métricas clave (KPIs)
- Módulo de Citas (Calendly) - gestión y análisis de citas
- Módulo de Ventas (Shopify) - pedidos, ingresos, productos top
- Módulo de Paid Media (Meta Ads) - campañas, ROAS, CPA
- Módulo de Analytics (GA4) - tráfico, usuarios, fuentes
- Sistema de reportes e inferencias
- Gestión de usuarios con roles (Admin, Marketing Manager, Viewer)
- Tema claro/oscuro
- Diseño responsive

## Requisitos

- Node.js 18+
- npm o yarn
- Cuenta de Supabase
- APIs configuradas (Calendly, Shopify, Meta, Google Analytics)

## Instalación

### 1. Clonar e instalar dependencias

```bash
cd bund-dashboard
npm install
```

### 2. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve al SQL Editor y ejecuta el contenido de `supabase/schema.sql`
3. Copia las credenciales del proyecto

### 3. Variables de entorno

Copia el archivo de ejemplo y configura tus credenciales:

```bash
cp env.example .env.local
```

Edita `.env.local` con tus valores:

```env
# Supabase (Obligatorio)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Calendly
CALENDLY_API_KEY=tu_calendly_api_key

# Shopify
SHOPIFY_SHOP_DOMAIN=tu-tienda.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx

# Meta Marketing API
META_ACCESS_TOKEN=tu_meta_access_token
META_AD_ACCOUNT_ID=act_123456789

# Google Analytics 4
GOOGLE_ANALYTICS_PROPERTY_ID=123456789
```

### 4. Crear usuario inicial

En Supabase Dashboard → Authentication → Users → Add User

Para asignar rol de administrador, ejecuta en SQL Editor:

```sql
UPDATE public.user_roles 
SET role_id = (SELECT id FROM public.roles WHERE name = 'admin')
WHERE user_id = 'UUID_DEL_USUARIO';
```

### 5. Ejecutar en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Estructura del Proyecto

```
bund-dashboard/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Páginas de autenticación
│   │   │   └── login/
│   │   ├── (dashboard)/      # Páginas del dashboard
│   │   │   ├── page.tsx      # Dashboard principal
│   │   │   ├── citas/        # Módulo Calendly
│   │   │   ├── ventas/       # Módulo Shopify
│   │   │   ├── ads/          # Módulo Meta Ads
│   │   │   ├── analytics/    # Módulo GA4
│   │   │   ├── reportes/     # Informes
│   │   │   ├── usuarios/     # Gestión de usuarios
│   │   │   ├── integraciones/ # Config. de APIs
│   │   │   └── settings/     # Configuración
│   │   └── api/
│   │       ├── sync/         # Endpoints de sincronización
│   │       └── reports/      # Generación de informes
│   ├── components/
│   │   ├── ui/               # Componentes Shadcn
│   │   └── dashboard/        # Componentes del dashboard
│   ├── lib/
│   │   ├── supabase/         # Cliente Supabase
│   │   ├── integrations/     # Servicios de API
│   │   └── utils/            # Utilidades
│   └── types/                # Tipos TypeScript
└── supabase/
    └── schema.sql            # Esquema de BD
```

## Configuración de APIs

### Calendly

1. Ve a [Calendly Developer Portal](https://developer.calendly.com/)
2. Crea un Personal Access Token
3. Añade el token a `CALENDLY_API_KEY`

### Shopify

1. En Shopify Admin → Apps → Develop apps
2. Crea una app privada con los scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
3. Copia el Access Token y dominio

### Meta Marketing API

1. Ve a [Meta for Developers](https://developers.facebook.com/)
2. Crea una app de tipo Business
3. Añade el producto Marketing API
4. Genera un access token con permisos:
   - `ads_read`
   - `ads_management`
5. Copia el Ad Account ID (act_xxxxx)

### Google Analytics 4

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto y activa Analytics Data API
3. Crea una Service Account
4. Descarga el JSON de credenciales
5. En GA4, añade la service account como viewer

## Sincronización de Datos

Los datos se sincronizan mediante endpoints API:

```bash
# Sincronizar Calendly
POST /api/sync/calendly

# Sincronizar Shopify
POST /api/sync/shopify

# Sincronizar Meta
POST /api/sync/meta

# Sincronizar Analytics
POST /api/sync/analytics
```

Puedes automatizar con cron jobs o usar el botón "Sincronizar" en el dashboard.

## Roles y Permisos

| Rol | Dashboard | Reportes | Exportar | Usuarios | Integraciones |
|-----|-----------|----------|----------|----------|---------------|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Marketing Manager | ✅ | ✅ | ✅ | ❌ | ❌ |
| Viewer | ✅ | ✅ | ❌ | ❌ | ❌ |

## Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Añade las variables de entorno
3. Deploy

```bash
npm run build
```

### Otras plataformas

El proyecto es compatible con cualquier plataforma que soporte Next.js 14+.

## Desarrollo

```bash
# Desarrollo
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Licencia

Proyecto privado de BUND Company.
