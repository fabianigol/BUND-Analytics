-- Migration: Diagnostic and fix for empty error objects
-- This will help identify and fix any RLS policy issues

-- =============================================
-- DIAGNOSTIC: List all policies on users table
-- =============================================

-- View all policies on users table
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
WHERE tablename = 'users'
ORDER BY cmd, policyname;

-- =============================================
-- FIX: Ensure all user policies have correct roles
-- =============================================

-- Drop and recreate "Users can view their own profile" with authenticated role
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Drop and recreate "Users can update their own profile" with authenticated role and WITH CHECK
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- VERIFY: Test query as authenticated user
-- =============================================
-- Note: This query can only be run in the context of an authenticated user
-- To test, run this in the Supabase SQL Editor while logged in:

/*
SELECT 
  id,
  email,
  full_name,
  avatar_url,
  department,
  created_at
FROM public.users
WHERE id = auth.uid();
*/

