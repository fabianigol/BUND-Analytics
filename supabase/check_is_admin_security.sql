-- Quick check: Verify is_admin() functions have SECURITY DEFINER
-- Copy and paste this query in Supabase SQL Editor

SELECT 
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  CASE 
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER (Correcto)' 
    ELSE '❌ SECURITY INVOKER (INCORRECTO - Causará recursión)' 
  END AS security_status,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'is_admin'
ORDER BY p.proname, p.pronargs;

