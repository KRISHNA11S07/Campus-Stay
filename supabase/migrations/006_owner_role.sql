-- ============================================================
-- CampusStay — Migration: Owner Role Promotion
-- Allows authenticated users to self-promote from student to owner.
-- This is safe because owner is not a privileged role (not admin).
-- ============================================================

-- Function: promote_to_owner
-- Callable by any authenticated user to change their role from student to owner
CREATE OR REPLACE FUNCTION public.promote_to_owner()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'owner'
  WHERE id = auth.uid()
    AND role = 'student';  -- Only promote students, not demote admins
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.promote_to_owner() TO authenticated;

-- Also create a storage bucket for property media if it doesn't exist
-- (The bucket may already exist from manual setup)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-media', 'property-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for property-media bucket
-- Allow authenticated users to upload files to their own directory
CREATE POLICY IF NOT EXISTS "Owners can upload property media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'property-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own files
CREATE POLICY IF NOT EXISTS "Owners can update own media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'property-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
CREATE POLICY IF NOT EXISTS "Owners can delete own media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'property-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access to all property media
CREATE POLICY IF NOT EXISTS "Public can view property media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'property-media');

-- RLS policies for property management tables
-- These may already exist but we use IF NOT EXISTS to be safe

-- Properties: owners can insert their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert own properties') THEN
    CREATE POLICY "Owners can insert own properties"
    ON public.properties FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- Properties: owners can update their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update own properties') THEN
    CREATE POLICY "Owners can update own properties"
    ON public.properties FOR UPDATE TO authenticated
    USING (owner_id = auth.uid());
  END IF;
END $$;

-- Properties: owners can delete their own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can delete own properties') THEN
    CREATE POLICY "Owners can delete own properties"
    ON public.properties FOR DELETE TO authenticated
    USING (owner_id = auth.uid());
  END IF;
END $$;

-- Properties: anyone can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view properties') THEN
    CREATE POLICY "Anyone can view properties"
    ON public.properties FOR SELECT TO public
    USING (true);
  END IF;
END $$;

-- Property media: owners can manage media for their own properties
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert own property media') THEN
    CREATE POLICY "Owners can insert own property media"
    ON public.property_media FOR INSERT TO authenticated
    WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can delete own property media') THEN
    CREATE POLICY "Owners can delete own property media"
    ON public.property_media FOR DELETE TO authenticated
    USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view property media') THEN
    CREATE POLICY "Anyone can view property media"
    ON public.property_media FOR SELECT TO public
    USING (true);
  END IF;
END $$;

-- Property facilities: owners can manage for their own properties
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert own property facilities') THEN
    CREATE POLICY "Owners can insert own property facilities"
    ON public.property_facilities FOR INSERT TO authenticated
    WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can delete own property facilities') THEN
    CREATE POLICY "Owners can delete own property facilities"
    ON public.property_facilities FOR DELETE TO authenticated
    USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view property facilities') THEN
    CREATE POLICY "Anyone can view property facilities"
    ON public.property_facilities FOR SELECT TO public
    USING (true);
  END IF;
END $$;

-- Property rules: owners can manage for their own properties
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can insert own property rules') THEN
    CREATE POLICY "Owners can insert own property rules"
    ON public.property_rules FOR INSERT TO authenticated
    WITH CHECK (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can delete own property rules') THEN
    CREATE POLICY "Owners can delete own property rules"
    ON public.property_rules FOR DELETE TO authenticated
    USING (property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view property rules') THEN
    CREATE POLICY "Anyone can view property rules"
    ON public.property_rules FOR SELECT TO public
    USING (true);
  END IF;
END $$;

-- Facilities: anyone can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view facilities') THEN
    CREATE POLICY "Anyone can view facilities"
    ON public.facilities FOR SELECT TO public
    USING (true);
  END IF;
END $$;

-- Colleges: anyone can read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view colleges') THEN
    CREATE POLICY "Anyone can view colleges"
    ON public.colleges FOR SELECT TO public
    USING (true);
  END IF;
END $$;
