-- Check ALL policies that might query user_roles directly (causing recursion)
-- This will show if any policies on other tables are also causing issues

-- =============================================
-- CHECK POLICIES ON users TABLE
-- =============================================
SELECT 
  'users' AS table_name,
  policyname,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression,
  CASE 
    WHEN qual::text LIKE '%user_roles%' OR with_check::text LIKE '%user_roles%' 
    THEN '⚠️ POSIBLE RECURSIÓN - Consulta user_roles directamente'
    WHEN qual::text LIKE '%is_admin%' OR with_check::text LIKE '%is_admin%'
    THEN '✅ Usa is_admin() - Correcto'
    ELSE 'ℹ️ No relacionado con roles'
  END AS recursion_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

-- =============================================
-- CHECK POLICIES ON user_roles TABLE
-- =============================================
SELECT 
  'user_roles' AS table_name,
  policyname,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression,
  CASE 
    WHEN qual::text LIKE '%user_roles%' OR with_check::text LIKE '%user_roles%' 
    THEN '⚠️ POSIBLE RECURSIÓN - Consulta user_roles directamente'
    WHEN qual::text LIKE '%is_admin%' OR with_check::text LIKE '%is_admin%'
    THEN '✅ Usa is_admin() - Correcto'
    ELSE 'ℹ️ No relacionado con admin check'
  END AS recursion_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'user_roles'
ORDER BY policyname;

-- =============================================
-- CHECK POLICIES ON ALL TABLES (summary)
-- =============================================
SELECT 
  tablename,
  COUNT(*) AS total_policies,
  COUNT(CASE WHEN qual::text LIKE '%user_roles%' OR with_check::text LIKE '%user_roles%' THEN 1 END) AS policies_with_direct_user_roles_query,
  COUNT(CASE WHEN qual::text LIKE '%is_admin%' OR with_check::text LIKE '%is_admin%' THEN 1 END) AS policies_using_is_admin
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

