-- Migration: Fix user policies to ensure users can view and update their own profile
-- This restores the essential policies that were missing

-- =============================================
-- RESTORE ESSENTIAL USER POLICIES
-- =============================================

-- Policy: Users can view their own profile (ESSENTIAL - must exist)
-- This policy should allow users to see their own data even if they're not admin
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile (ESSENTIAL - must exist)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure the admin policies still exist (these should be in addition to the above)
-- Admins can view all users (in addition to viewing their own)
-- The admin policy and the "own profile" policy will work together

-- =============================================
-- VERIFY AND FIX USER ROLES POLICIES
-- =============================================

-- Policy: Users can view their own roles (ESSENTIAL)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================
-- ENSURE VIEW ACCESS
-- =============================================

-- Grant access to users_with_roles view for authenticated users
-- This view is used by the application to get user roles efficiently
GRANT SELECT ON public.users_with_roles TO authenticated;

-- =============================================
-- DEBUG: Check current user role
-- =============================================
-- Run this to see your current role (replace with your email):
/*
SELECT 
  u.id,
  u.email,
  u.full_name,
  uwr.role_name,
  uwr.permissions
FROM auth.users u
LEFT JOIN public.users_with_roles uwr ON u.id = uwr.id
WHERE u.email = 'tu_email@ejemplo.com';
*/

-- =============================================
-- QUICK FIX: Make yourself admin (if needed)
-- =============================================
-- Run this query separately if you need to make your user an admin:
-- Replace YOUR_USER_ID with your actual user ID from auth.users

-- First, find your user ID:
-- SELECT id, email FROM auth.users;

-- Then, assign yourself admin role (replace YOUR_USER_ID):
/*
INSERT INTO public.user_roles (user_id, role_id)
SELECT 
  'YOUR_USER_ID'::uuid,
  r.id
FROM public.roles r
WHERE r.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
*/

