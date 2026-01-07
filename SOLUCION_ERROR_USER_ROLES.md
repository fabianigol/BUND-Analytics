# 🔧 Solución al Error de Creación de Usuarios

## ❌ Problema
Cuando intentas crear un usuario desde el dashboard, aparece el error:
```
Error al asignar el rol: new row violates row-level security policy for table "user_roles"
```

## 🎯 Causa Raíz
Las políticas de seguridad (RLS) de la tabla `user_roles` tienen un problema de **recursión**: para verificar si eres admin, consultan la misma tabla `user_roles`, lo que crea un bucle infinito y bloquea la inserción.

## ✅ Solución: Ejecutar la Migración SQL

Sigue estos pasos exactamente como se indica:

### Paso 1: Acceder al SQL Editor de Supabase

1. Ve a tu proyecto en **Supabase Dashboard**: https://supabase.com/dashboard
2. En el menú lateral izquierdo, haz clic en **"SQL Editor"**
3. Haz clic en el botón **"New query"** (o "+ New query")

### Paso 2: Copiar y Ejecutar la Migración

1. Abre el archivo que acabo de crear:
   ```
   supabase/migration_fix_user_roles_policies_final.sql
   ```

2. **Copia todo el contenido** del archivo

3. **Pega** el contenido en el editor SQL de Supabase

4. Haz clic en **"Run"** (o presiona `Ctrl/Cmd + Enter`)

5. Espera a que aparezca el mensaje **"Success. No rows returned"**

### Paso 3: Verificar que Funcionó

Al final de la migración se ejecutan dos consultas de verificación que te mostrarán:

1. **Todas las políticas activas** en la tabla `user_roles`:
   - Deberías ver 5 políticas:
     - `Users can view their own roles`
     - `Admins can view all user roles`
     - `Admins can insert user roles` ← **Esta es crítica**
     - `Admins can update user roles`
     - `Admins can delete user roles`

2. **Las funciones `is_admin()` creadas**:
   - Deberías ver 2 funciones ambas con `security_type = 'DEFINER'`

### Paso 4: Probar la Creación de Usuario

1. Vuelve a tu dashboard de BUND Analytics
2. Ve a la página de **Usuarios**
3. Intenta crear un nuevo usuario con estos datos de prueba:
   - **Email**: test@bundcompany.com
   - **Nombre**: Usuario de Prueba
   - **Contraseña**: Test1234
   - **Departamento**: Marketing
   - **Rol**: viewer

4. Si todo funciona correctamente:
   - ✅ El usuario se creará sin errores
   - ✅ Aparecerá el mensaje "Usuario creado exitosamente"
   - ✅ Verás el nuevo usuario en la lista

## 🔍 ¿Qué Hace Esta Migración?

La migración realiza 4 acciones principales:

### 1. Elimina las políticas problemáticas
Borra todas las políticas antiguas que causaban la recursión.

### 2. Crea funciones helper con SECURITY DEFINER
Crea dos funciones `is_admin()` con permisos especiales (`SECURITY DEFINER`) que pueden consultar la tabla `user_roles` sin activar las políticas RLS, **rompiendo el ciclo de recursión**.

```sql
-- Sin parámetro: verifica si el usuario actual es admin
public.is_admin() → BOOLEAN

-- Con parámetro: verifica si un usuario específico es admin  
public.is_admin(user_id) → BOOLEAN
```

### 3. Recrea las políticas usando las funciones
En lugar de consultar directamente `user_roles` en las políticas, ahora usan las funciones `is_admin()` que bypassean RLS.

### 4. Verifica que RLS está habilitado
Se asegura de que Row Level Security siga activo para proteger los datos.

## 📊 Verificación Adicional (Opcional)

Si quieres verificar manualmente que todo está bien, ejecuta esta consulta en el SQL Editor:

```sql
-- Verificar que las políticas están correctas
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Tiene USING'
    ELSE 'Sin USING'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Tiene WITH CHECK'
    ELSE 'Sin WITH CHECK'
  END as check_clause
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- Verificar que eres admin
SELECT public.is_admin() as soy_admin;
```

La última consulta debería devolver `true` si estás logueado con **fabiani@bundcompany.com**.

## 🚨 Si Aún Tienes Problemas

Si después de ejecutar la migración sigues teniendo el error, verifica:

1. **¿Ejecutaste la migración con éxito?**
   - Debe decir "Success" sin errores

2. **¿Estás logueado con una cuenta admin?**
   - Verifica ejecutando: `SELECT public.is_admin();`
   - Debe devolver `true`

3. **¿El usuario que intentas crear ya existe?**
   - Verifica en la tabla `users` o intenta con otro email

4. **¿Hay conflictos de políticas antiguas?**
   - Ejecuta el comando de verificación al final de la migración
   - Deberías ver exactamente 5 políticas, no más

## 📝 Nota Técnica

**¿Por qué SECURITY DEFINER?**

Normalmente, las consultas SQL se ejecutan con los permisos del usuario actual (INVOKER). Pero cuando una función tiene `SECURITY DEFINER`, se ejecuta con los permisos del usuario que la creó (el superusuario de Supabase), lo que le permite bypassear las políticas RLS.

Esto es seguro porque:
- La función solo hace una cosa específica (verificar si es admin)
- No expone datos sensibles
- Está protegida por `SET search_path = public` para evitar inyección de código

## ✅ Resultado Final

Después de aplicar esta migración:
- ✅ Podrás crear usuarios sin errores
- ✅ Los admins podrán asignar roles
- ✅ Las políticas RLS seguirán protegiendo los datos
- ✅ No habrá más problemas de recursión

---

**Creado**: 7 de enero de 2026  
**Problema**: Error RLS en user_roles al crear usuarios  
**Solución**: Usar SECURITY DEFINER para romper recursión

