-- Migration: Add shared/global resources support for passwords and prompts
-- Run this in your Supabase SQL Editor

-- Añadir campo is_shared a la tabla passwords
ALTER TABLE public.passwords 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;

-- Añadir campo is_shared a la tabla prompts
ALTER TABLE public.prompts 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE;

-- Actualizar políticas RLS para passwords compartidos
DROP POLICY IF EXISTS "Users can view their own passwords" ON public.passwords;
CREATE POLICY "Users can view their own passwords or shared passwords"
  ON public.passwords
  FOR SELECT
  USING (auth.uid() = user_id OR is_shared = TRUE);

-- Actualizar políticas RLS para prompts compartidos
DROP POLICY IF EXISTS "Users can view their own prompts" ON public.prompts;
CREATE POLICY "Users can view their own prompts or shared prompts"
  ON public.prompts
  FOR SELECT
  USING (auth.uid() = user_id OR is_shared = TRUE);

-- Política para que solo administradores puedan crear recursos compartidos
-- Primero necesitamos verificar si el usuario es admin
-- Esto asume que tienes una tabla de roles o un campo is_admin en users

-- Para passwords compartidos - solo admins pueden insertar
DROP POLICY IF EXISTS "Users can insert their own passwords" ON public.passwords;
CREATE POLICY "Users can insert their own passwords"
  ON public.passwords
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND 
    (is_shared = FALSE OR 
     EXISTS (
       SELECT 1 FROM public.user_roles ur
       JOIN public.roles r ON ur.role_id = r.id
       WHERE ur.user_id = auth.uid() AND r.name = 'admin'
     ))
  );

-- Para prompts compartidos - solo admins pueden insertar
DROP POLICY IF EXISTS "Users can insert their own prompts" ON public.prompts;
CREATE POLICY "Users can insert their own prompts"
  ON public.prompts
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND 
    (is_shared = FALSE OR 
     EXISTS (
       SELECT 1 FROM public.user_roles ur
       JOIN public.roles r ON ur.role_id = r.id
       WHERE ur.user_id = auth.uid() AND r.name = 'admin'
     ))
  );

-- Solo admins pueden actualizar recursos compartidos
DROP POLICY IF EXISTS "Users can update their own passwords" ON public.passwords;
CREATE POLICY "Users can update their own passwords"
  ON public.passwords
  FOR UPDATE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ))
  )
  WITH CHECK (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ))
  );

DROP POLICY IF EXISTS "Users can update their own prompts" ON public.prompts;
CREATE POLICY "Users can update their own prompts"
  ON public.prompts
  FOR UPDATE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ))
  )
  WITH CHECK (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ))
  );

-- Solo admins pueden eliminar recursos compartidos
DROP POLICY IF EXISTS "Users can delete their own passwords" ON public.passwords;
CREATE POLICY "Users can delete their own passwords"
  ON public.passwords
  FOR DELETE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ))
  );

DROP POLICY IF EXISTS "Users can delete their own prompts" ON public.prompts;
CREATE POLICY "Users can delete their own prompts"
  ON public.prompts
  FOR DELETE
  USING (
    (auth.uid() = user_id AND is_shared = FALSE) OR
    (is_shared = TRUE AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ))
  );

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_passwords_is_shared ON public.passwords(is_shared);
CREATE INDEX IF NOT EXISTS idx_prompts_is_shared ON public.prompts(is_shared);

