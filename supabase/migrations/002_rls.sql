-- ============================================================
-- CampusStay — Row Level Security and authorization
-- Run this after 001_schema.sql and before 003_seed.sql.
-- ============================================================

-- Every browser-accessible table must be protected by RLS.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- This helper intentionally reads the role from the protected profile row.
-- Roles are assigned by trusted database/server-side operations only; browser
-- metadata and browser updates must never be an authorization source.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Remove the original permissive policies so this migration is safe to rerun.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view owner names for properties" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can read colleges" ON public.colleges;
DROP POLICY IF EXISTS "Admins can manage colleges" ON public.colleges;
DROP POLICY IF EXISTS "Anyone can view verified properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can view own properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can create properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can update own properties" ON public.properties;
DROP POLICY IF EXISTS "Owners can delete own properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can manage all properties" ON public.properties;
DROP POLICY IF EXISTS "Anyone can view media of viewable properties" ON public.property_media;
DROP POLICY IF EXISTS "Owners can add media to own properties" ON public.property_media;
DROP POLICY IF EXISTS "Owners can update media on own properties" ON public.property_media;
DROP POLICY IF EXISTS "Owners can delete media from own properties" ON public.property_media;
DROP POLICY IF EXISTS "Anyone can read facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can manage facilities" ON public.facilities;
DROP POLICY IF EXISTS "Anyone can view property facilities" ON public.property_facilities;
DROP POLICY IF EXISTS "Owners can manage facilities for own properties" ON public.property_facilities;
DROP POLICY IF EXISTS "Owners can delete facilities from own properties" ON public.property_facilities;
DROP POLICY IF EXISTS "Anyone can view property rules" ON public.property_rules;
DROP POLICY IF EXISTS "Owners can manage rules for own properties" ON public.property_rules;
DROP POLICY IF EXISTS "Owners can update rules on own properties" ON public.property_rules;
DROP POLICY IF EXISTS "Owners can delete rules from own properties" ON public.property_rules;
DROP POLICY IF EXISTS "Students can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owners can view bookings for own properties" ON public.bookings;
DROP POLICY IF EXISTS "Students can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
DROP POLICY IF EXISTS "Students can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can add favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users can remove favorites" ON public.favorites;

-- Restrict ordinary browser grants first; RLS alone cannot prevent a user
-- from changing privileged profile columns when UPDATE is granted broadly.
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.colleges FROM anon, authenticated;
REVOKE ALL ON TABLE public.properties FROM anon, authenticated;
REVOKE ALL ON TABLE public.property_media FROM anon, authenticated;
REVOKE ALL ON TABLE public.facilities FROM anon, authenticated;
REVOKE ALL ON TABLE public.property_facilities FROM anon, authenticated;
REVOKE ALL ON TABLE public.property_rules FROM anon, authenticated;
REVOKE ALL ON TABLE public.bookings FROM anon, authenticated;
REVOKE ALL ON TABLE public.reviews FROM anon, authenticated;
REVOKE ALL ON TABLE public.favorites FROM anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, occupation, age, gender, avatar_url)
  ON public.profiles TO authenticated;

GRANT SELECT ON public.colleges, public.facilities TO anon, authenticated;
GRANT SELECT ON public.properties, public.property_media,
  public.property_facilities, public.property_rules, public.reviews
  TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.properties,
  public.property_media, public.property_facilities, public.property_rules
  TO authenticated;
GRANT SELECT, INSERT ON public.bookings, public.reviews TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;

-- ============================================================
-- Profiles
-- ============================================================
CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_select_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY profiles_update_own_safe_columns
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- Reference data
-- ============================================================
CREATE POLICY colleges_select_public
  ON public.colleges FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY facilities_select_public
  ON public.facilities FOR SELECT TO anon, authenticated
  USING (true);

-- ============================================================
-- Properties
-- ============================================================
CREATE POLICY properties_select_public_verified
  ON public.properties FOR SELECT TO anon, authenticated
  USING (verification_status = 'verified');

CREATE POLICY properties_select_owner
  ON public.properties FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner');

CREATE POLICY properties_select_admin
  ON public.properties FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY properties_insert_owner_pending
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.get_my_role() = 'owner'
    AND verification_status = 'pending'
  );

-- Owners can edit their own listing, including returning a verified listing
-- to pending after a substantive edit, but can never mark it verified.
CREATE POLICY properties_update_owner_unverified
  ON public.properties FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner')
  WITH CHECK (
    owner_id = auth.uid()
    AND public.get_my_role() = 'owner'
    AND verification_status IN ('pending', 'rejected')
  );

CREATE POLICY properties_delete_owner
  ON public.properties FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner');

-- An admin dashboard will use these controlled admin permissions in a later
-- milestone. No normal user can obtain the admin role through browser writes.
CREATE POLICY properties_update_admin
  ON public.properties FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY properties_delete_admin
  ON public.properties FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- Property media
-- ============================================================
CREATE POLICY property_media_select_public_verified
  ON public.property_media FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id
        AND p.verification_status = 'verified'
    )
  );

CREATE POLICY property_media_select_owner
  ON public.property_media FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_media_select_admin
  ON public.property_media FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY property_media_insert_owner
  ON public.property_media FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_media_update_owner
  ON public.property_media FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_media_delete_owner
  ON public.property_media FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Facilities and property rules
-- ============================================================
CREATE POLICY property_facilities_select_public_verified
  ON public.property_facilities FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id
        AND p.verification_status = 'verified'
    )
  );

CREATE POLICY property_facilities_select_owner
  ON public.property_facilities FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_facilities_insert_owner
  ON public.property_facilities FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_facilities_delete_owner
  ON public.property_facilities FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_rules_select_public_verified
  ON public.property_rules FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id
        AND p.verification_status = 'verified'
    )
  );

CREATE POLICY property_rules_select_owner
  ON public.property_rules FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_rules_insert_owner
  ON public.property_rules FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_rules_update_owner
  ON public.property_rules FOR UPDATE TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_rules_delete_owner
  ON public.property_rules FOR DELETE TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Booking requests (no payment gateway in this milestone)
-- ============================================================
CREATE POLICY bookings_select_student
  ON public.bookings FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND public.get_my_role() = 'student');

CREATE POLICY bookings_select_owner
  ON public.bookings FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner');

CREATE POLICY bookings_select_admin
  ON public.bookings FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- A booking is currently only a zero-amount request. Payment fields remain
-- server-controlled and are intentionally not handled here.
CREATE POLICY bookings_insert_student_request
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_my_role() = 'student'
    AND amount = 0
    AND payment_status = 'created'
    AND booking_status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id
        AND p.owner_id = owner_id
        AND p.verification_status = 'verified'
        AND p.available = true
    )
  );

-- ============================================================
-- Reviews and favorites
-- ============================================================
CREATE POLICY reviews_select_public_verified
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id
        AND p.verification_status = 'verified'
    )
  );

CREATE POLICY reviews_insert_eligible_student
  ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_my_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.bookings AS b
      JOIN public.properties AS p ON p.id = b.property_id
      WHERE b.id = booking_id
        AND b.student_id = auth.uid()
        AND b.property_id = property_id
        AND b.booking_status IN ('confirmed', 'completed')
        AND p.verification_status = 'verified'
    )
  );

CREATE POLICY favorites_select_own_student
  ON public.favorites FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND public.get_my_role() = 'student');

CREATE POLICY favorites_insert_own_student
  ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_my_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = property_id AND p.verification_status = 'verified'
    )
  );

CREATE POLICY favorites_delete_own_student
  ON public.favorites FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND public.get_my_role() = 'student');

-- ============================================================
-- Storage: private property-media bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-media', 'property-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Public read for property media" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete own media" ON storage.objects;
DROP POLICY IF EXISTS storage_media_select_public_verified ON storage.objects;
DROP POLICY IF EXISTS storage_media_select_owner ON storage.objects;
DROP POLICY IF EXISTS storage_media_select_admin ON storage.objects;
DROP POLICY IF EXISTS storage_media_insert_owner_path ON storage.objects;
DROP POLICY IF EXISTS storage_media_delete_owner_path ON storage.objects;

CREATE POLICY storage_media_select_public_verified
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'property-media'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.verification_status = 'verified'
    )
  );

CREATE POLICY storage_media_select_owner
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-media'
    AND public.get_my_role() = 'owner'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY storage_media_select_admin
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-media'
    AND public.get_my_role() = 'admin'
  );

CREATE POLICY storage_media_insert_owner_path
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-media'
    AND public.get_my_role() = 'owner'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY storage_media_delete_owner_path
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-media'
    AND public.get_my_role() = 'owner'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.owner_id = auth.uid()
    )
  );
