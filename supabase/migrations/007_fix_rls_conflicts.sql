-- ============================================================
-- CampusStay — Fix RLS Policy Conflicts
-- Run this AFTER 002_rls.sql and 006_owner_role.sql
--
-- PROBLEM:
-- Migration 006_owner_role.sql creates overly-permissive "Anyone can view"
-- SELECT policies that bypass the verification_status restriction established
-- in 002_rls.sql. This allows anonymous/unauthenticated users to read
-- pending and rejected properties, their media, facilities, and rules.
--
-- SOLUTION:
-- Remove the permissive policies introduced by 006_owner_role.sql. PostgreSQL
-- combines permissive policies with OR, so leaving its broad mutation or
-- storage policies in place would bypass the stricter ownership checks in
-- 002_rls.sql. The self-service promote_to_owner() function remains.
--
-- This migration is idempotent — safe to run multiple times.
-- ============================================================

-- Step 1: Remove policies created by 006. pg_policies is a read-only system
-- view, so these must be DROP POLICY statements rather than DELETEs.
DROP POLICY IF EXISTS "Owners can upload property media" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view property media" ON storage.objects;

DROP POLICY IF EXISTS "Owners can insert own properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can delete own properties" ON public.properties;
DROP POLICY IF EXISTS "Anyone can view properties" ON public.properties;

DROP POLICY IF EXISTS "Owners can insert own property media" ON public.property_media;
DROP POLICY IF EXISTS "Owners can delete own property media" ON public.property_media;
DROP POLICY IF EXISTS "Anyone can view property media" ON public.property_media;

DROP POLICY IF EXISTS "Owners can insert own property facilities" ON public.property_facilities;
DROP POLICY IF EXISTS "Owners can delete own property facilities" ON public.property_facilities;
DROP POLICY IF EXISTS "Anyone can view property facilities" ON public.property_facilities;

DROP POLICY IF EXISTS "Owners can insert own property rules" ON public.property_rules;
DROP POLICY IF EXISTS "Owners can delete own property rules" ON public.property_rules;
DROP POLICY IF EXISTS "Anyone can view property rules" ON public.property_rules;

-- The broad reference-data SELECT policies are harmless, but removing them
-- keeps 002_rls.sql as the single source of policy truth.
DROP POLICY IF EXISTS "Anyone can view facilities" ON public.facilities;
DROP POLICY IF EXISTS "Anyone can view colleges" ON public.colleges;

-- Step 2: Ensure restrictive SELECT policies exist for each table
-- These are the authoritative policies from 002_rls.sql.
-- Use DO $$ blocks so this is idempotent (no error if already exists).

-- properties: public can only see verified; owners can see their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'properties_select_public_verified'
      AND tablename = 'properties'
  ) THEN
    CREATE POLICY properties_select_public_verified
      ON public.properties FOR SELECT TO anon, authenticated
      USING (verification_status = 'verified');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'properties_select_owner'
      AND tablename = 'properties'
  ) THEN
    CREATE POLICY properties_select_owner
      ON public.properties FOR SELECT TO authenticated
      USING (owner_id = auth.uid() AND public.get_my_role() = 'owner');
  END IF;
END $$;

-- property_media: public can only see media for verified properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'property_media_select_public_verified'
      AND tablename = 'property_media'
  ) THEN
    CREATE POLICY property_media_select_public_verified
      ON public.property_media FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.properties AS p
          WHERE p.id = property_id
            AND p.verification_status = 'verified'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'property_media_select_owner'
      AND tablename = 'property_media'
  ) THEN
    CREATE POLICY property_media_select_owner
      ON public.property_media FOR SELECT TO authenticated
      USING (
        public.get_my_role() = 'owner'
        AND EXISTS (
          SELECT 1 FROM public.properties AS p
          WHERE p.id = property_id AND p.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- property_facilities: public can only see facilities for verified properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'property_facilities_select_public_verified'
      AND tablename = 'property_facilities'
  ) THEN
    CREATE POLICY property_facilities_select_public_verified
      ON public.property_facilities FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.properties AS p
          WHERE p.id = property_id
            AND p.verification_status = 'verified'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'property_facilities_select_owner'
      AND tablename = 'property_facilities'
  ) THEN
    CREATE POLICY property_facilities_select_owner
      ON public.property_facilities FOR SELECT TO authenticated
      USING (
        public.get_my_role() = 'owner'
        AND EXISTS (
          SELECT 1 FROM public.properties AS p
          WHERE p.id = property_id AND p.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- property_rules: public can only see rules for verified properties
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'property_rules_select_public_verified'
      AND tablename = 'property_rules'
  ) THEN
    CREATE POLICY property_rules_select_public_verified
      ON public.property_rules FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.properties AS p
          WHERE p.id = property_id
            AND p.verification_status = 'verified'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'property_rules_select_owner'
      AND tablename = 'property_rules'
  ) THEN
    CREATE POLICY property_rules_select_owner
      ON public.property_rules FOR SELECT TO authenticated
      USING (
        public.get_my_role() = 'owner'
        AND EXISTS (
          SELECT 1 FROM public.properties AS p
          WHERE p.id = property_id AND p.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Step 3: Verify the result
-- This returns a summary of current policies (for manual verification)
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles::text AS applicable_roles,
  qual::text AS using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'property_media', 'property_facilities', 'property_rules')
ORDER BY tablename, cmd, policyname;
