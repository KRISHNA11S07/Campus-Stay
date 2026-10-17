-- ============================================================
-- CampusStay — auth onboarding and location privacy
-- Run after 001–007. This migration is safe to apply to existing data.
-- ============================================================

-- Preferences are used for optional onboarding state and lifestyle matching.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

GRANT UPDATE (preferences) ON public.profiles TO authenticated;

-- An exact address is intentionally not a column on `properties`, because
-- public property reads must never include it. Public coordinates are rounded
-- to roughly 100m and can be omitted entirely with `area_only`.
CREATE TABLE IF NOT EXISTS public.property_locations (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exact_lat DOUBLE PRECISION,
  exact_lng DOUBLE PRECISION,
  private_address TEXT,
  privacy_mode TEXT NOT NULL DEFAULT 'approximate'
    CHECK (privacy_mode IN ('approximate', 'area_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_locations_owner ON public.property_locations(owner_id);
ALTER TABLE public.property_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_locations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_locations TO authenticated;

DROP POLICY IF EXISTS property_locations_select_owner ON public.property_locations;
DROP POLICY IF EXISTS property_locations_insert_owner ON public.property_locations;
DROP POLICY IF EXISTS property_locations_update_owner ON public.property_locations;
DROP POLICY IF EXISTS property_locations_delete_owner ON public.property_locations;

CREATE POLICY property_locations_select_owner ON public.property_locations
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner');

CREATE POLICY property_locations_insert_owner ON public.property_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.get_my_role() = 'owner'
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );

CREATE POLICY property_locations_update_owner ON public.property_locations
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner')
  WITH CHECK (
    owner_id = auth.uid()
    AND public.get_my_role() = 'owner'
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  );

CREATE POLICY property_locations_delete_owner ON public.property_locations
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner');

-- Preserve old coordinate precision for the owner, then make existing public
-- pins approximate. This avoids leaking historic exact locations.
INSERT INTO public.property_locations (property_id, owner_id, exact_lat, exact_lng, privacy_mode)
SELECT id, owner_id, lat, lng, 'approximate'
FROM public.properties
WHERE lat IS NOT NULL OR lng IS NOT NULL
ON CONFLICT (property_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.coarsen_public_property_coordinates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.lat IS NOT NULL THEN NEW.lat := round(NEW.lat::numeric, 3)::double precision; END IF;
  IF NEW.lng IS NOT NULL THEN NEW.lng := round(NEW.lng::numeric, 3)::double precision; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS properties_coarsen_public_coordinates ON public.properties;
CREATE TRIGGER properties_coarsen_public_coordinates
  BEFORE INSERT OR UPDATE OF lat, lng ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.coarsen_public_property_coordinates();

UPDATE public.properties
SET lat = CASE WHEN lat IS NULL THEN NULL ELSE round(lat::numeric, 3)::double precision END,
    lng = CASE WHEN lng IS NULL THEN NULL ELSE round(lng::numeric, 3)::double precision END
WHERE lat IS NOT NULL OR lng IS NOT NULL;

-- Browser clients may record a valid Indian number, but cannot mark it as
-- verified. `phone_verified` is still controlled only by auth.users triggers.
CREATE OR REPLACE FUNCTION public.set_my_unverified_phone(p_phone TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_phone !~ '^\+91[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'invalid Indian phone number';
  END IF;
  UPDATE public.profiles
  SET phone = p_phone,
      phone_verified = CASE WHEN phone = p_phone THEN phone_verified ELSE false END
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_unverified_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_unverified_phone(TEXT) TO authenticated;
