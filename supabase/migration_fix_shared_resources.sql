-- Migration: Fix shared resources RLS policies
-- This fixes the RLS policies that may be causing errors with other tables

-- Primero, crear una función helper para verificar si un usuario es admin
-- Esta función maneja casos donde las tablas pueden no existir o no tener datos
CREATE OR REPLACE FUNCTION public.is_user_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar si las tablas existen y si el usuario tiene rol admin
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid 
      AND r.name = 'admin'
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Si hay cualquier error (tablas no existen, etc.), retornar false
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Actualizar políticas RLS para passwords compartidos
DROP POLICY IF EXISTS "Users can view their own passwords or shared passwords" ON public.passwords;
CREATE POLICY "Users can view their own passwords or shared passwords"
  ON public.passwords
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_shared = TRUE
  );

-- Actualizar políticas RLS para prompts compartidos
DROP POLICY IF EXISTS "Users can view their own prompts or shared prompts" ON public.prompts;
CREATE POLICY "Users can view their own prompts or shared prompts"
  ON public.prompts
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR is_shared = TRUE
  );

-- Para passwords compartidos - solo admins pueden insertar
DROP POLICY IF EXISTS "Users can insert their own passwords" ON public.passwords;
CREATE POLICY "Users can insert their own passwords"
  ON public.passwords
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND 
    (is_shared = FALSE OR public.is_user_admin(auth.uid()))
  );

-- Para prompts compartidos - solo admins pueden insertar
DROP POLICY IF EXISTS "Users can insert their own prompts" ON public.prompts;
CREATE POLICY "Users can insert their own prompts"
  ON public.prompts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND 
    (is_shared = FALSE OR public.is_user_admin(auth.uid()))
  );

-- Solo admins pueden actualizar recursos compartidos
DROP POLICY IF EXISTS "Users can update their own passwords" ON public.passwords;
CREATE POLICY "Users can update their own passwords"
  ON public.passwords
  FOR UPDATE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND public.is_user_admin(auth.uid()))
  )
  WITH CHECK (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND public.is_user_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update their own prompts" ON public.prompts;
CREATE POLICY "Users can update their own prompts"
  ON public.prompts
  FOR UPDATE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND public.is_user_admin(auth.uid()))
  )
  WITH CHECK (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND public.is_user_admin(auth.uid()))
  );

-- Solo admins pueden eliminar recursos compartidos
DROP POLICY IF EXISTS "Users can delete their own passwords" ON public.passwords;
CREATE POLICY "Users can delete their own passwords"
  ON public.passwords
  FOR DELETE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND public.is_user_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete their own prompts" ON public.prompts;
CREATE POLICY "Users can delete their own prompts"
  ON public.prompts
  FOR DELETE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND public.is_user_admin(auth.uid()))
  );

