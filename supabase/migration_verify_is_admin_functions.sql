-- Migration: Verify is_admin() functions configuration
-- Run this to check if the functions are correctly set up with SECURITY DEFINER

-- =============================================
-- CHECK FUNCTION EXISTENCE AND DEFINITION
-- =============================================

-- Check if is_admin() functions exist and their security settings
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER' 
    ELSE 'SECURITY INVOKER' 
  END AS security_type,
  CASE 
    WHEN p.prosecdef THEN '✅ Correcto' 
    ELSE '❌ INCORRECTO - Debe ser SECURITY DEFINER' 
  END AS status,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'is_admin'
ORDER BY p.proname, p.pronargs;

-- =============================================
-- CHECK GRANT PERMISSIONS
-- =============================================

-- Check what permissions are granted on the functions
SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  r.rolname AS granted_to,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' 
  AND p.proname = 'is_admin'
  AND r.rolname IN ('authenticated', 'anon', 'public')
ORDER BY p.proname, p.pronargs, r.rolname;

-- =============================================
-- TEST FUNCTION EXECUTION
-- =============================================

-- Test if the function works (this will show your current admin status)
SELECT 
  auth.uid() AS current_user_id,
  public.is_admin() AS is_current_user_admin,
  CASE 
    WHEN public.is_admin() THEN '✅ Eres administrador' 
    ELSE '❌ No eres administrador' 
  END AS status;

-- If you want to test with a specific user ID (replace 'USER_ID_HERE' with actual UUID):
-- SELECT public.is_admin('USER_ID_HERE'::uuid) AS is_user_admin;

-- =============================================
-- CHECK FOR RECURSION ISSUES
-- =============================================

-- List all policies on user_roles table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_roles'
ORDER BY policyname;

-- Check if any policies on user_roles directly query user_roles (which would cause recursion)
SELECT 
  policyname,
  qual AS using_expression,
  with_check AS with_check_expression,
  CASE 
    WHEN qual::text LIKE '%user_roles%' OR with_check::text LIKE '%user_roles%' 
    THEN '⚠️ POSIBLE RECURSIÓN - Verifica esta política'
    ELSE '✅ OK'
  END AS recursion_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_roles'
  AND (
    qual::text LIKE '%user_roles%' 
    OR with_check::text LIKE '%user_roles%'
  );

