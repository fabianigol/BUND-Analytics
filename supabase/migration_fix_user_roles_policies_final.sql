-- =============================================
-- SOLUCIÓN DEFINITIVA: Arreglar políticas RLS de user_roles
-- =============================================
-- Este script resuelve el problema de recursión en las políticas RLS
-- de la tabla user_roles que impide crear nuevos usuarios
--
-- PROBLEMA: Las políticas verifican si el usuario es admin consultando
-- la tabla user_roles, lo que crea una recursión infinita.
--
-- SOLUCIÓN: Usar funciones con SECURITY DEFINER que bypasean RLS
-- =============================================

-- =============================================
-- PASO 1: ELIMINAR POLÍTICAS PROBLEMÁTICAS
-- =============================================

-- Eliminar TODAS las políticas existentes en user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

-- =============================================
-- PASO 2: CREAR FUNCIONES HELPER CON SECURITY DEFINER
-- =============================================

-- Función para verificar si el usuario actual es admin (sin parámetros)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY DEFINER permite que esta función bypasee RLS
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() 
    AND r.name = 'admin'
  );
END;
$$;

-- Función para verificar si un usuario específico es admin (con parámetro)
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_id_param 
    AND r.name = 'admin'
  );
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- =============================================
-- PASO 3: RECREAR POLÍTICAS USANDO is_admin()
-- =============================================

-- Política: Los usuarios pueden ver sus propios roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Política: Los administradores pueden ver todos los roles
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Política: Los administradores pueden insertar roles (CRÍTICO)
CREATE POLICY "Admins can insert user roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Política: Los administradores pueden actualizar roles
CREATE POLICY "Admins can update user roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Política: Los administradores pueden eliminar roles
CREATE POLICY "Admins can delete user roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- PASO 4: VERIFICAR QUE RLS ESTÁ HABILITADO
-- =============================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- VERIFICACIÓN FINAL
-- =============================================

-- Mostrar todas las políticas activas en user_roles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_roles'
ORDER BY policyname;

-- Mostrar las funciones is_admin creadas
SELECT 
  routine_name,
  routine_type,
  security_type,
  specific_name
FROM information_schema.routines
WHERE routine_name = 'is_admin'
AND routine_schema = 'public';

COMMENT ON FUNCTION public.is_admin() IS 
'Verifica si el usuario actual (auth.uid()) tiene rol de admin. 
Usa SECURITY DEFINER para bypassear RLS y evitar recursión.';

COMMENT ON FUNCTION public.is_admin(UUID) IS 
'Verifica si un usuario específico tiene rol de admin. 
Usa SECURITY DEFINER para bypassear RLS y evitar recursión.';

