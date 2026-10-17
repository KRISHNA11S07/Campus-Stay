-- CampusStay — listing details and owner contact
-- Run after 008_auth_onboarding_privacy.sql.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS available_from DATE,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(5,2) CHECK (distance_km >= 0),
  ADD COLUMN IF NOT EXISTS room_bed_count INTEGER CHECK (room_bed_count > 0),
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_phone TEXT,
  ADD COLUMN IF NOT EXISTS owner_whatsapp TEXT;

CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_available_from ON public.properties(available_from);

-- Contact values are validated and written only for the signed-in owner. The
-- public listing stores a deliberate contact snapshot so students never need
-- SELECT access to another person's private profile row.
CREATE OR REPLACE FUNCTION public.set_my_owner_contact(p_phone TEXT, p_whatsapp TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_phone !~ '^\\+91[6-9][0-9]{9}$' OR p_whatsapp !~ '^\\+91[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'invalid owner contact number';
  END IF;
  IF public.get_my_role() <> 'owner' THEN
    RAISE EXCEPTION 'owner role required';
  END IF;
  UPDATE public.profiles
  SET phone = p_phone, whatsapp = p_whatsapp
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_owner_contact(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_owner_contact(TEXT, TEXT) TO authenticated;
