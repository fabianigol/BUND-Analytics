# Configuración del Calendario Full-Year

Este documento contiene las instrucciones para configurar el nuevo módulo de Calendario Full-Year.

## 1. Instalar Dependencias

Primero, instala las nuevas dependencias necesarias:

```bash
npm install
```

Esto instalará:
- `@radix-ui/react-popover` - Para los popovers del selector de fecha
- `@radix-ui/react-checkbox` - Para los filtros de capas
- `react-day-picker` - Para el componente de calendario de selección de fechas

## 2. Aplicar Migración de Base de Datos

Debes ejecutar la migración SQL en tu base de datos de Supabase. Hay dos formas de hacerlo:

### Opción A: Usando Supabase Dashboard

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a **SQL Editor** en el menú lateral
3. Crea una nueva query
4. Copia y pega el contenido del archivo `supabase/migration_add_calendar_events.sql`
5. Ejecuta la query

### Opción B: Usando Supabase CLI

Si tienes Supabase CLI instalado:

```bash
supabase db push supabase/migration_add_calendar_events.sql
```

## 3. Verificar la Instalación

Una vez completados los pasos anteriores:

1. Reinicia tu servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Navega a tu dashboard y busca la nueva entrada "Calendario" 📅 en el sidebar

3. Haz clic en "Calendario" para acceder a la vista full-year

## Características del Calendario

### Capas Disponibles

El calendario incluye 6 capas con sus colores distintivos:

- **Marketing** (Naranja #F97316): Eventos relacionados con campañas y estrategia de marketing
- **Operaciones** (Azul #3B82F6): Eventos operacionales y logísticos
- **PR** (Morado #A855F7): Eventos de relaciones públicas
- **Retail** (Verde #10B981): Eventos relacionados con retail y ventas
- **Producto** (Amarillo #EAB308): Eventos de desarrollo y lanzamiento de productos
- **Personal** (Gris #6B7280): Eventos personales (solo visibles para el creador)

### Funcionalidades

- ✅ Vista de año completo con 12 meses
- ✅ Navegación entre años con flechas
- ✅ Filtrado de capas con checkboxes
- ✅ Crear eventos con título, descripción, fechas, capa y enlaces
- ✅ Eventos multi-día que se extienden visualmente
- ✅ Editar y eliminar solo tus propios eventos
- ✅ Panel lateral con detalles completos del evento
- ✅ Fondo blanco con sábados y domingos en gris claro
- ✅ Eventos compartidos entre todos los usuarios (excepto capa Personal)

### Permisos

- **Crear eventos**: Todos los usuarios pueden crear eventos en cualquier capa
- **Ver eventos**: Todos los usuarios ven eventos compartidos (Marketing, Operaciones, PR, Retail, Producto) y solo sus propios eventos personales
- **Editar/Eliminar**: Solo puedes editar o eliminar eventos que tú creaste

## Uso del Calendario

### Crear un Evento

1. Haz clic en el botón flotante "+" en la esquina inferior derecha
2. Completa el formulario:
   - **Título** (requerido): Nombre del evento
   - **Descripción** (opcional): Detalles adicionales
   - **Fecha de Inicio** (requerido): Cuándo comienza el evento
   - **Fecha de Fin** (requerido): Cuándo termina el evento
   - **Capa** (requerido): Categoría del evento
   - **Enlaces** (opcional): URLs relacionadas con el evento
3. Haz clic en "Crear Evento"

### Ver Detalles de un Evento

1. Haz clic en cualquier barra de evento en el calendario
2. Se abrirá un panel lateral con todos los detalles
3. Si el evento es tuyo, verás botones para "Editar" y "Eliminar"

### Filtrar Capas

1. Usa los checkboxes en la parte superior del calendario
2. Desmarca las capas que quieras ocultar
3. El calendario se actualiza automáticamente

### Navegar entre Años

1. Usa las flechas ← → junto al año actual
2. El calendario carga automáticamente los eventos del año seleccionado

## Solución de Problemas

### Error: "No autorizado"

- Asegúrate de estar autenticado en la aplicación
- Verifica que las políticas RLS estén correctamente aplicadas en Supabase

### No se muestran eventos

- Verifica que hayas aplicado la migración correctamente
- Revisa la consola del navegador en busca de errores
- Asegúrate de que las capas estén seleccionadas en los filtros

### Error al crear evento

- Verifica que todos los campos requeridos estén completos
- Asegúrate de que la fecha de fin sea mayor o igual a la fecha de inicio

## Arquitectura Técnica

### Base de Datos

- **Tabla**: `calendar_events`
- **Enum**: `calendar_layer`
- **RLS**: Políticas de seguridad para privacidad de eventos personales

### API Routes

- `GET /api/calendar/events` - Obtener eventos
- `POST /api/calendar/events` - Crear evento
- `PUT /api/calendar/events/[id]` - Actualizar evento
- `DELETE /api/calendar/events/[id]` - Eliminar evento

### Componentes Principales

- `FullYearCalendar` - Componente contenedor principal
- `CalendarGrid` - Grid mensual individual
- `EventBar` - Visualización de evento como barra
- `CreateEventModal` - Modal para crear/editar eventos
- `EventDetailsPanel` - Panel lateral con detalles
- `LayerFilters` - Filtros de capas con checkboxes

## Próximos Pasos

Posibles mejoras futuras:

- [ ] Exportar calendario a iCal/Google Calendar
- [ ] Notificaciones de eventos próximos
- [ ] Recordatorios automáticos
- [ ] Vista de lista además de la vista de calendario
- [ ] Búsqueda de eventos
- [ ] Duplicar eventos
- [ ] Colores personalizados por evento
- [ ] Etiquetas adicionales
- [ ] Comentarios en eventos
- [ ] Adjuntar archivos (no solo enlaces)


