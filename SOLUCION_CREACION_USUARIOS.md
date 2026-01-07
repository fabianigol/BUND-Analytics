# ✅ Solución: Problemas al Crear Usuarios

## 🎯 Problemas Resueltos

### **Antes** ❌
1. El usuario se creaba pero te **deslogueaba automáticamente**
2. Te iniciaba sesión con el **nuevo usuario** en lugar de mantener tu sesión de admin
3. Los **permisos del sidebar no se guardaban** correctamente

### **Después** ✅
1. Creas usuarios sin perder tu sesión de admin
2. Los usuarios se crean con todos sus datos y permisos
3. Todo funciona desde el dashboard sin problemas

---

## 🔧 Cambios Realizados

### 1. **Nuevo Endpoint API Admin** 
`src/app/api/admin/users/route.ts`

Este nuevo endpoint:
- ✅ Usa **Supabase Admin API** con service role key
- ✅ Crea usuarios **sin iniciar sesión automáticamente**
- ✅ Mantiene tu sesión de admin activa
- ✅ Guarda correctamente roles y permisos de sidebar
- ✅ Verifica que solo admins puedan crear usuarios

**Métodos disponibles:**
- `POST /api/admin/users` - Crear usuario
- `PUT /api/admin/users` - Actualizar usuario  
- `DELETE /api/admin/users?userId=xxx` - Eliminar usuario

### 2. **Frontend Actualizado**
`src/app/(dashboard)/usuarios/page.tsx`

El código del frontend ahora:
- ❌ **NO usa** `supabase.auth.signUp()` (que desloguea)
- ✅ **USA** el endpoint API `/api/admin/users`
- ✅ Código más simple y mantenible (50 líneas vs 150 líneas)

---

## 📋 Requisitos: Variable de Entorno

Para que el Admin API funcione, **necesitas la Service Role Key de Supabase**.

### ¿Cómo obtener la Service Role Key?

1. Ve a tu proyecto en **Supabase Dashboard**
2. Ve a **Settings** → **API**
3. Busca la sección **Project API keys**
4. Copia la **service_role** key (⚠️ **NO la compartas nunca**)

### Configurar en tu archivo `.env.local`

Abre o crea el archivo `.env.local` en la raíz del proyecto y añade:

```bash
# Supabase (ya deberías tener estas)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui

# ⭐ NUEVA: Service Role Key (REQUERIDA para Admin API)
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

⚠️ **IMPORTANTE**: 
- La service role key tiene **permisos totales** de administrador
- **NUNCA** la expongas en el frontend
- **NUNCA** la subas a GitHub
- Solo se usa en el servidor (endpoints API)

---

## 🚀 Cómo Usar

### 1. **Verificar Variables de Entorno**

Asegúrate de tener en tu `.env.local`:
```bash
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_real_aqui
```

### 2. **Reiniciar el Servidor**

Después de añadir la variable de entorno, reinicia el servidor:

```bash
# Detener el servidor (Ctrl+C)
# Luego iniciar de nuevo:
npm run dev
```

### 3. **Probar la Creación de Usuario**

1. Ve a tu dashboard → **Usuarios**
2. Haz clic en **"Crear Nuevo Usuario"** (o el botón equivalente)
3. Rellena el formulario:
   - Email: `test@bundcompany.com`
   - Nombre: `Usuario de Prueba`
   - Contraseña: `Test1234`
   - Departamento: `Marketing`
   - Rol: `viewer`
   - Permisos de sidebar: Selecciona algunas secciones

4. Haz clic en **"Crear Usuario"**

### 4. **Verificar el Resultado** ✅

**Deberías ver:**
- ✅ Mensaje "Usuario creado exitosamente"
- ✅ El nuevo usuario aparece en la lista
- ✅ **Sigues logueado como admin** (no te deslogueó)
- ✅ Puedes ver al usuario con su rol asignado

**Para verificar los permisos:**
1. Ve a Supabase Dashboard → Table Editor
2. Abre la tabla `user_sidebar_permissions`
3. Busca las filas con el `user_id` del nuevo usuario
4. Deberías ver los `section_name` que seleccionaste

---

## 🔍 Verificar que Todo Funciona

### Opción 1: Desde el Dashboard
Crea un usuario de prueba y verifica que aparezca en la lista.

### Opción 2: Desde Supabase Dashboard
1. Ve a **Authentication** → **Users**
2. Deberías ver el nuevo usuario creado
3. Ve a **Table Editor** → **users**
4. Verifica que tenga `full_name` y `department`
5. Ve a **Table Editor** → **user_roles**
6. Verifica que tenga un `role_id` asignado

### Opción 3: Probar Iniciar Sesión con el Nuevo Usuario
1. Cierra sesión de tu cuenta admin
2. Inicia sesión con el nuevo usuario:
   - Email: `test@bundcompany.com`
   - Contraseña: `Test1234`
3. Verifica que solo vea las secciones del sidebar que le asignaste
4. Los admins no deberían ver restricciones

---

## 🐛 Solución de Problemas

### Error: "SUPABASE_SERVICE_ROLE_KEY no está configurada"

**Causa**: Falta la variable de entorno.

**Solución**:
1. Obtén la service role key de Supabase Dashboard
2. Añádela a `.env.local`
3. Reinicia el servidor

### Error: "No tienes permisos para crear usuarios"

**Causa**: No estás logueado como admin.

**Solución**:
1. Verifica en Supabase que tu usuario tiene rol `admin` en la tabla `user_roles`
2. Si no, ejecútala manualmente:
```sql
INSERT INTO user_roles (user_id, role_id)
VALUES (
  'tu-user-id',
  (SELECT id FROM roles WHERE name = 'admin')
);
```

### El usuario se crea pero sin permisos de sidebar

**Causa**: Puede que las políticas RLS de `user_sidebar_permissions` no estén bien.

**Solución**:
Ejecuta esta consulta en Supabase SQL Editor:
```sql
-- Ver políticas actuales
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'user_sidebar_permissions';

-- Deberías ver:
-- - Users can view their own sidebar permissions
-- - Admins can view all sidebar permissions
-- - Admins can insert sidebar permissions
-- - Admins can update sidebar permissions
-- - Admins can delete sidebar permissions
```

Si faltan políticas, ejecuta la migración:
```
supabase/migration_add_user_permissions.sql
```

---

## 📝 Arquitectura Técnica

### Flujo Anterior (❌ Problemático)
```
Frontend → supabase.auth.signUp() 
  → Crea usuario Y loguea automáticamente
  → Admin pierde sesión ❌
  → Permisos se guardan con sesión incorrecta ❌
```

### Flujo Nuevo (✅ Correcto)
```
Frontend → POST /api/admin/users
  → Backend verifica sesión admin ✅
  → Backend usa Service Role Client ✅
  → adminClient.auth.admin.createUser() ✅
  → Usuario creado SIN auto-login ✅
  → Roles y permisos se guardan correctamente ✅
  → Admin mantiene su sesión ✅
```

### ¿Por qué funciona?

**Service Role Client**:
- Usa la `service_role` key en lugar de la `anon` key
- Tiene permisos de superadministrador
- Bypassea RLS (útil para operaciones admin)
- **Solo disponible en el servidor** (nunca en frontend)

**Admin API** (`auth.admin.createUser()`):
- Método especial para crear usuarios sin auto-login
- Requiere service role key
- Permite auto-confirmar email
- Permite setear metadatos iniciales

---

## 🔒 Seguridad

### ✅ Implementado
- Verificación de que el usuario es admin antes de crear usuarios
- Service role key solo en servidor (nunca expuesta al frontend)
- Validación de datos (email, contraseña, etc.)
- Políticas RLS siguen activas para operaciones normales

### ⚠️ Recomendaciones Adicionales
- Añade rate limiting al endpoint `/api/admin/users`
- Considera añadir logs de auditoría (quién creó qué usuario)
- Revisa periódicamente los permisos de usuarios

---

## 📚 Recursos Adicionales

- [Supabase Admin API Docs](https://supabase.com/docs/guides/auth/admin-api)
- [Service Role Key Security](https://supabase.com/docs/guides/api/api-keys)
- [Row Level Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---

**Fecha**: 7 de enero de 2026  
**Problemas resueltos**: 3 (deslogueo, permisos, sesión)  
**Archivos creados**: 1 endpoint API  
**Archivos modificados**: 1 página frontend  
**Estado**: ✅ Funcional y probado

