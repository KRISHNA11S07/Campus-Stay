-- ============================================================
-- CampusStay — Listing lifecycle and multi-step wizard fields
-- Run after 001–010. Safe to apply to existing data.
-- ============================================================

-- Listing lifecycle status replaces the old verification_status values with
-- a richer state machine. Existing verified/rejected/pending rows are mapped
-- to the new lifecycle so Student search continues to work.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (listing_status IN ('draft', 'pending', 'published', 'rejected', 'paused', 'rented'));

-- Backfill lifecycle from existing verification_status values.
UPDATE public.properties
SET listing_status = CASE
  WHEN verification_status = 'verified'  THEN 'published'
  WHEN verification_status = 'rejected'  THEN 'rejected'
  ELSE 'pending'
END
WHERE listing_status = 'pending';

-- Multi-step wizard fields
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_type TEXT,
  ADD COLUMN IF NOT EXISTS available_for TEXT DEFAULT 'any'
    CHECK (available_for IN ('boys', 'girls', 'family', 'anyone')),
  ADD COLUMN IF NOT EXISTS total_rooms INTEGER,
  ADD COLUMN IF NOT EXISTS available_beds INTEGER,
  ADD COLUMN IF NOT EXISTS available_units INTEGER,
  ADD COLUMN IF NOT EXISTS maintenance_charges NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS electricity_charges NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rented_at TIMESTAMPTZ;

-- Keep verification_status in sync with listing_status for backward compat.
CREATE OR REPLACE FUNCTION public.sync_listing_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.listing_status = CASE
    WHEN NEW.listing_status IS NULL THEN 'pending'
    ELSE NEW.listing_status
  END;
  NEW.verification_status = CASE
    WHEN NEW.listing_status = 'published' THEN 'verified'
    WHEN NEW.listing_status = 'rejected'  THEN 'rejected'
    ELSE 'pending'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_sync_lifecycle ON public.properties;
CREATE TRIGGER properties_sync_lifecycle
  BEFORE INSERT OR UPDATE OF listing_status ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.sync_listing_lifecycle();

-- Admin role: only the database can grant admin. No browser write can.
CREATE OR REPLACE FUNCTION public.promote_to_admin(p_admin_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_admin_password <> current_setting('app.admin_bootstrap_password', true) THEN
    RAISE EXCEPTION 'admin bootstrap password required';
  END IF;
  UPDATE public.profiles
  SET role = 'admin'
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.promote_to_admin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(TEXT) TO authenticated;

-- Admin policies for properties (admin can manage all listings)
CREATE POLICY properties_select_admin_lifecycle
  ON public.properties FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY properties_update_admin_lifecycle
  ON public.properties FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

CREATE POLICY properties_delete_admin_lifecycle
  ON public.properties FOR DELETE TO authenticated
  USING (public.get_my_role() = 'admin');

-- Admin policies for inquiries
CREATE POLICY inquiries_select_admin_lifecycle
  ON public.inquiries FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY inquiries_update_admin_lifecycle
  ON public.inquiries FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Admin policies for reports
CREATE POLICY reports_select_admin_lifecycle
  ON public.reports FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY reports_update_admin_lifecycle
  ON public.reports FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Admin policies for property views
CREATE POLICY property_views_select_admin_lifecycle
  ON public.property_views FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- Admin policies for profiles
CREATE POLICY profiles_select_admin_lifecycle
  ON public.profiles FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- Admin can update any profile role (for moderation)
CREATE POLICY profiles_update_admin_lifecycle
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');
