-- Existing owner role values do not establish proof. Historical records remain intact.
CREATE TABLE public.owner_applications (
  applicant_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  full_name text NOT NULL, relationship text NOT NULL CHECK (relationship IN ('owner','manager')),
  property_address text NOT NULL, authority_evidence text NOT NULL, verified_contact text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','pending','clarification','approved','rejected','suspended')),
  revision bigint NOT NULL DEFAULT 1, submitted_at timestamptz, feedback text NOT NULL DEFAULT ''
);
ALTER TABLE public.owner_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_applications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.owner_applications TO authenticated;
CREATE POLICY applications_read ON public.owner_applications FOR SELECT TO authenticated
  USING (applicant_id=auth.uid() OR public.get_my_role()='admin');

CREATE FUNCTION public.owner_is_approved(p_owner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT FROM public.owner_applications a JOIN public.profiles p ON p.id=a.applicant_id
    WHERE a.applicant_id=p_owner AND a.status='approved' AND p.role='owner')
$$;
REVOKE ALL ON FUNCTION public.owner_is_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_is_approved(uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE WHEN p.role='owner' AND NOT public.owner_is_approved(p.id) THEN 'student' ELSE p.role END
  FROM public.profiles p WHERE p.id=auth.uid()
$$;

CREATE FUNCTION public.save_owner_application(p_name text,p_relationship text,p_address text,p_evidence text,p_submit boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE contact text; new_status text := CASE WHEN p_submit THEN 'pending' ELSE 'draft' END;
BEGIN
  IF auth.uid() IS NULL OR public.get_my_role() IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'Applicant session required' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(CASE WHEN phone_confirmed_at IS NOT NULL THEN phone END,
                  CASE WHEN email_confirmed_at IS NOT NULL THEN email END) INTO contact
    FROM auth.users WHERE id=auth.uid();
  IF p_submit AND (nullif(trim(contact),'') IS NULL OR length(trim(p_name))<2 OR length(trim(p_address))<5 OR length(trim(p_evidence))<10)
    THEN RAISE EXCEPTION 'Confirm your contact and complete the application'; END IF;
  IF length(p_name)>100 OR length(p_address)>500 OR length(p_evidence)>2000 THEN RAISE EXCEPTION 'Application too long'; END IF;
  INSERT INTO public.owner_applications AS a(applicant_id,full_name,relationship,property_address,authority_evidence,verified_contact,status,submitted_at)
    VALUES(auth.uid(),trim(p_name),p_relationship,trim(p_address),trim(p_evidence),coalesce(contact,''),new_status,CASE WHEN p_submit THEN now() END)
    ON CONFLICT(applicant_id) DO UPDATE SET full_name=excluded.full_name,relationship=excluded.relationship,
      property_address=excluded.property_address,authority_evidence=excluded.authority_evidence,verified_contact=excluded.verified_contact,
      revision=a.revision+1,status=excluded.status,submitted_at=excluded.submitted_at WHERE a.status IN ('draft','clarification','rejected');
  IF NOT FOUND THEN RAISE EXCEPTION 'Application is locked for review'; END IF;
END $$;

CREATE FUNCTION public.review_owner_application(p_applicant uuid,p_status text,p_reason text,p_revision bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior text; existing_revision bigint;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' OR auth.uid()=p_applicant THEN
    RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_reason),'') IS NULL OR length(p_reason)>1000 THEN RAISE EXCEPTION 'Provide a review note'; END IF;
  SELECT status,revision INTO STRICT prior,existing_revision FROM public.owner_applications WHERE applicant_id=p_applicant FOR UPDATE;
  IF existing_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Application changed. Review the current evidence'; END IF;
  IF NOT ((prior='pending' AND p_status IN ('approved','rejected','clarification')) OR
          (prior='approved' AND p_status='suspended') OR (prior='suspended' AND p_status='clarification'))
    THEN RAISE EXCEPTION 'Invalid review transition'; END IF;
  UPDATE public.owner_applications SET revision=revision+1,status=p_status,feedback=trim(p_reason) WHERE applicant_id=p_applicant;
  IF p_status='approved' THEN
    UPDATE public.profiles SET role='owner' WHERE id=p_applicant AND role IN ('student','owner');
    IF NOT FOUND THEN RAISE EXCEPTION 'Ineligible account'; END IF;
  ELSIF p_status='suspended' THEN
    UPDATE public.properties SET listing_status='paused' WHERE owner_id=p_applicant AND listing_status='published';
  END IF;
  INSERT INTO public.platform_audit(action,subject_id,previous_value,new_value,reason,actor_id)
    VALUES ('owner_review',p_applicant,prior,p_status,trim(p_reason),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.save_owner_application(text,text,text,text,boolean),public.review_owner_application(uuid,text,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_owner_application(text,text,text,text,boolean),public.review_owner_application(uuid,text,text,bigint) TO authenticated;

ALTER POLICY properties_select_public_verified ON public.properties USING (
  verification_status='verified' AND listing_status='published' AND available AND public.owner_is_approved(owner_id));

-- Recompute both state fields on every write, including legacy clients. Only admin
-- can publish. Owner edits must leave the row in a non-public state.
CREATE OR REPLACE FUNCTION public.sync_listing_lifecycle() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.get_my_role() IS DISTINCT FROM 'admin' THEN
    IF NEW.listing_status NOT IN ('draft','pending','paused','rented') THEN RAISE EXCEPTION 'Review required' USING ERRCODE='42501'; END IF;
    IF TG_OP='INSERT' THEN NEW.rejection_reason := NULL; ELSE NEW.rejection_reason := OLD.rejection_reason; END IF;
  END IF;
  NEW.verification_status := CASE NEW.listing_status WHEN 'published' THEN 'verified' WHEN 'rejected' THEN 'rejected' ELSE 'pending' END;
  RETURN NEW;
END $$;
DROP TRIGGER properties_sync_lifecycle ON public.properties;
CREATE TRIGGER properties_sync_lifecycle BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.sync_listing_lifecycle();

-- Only the moderation RPC may change report status as a browser administrator.
REVOKE UPDATE,INSERT ON public.reports FROM authenticated;
GRANT INSERT (reporter_id,property_id,reported_user_id,reason) ON public.reports TO authenticated;
CREATE FUNCTION public.moderate_record(p_kind text,p_id uuid,p_state text,p_reason text,p_reviewed_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE prior text; changed_at timestamptz;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_reason),'') IS NULL OR length(p_reason)>1000 THEN RAISE EXCEPTION 'Provide a decision note'; END IF;
  IF p_kind='listing' THEN
    -- Suspension also locks the application before touching its listings.
    IF p_state='published' THEN
      PERFORM 1 FROM public.owner_applications a JOIN public.properties p ON p.owner_id=a.applicant_id
        WHERE p.id=p_id AND a.status='approved' FOR SHARE OF a;
      IF NOT FOUND THEN RAISE EXCEPTION 'Verified owner required'; END IF;
    END IF;
    SELECT listing_status,updated_at INTO STRICT prior,changed_at FROM public.properties WHERE id=p_id FOR UPDATE;
    IF changed_at IS DISTINCT FROM p_reviewed_at OR p_reviewed_at IS NULL THEN RAISE EXCEPTION 'Listing changed. Review it again'; END IF;
    IF NOT ((prior='pending' AND p_state IN ('published','rejected')) OR (prior='published' AND p_state='paused')) THEN RAISE EXCEPTION 'Invalid listing transition'; END IF;
    IF p_state='published' AND NOT EXISTS(SELECT FROM public.properties WHERE id=p_id AND public.owner_is_approved(owner_id))
      THEN RAISE EXCEPTION 'Verified owner required'; END IF;
    IF p_state='published' AND (
      NOT EXISTS(SELECT FROM public.property_media m WHERE m.property_id=p_id AND m.file_type='image')
      OR EXISTS(SELECT FROM public.property_media m JOIN public.properties p ON p.id=m.property_id
        WHERE m.property_id=p_id AND (m.file_url IS DISTINCT FROM '' OR NOT EXISTS(
          SELECT FROM storage.objects o WHERE o.bucket_id='property-media' AND o.name=m.storage_path
          AND (storage.foldername(o.name))[1]=p.owner_id::text AND (storage.foldername(o.name))[2]=p.id::text
          AND (m.file_type='image' AND o.metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp')
            OR m.file_type='video' AND o.metadata->>'mimetype'='video/mp4'))))
    ) THEN RAISE EXCEPTION 'Review requires uploaded listing media. Request corrections'; END IF;
    UPDATE public.properties SET listing_status=p_state,rejection_reason=CASE WHEN p_state='published' THEN NULL ELSE trim(p_reason) END WHERE id=p_id;
  ELSIF p_kind='report' THEN
    SELECT status,updated_at INTO STRICT prior,changed_at FROM public.reports WHERE id=p_id FOR UPDATE;
    IF changed_at IS DISTINCT FROM p_reviewed_at OR p_reviewed_at IS NULL THEN RAISE EXCEPTION 'Report changed. Review it again'; END IF;
    UPDATE public.reports SET status=p_state WHERE id=p_id;
  ELSE RAISE EXCEPTION 'Unknown subject'; END IF;
  INSERT INTO public.platform_audit(action,subject_id,previous_value,new_value,reason,actor_id)
    VALUES(p_kind,p_id,prior,p_state,trim(p_reason),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.moderate_record(text,uuid,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.moderate_record(text,uuid,text,text,timestamptz) TO authenticated;
DROP POLICY properties_update_admin ON public.properties;
DROP POLICY properties_update_admin_lifecycle ON public.properties;
DROP POLICY properties_delete_admin ON public.properties;
DROP POLICY properties_delete_admin_lifecycle ON public.properties;

-- Keep approved content stable while it is public. Lock the parent so an edit
-- cannot race the moderator's publication of the same listing.
CREATE FUNCTION public.check_listing_child_edit() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE parent uuid; lifecycle text;
BEGIN
  IF TG_OP='DELETE' THEN parent := OLD.property_id; ELSE parent := NEW.property_id; END IF;
  IF TG_OP='UPDATE' AND NEW.property_id<>OLD.property_id THEN RAISE EXCEPTION 'Property association is immutable'; END IF;
  IF current_user='authenticated' THEN
    SELECT listing_status INTO lifecycle FROM public.properties WHERE id=parent FOR SHARE;
    IF lifecycle IS NULL OR lifecycle NOT IN ('draft','rejected','paused') THEN
      RAISE EXCEPTION 'Take the listing out of publication before editing' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER media_edit BEFORE INSERT OR UPDATE OR DELETE ON public.property_media FOR EACH ROW EXECUTE FUNCTION public.check_listing_child_edit();
CREATE TRIGGER facilities_edit BEFORE INSERT OR UPDATE OR DELETE ON public.property_facilities FOR EACH ROW EXECUTE FUNCTION public.check_listing_child_edit();
CREATE TRIGGER rules_edit BEFORE INSERT OR UPDATE OR DELETE ON public.property_rules FOR EACH ROW EXECUTE FUNCTION public.check_listing_child_edit();
CREATE POLICY storage_listing_edit ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (
  bucket_id <> 'property-media' OR EXISTS (SELECT FROM public.properties p WHERE p.id::text=(storage.foldername(name))[2] AND p.listing_status IN ('draft','paused','rejected')));
CREATE POLICY storage_listing_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  bucket_id <> 'property-media' OR EXISTS (SELECT FROM public.properties p WHERE p.id::text=(storage.foldername(name))[2] AND p.listing_status IN ('draft','paused','rejected')));

-- A new public contact snapshot must not change the verified Auth phone.
CREATE OR REPLACE FUNCTION public.set_my_owner_contact(p_phone text,p_whatsapp text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'owner' OR p_phone IS NULL OR p_phone !~ '^[+]91[6-9][0-9]{9}$'
    OR p_whatsapp IS NULL OR p_whatsapp !~ '^[+]91[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Invalid owner contact'; END IF;
  UPDATE public.profiles SET whatsapp=p_whatsapp WHERE id=auth.uid();
END $$;

-- Account deletion is a reviewed request. The browser may only create its own.
CREATE TABLE public.account_deletion_requests (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT(user_id) ON public.account_deletion_requests TO authenticated;
CREATE POLICY deletion_request_own ON public.account_deletion_requests FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
CREATE POLICY deletion_request_read ON public.account_deletion_requests FOR SELECT TO authenticated
  USING(user_id=auth.uid() OR public.get_my_role()='admin');

-- Existing bookings with a mismatched owner must not expose the student to
-- that owner. The historic rows are preserved for independent reconciliation.
ALTER POLICY bookings_select_owner ON public.bookings USING (
  owner_id=auth.uid() AND public.get_my_role()='owner' AND EXISTS(
    SELECT FROM public.properties p WHERE p.id=bookings.property_id AND p.owner_id=bookings.owner_id));
