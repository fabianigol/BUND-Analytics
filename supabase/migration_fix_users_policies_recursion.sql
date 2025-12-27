-- Migration: Fix infinite recursion in users table policies
-- The problem: Policies on users table were querying user_roles directly, which can cause recursion
-- Solution: Use is_admin() function which has SECURITY DEFINER and bypasses RLS

-- =============================================
-- DROP PROBLEMATIC POLICIES ON users TABLE
-- =============================================

DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- =============================================
-- RECREATE POLICIES USING is_admin() FUNCTION
-- =============================================

-- Policy: Admins can view all users
-- Uses is_admin() which has SECURITY DEFINER and bypasses RLS
CREATE POLICY "Admins can view all users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR auth.uid() = id);

-- Policy: Admins can insert users (for user creation)
CREATE POLICY "Admins can insert users"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Policy: Admins can update all users
CREATE POLICY "Admins can update all users"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR auth.uid() = id)
  WITH CHECK (public.is_admin() OR auth.uid() = id);

-- Policy: Admins can delete users
CREATE POLICY "Admins can delete users"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- ENSURE is_admin() FUNCTION EXISTS
-- =============================================

-- Function to check if current user is an admin (uses SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

