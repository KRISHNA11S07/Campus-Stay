-- Apply after 011 in one transaction, after checking live policy and ACL drift.

DROP FUNCTION IF EXISTS public.promote_to_admin(text);

DROP FUNCTION IF EXISTS public.promote_to_owner();

ALTER TABLE public.properties ALTER COLUMN available_for SET DEFAULT 'anyone';

REVOKE ALL ON public.inquiries FROM PUBLIC, anon, authenticated;

REVOKE INSERT (id,property_id,student_id,owner_id,message,status,created_at,updated_at), UPDATE (id,property_id,student_id,owner_id,message,status,created_at,updated_at) ON public.inquiries FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT (property_id,student_id,owner_id,message), UPDATE (status) ON public.inquiries TO authenticated;

ALTER POLICY bookings_insert_student_request ON public.bookings TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_my_role() = 'student'
    AND amount = 0
    AND payment_status = 'created'
    AND booking_status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.properties AS p
      WHERE p.id = bookings.property_id
        AND p.owner_id = bookings.owner_id
        AND p.verification_status = 'verified'
        AND p.available = true
    )
  );

ALTER POLICY reviews_insert_eligible_student ON public.reviews TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_my_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.bookings AS b
      JOIN public.properties AS p ON p.id = b.property_id
      WHERE b.id = reviews.booking_id
        AND b.student_id = auth.uid()
        AND b.property_id = reviews.property_id
        AND b.owner_id = p.owner_id
        AND b.booking_status IN ('confirmed', 'completed')
        AND p.verification_status = 'verified'
    )
  );

ALTER POLICY inquiries_select_owner ON public.inquiries TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner'
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = inquiries.property_id AND p.owner_id = inquiries.owner_id));

ALTER POLICY inquiries_update_owner ON public.inquiries TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner'
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = inquiries.property_id AND p.owner_id = inquiries.owner_id))
  WITH CHECK (owner_id = auth.uid() AND public.get_my_role() = 'owner'
    AND EXISTS (SELECT 1 FROM public.properties p WHERE p.id = inquiries.property_id AND p.owner_id = inquiries.owner_id));

ALTER POLICY inquiries_insert_student ON public.inquiries TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_my_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = inquiries.property_id AND p.owner_id = inquiries.owner_id
        AND p.verification_status = 'verified'
    )
  );

CREATE TABLE public.platform_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL, subject_id uuid NOT NULL, previous_value text, new_value text,
  reason text, actor_id uuid, database_actor name NOT NULL DEFAULT session_user,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.platform_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.platform_audit TO authenticated;
CREATE POLICY audit_admin_read ON public.platform_audit FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE FUNCTION public.audit_role_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.platform_audit(action,subject_id,previous_value,new_value,actor_id)
    VALUES ('role', NEW.id, OLD.role, NEW.role, auth.uid());
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_role_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_audit_role AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role) EXECUTE FUNCTION public.audit_role_change();

-- Public reviews expose text and ratings. Student and booking identifiers
-- are needed by the insert policy, but do not belong in public responses.
REVOKE SELECT ON public.reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT (id,property_id,rating,review_text,created_at) ON public.reviews TO anon,authenticated;
-- Analytics counts use property and time only. View attribution is server-checked.
REVOKE SELECT,INSERT ON public.property_views FROM PUBLIC,anon,authenticated;
GRANT SELECT (property_id,viewed_at), INSERT (property_id,viewer_id) ON public.property_views TO authenticated;
ALTER POLICY property_views_insert_public ON public.property_views TO authenticated WITH CHECK (
  (viewer_id IS NULL OR viewer_id=auth.uid()) AND EXISTS (
    SELECT FROM public.properties p WHERE p.id=property_views.property_id AND p.verification_status='verified'));

-- Only Auth-confirmed numbers reserve a unique verified identity.
DROP FUNCTION IF EXISTS public.set_my_unverified_phone(text);
CREATE UNIQUE INDEX profiles_verified_phone_unique ON public.profiles(phone) WHERE phone_verified IS TRUE;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_phone_key;

-- Keep historical reviews, including duplicate ratings. One future rating per booking.
CREATE TABLE public.reviewed_bookings (booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE);
ALTER TABLE public.reviewed_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reviewed_bookings FROM PUBLIC,anon,authenticated;
INSERT INTO public.reviewed_bookings SELECT DISTINCT booking_id FROM public.reviews WHERE booking_id IS NOT NULL;
CREATE FUNCTION public.record_reviewed_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.booking_id IS NOT NULL THEN INSERT INTO public.reviewed_bookings VALUES (NEW.booking_id); END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_reviewed_booking() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reviews_once_per_booking AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.record_reviewed_booking();

REVOKE INSERT ON public.bookings,public.reviews FROM PUBLIC,anon,authenticated;
GRANT INSERT (student_id,property_id,owner_id,amount) ON public.bookings TO authenticated;
GRANT INSERT (student_id,property_id,booking_id,rating,review_text) ON public.reviews TO authenticated;
