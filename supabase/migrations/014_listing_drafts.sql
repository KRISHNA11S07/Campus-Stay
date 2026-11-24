-- Older entry forms used both monthly and annual rent. Leave ambiguous rows unlabeled.
ALTER TABLE public.properties ADD COLUMN rent_period text CHECK (rent_period IN ('month','year'));
CREATE TABLE public.listing_drafts (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.profiles(id),
  payload jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz
);
ALTER TABLE public.listing_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.listing_drafts TO authenticated;
CREATE POLICY draft_owner_read ON public.listing_drafts FOR SELECT TO authenticated
USING(owner_id=auth.uid() AND public.get_my_role()='owner');

CREATE FUNCTION public.save_listing_draft(p_id uuid,p_revision integer,p_payload jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE next_revision integer;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Verified owner required' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR length(p_payload::text)>64000 THEN RAISE EXCEPTION 'Invalid draft'; END IF;
  -- A lost response may cause the same client to send the identical save again.
  SELECT revision INTO next_revision FROM public.listing_drafts
    WHERE id=p_id AND owner_id=auth.uid() AND submitted_at IS NULL
      AND revision=p_revision+1 AND payload=p_payload FOR UPDATE;
  IF FOUND THEN RETURN next_revision; END IF;
  IF p_revision=0 THEN
    IF EXISTS (SELECT FROM public.properties WHERE id=p_id) THEN RAISE EXCEPTION 'Listing ID already in use'; END IF;
    INSERT INTO public.listing_drafts(id,owner_id,payload) VALUES(p_id,auth.uid(),p_payload) RETURNING revision INTO next_revision;
  ELSE
    UPDATE public.listing_drafts SET payload=p_payload,revision=revision+1,updated_at=now()
    WHERE id=p_id AND owner_id=auth.uid() AND revision=p_revision AND submitted_at IS NULL RETURNING revision INTO next_revision;
  END IF;
  IF next_revision IS NULL THEN RAISE EXCEPTION 'Draft has changed. Reload before editing'; END IF;
  RETURN next_revision;
END $$;
CREATE POLICY draft_photo_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id='property-media' AND (storage.foldername(name))[1]=auth.uid()::text AND
  EXISTS(SELECT FROM public.listing_drafts d WHERE d.id::text=(storage.foldername(name))[2] AND submitted_at IS NULL));
-- Earlier restrictive guard must permit a draft which does not yet have a property row.
ALTER POLICY storage_listing_upload ON storage.objects WITH CHECK (
  bucket_id <> 'property-media' OR EXISTS(SELECT FROM public.listing_drafts d WHERE d.id::text=(storage.foldername(name))[2] AND submitted_at IS NULL)
  OR EXISTS (SELECT FROM public.properties p WHERE p.id::text=(storage.foldername(name))[2] AND p.listing_status IN ('draft','paused','rejected')));
CREATE POLICY draft_photo_read ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id='property-media' AND (storage.foldername(name))[1]=auth.uid()::text AND
  EXISTS(SELECT FROM public.listing_drafts d WHERE d.id::text=(storage.foldername(name))[2] AND submitted_at IS NULL));
ALTER POLICY storage_media_select_public_verified ON storage.objects USING (
  bucket_id='property-media' AND EXISTS(SELECT FROM public.properties p JOIN public.property_media m ON m.property_id=p.id
    WHERE p.id::text=(storage.foldername(name))[2] AND p.owner_id::text=(storage.foldername(name))[1]
    AND m.storage_path=objects.name AND p.verification_status='verified'));

CREATE FUNCTION public.submit_listing_draft(p_id uuid,p_revision integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.listing_drafts; f jsonb; photo jsonb; ordinal integer:=0;
  lat_value float8; lng_value float8; privacy text; phone text; whatsapp text;
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Verified owner required' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT d FROM public.listing_drafts WHERE id=p_id AND owner_id=auth.uid() FOR UPDATE;
  IF d.submitted_at IS NOT NULL THEN RETURN p_id; END IF;
  IF d.revision<>p_revision OR p_revision IS NULL THEN RAISE EXCEPTION 'Reload the current draft'; END IF;
  f:=d.payload->'fields'; privacy:=coalesce(d.payload->>'privacy','area_only');
  lat_value:=nullif(f->>'property-lat','')::float8; lng_value:=nullif(f->>'property-lng','')::float8;
  IF f->>'contact-mode'='public' THEN
    phone:='+91'||(f->>'owner-phone');
    whatsapp:=coalesce('+91'||nullif(f->>'owner-whatsapp',''),phone);
    IF coalesce(phone,'') !~ '^[+]91[6-9][0-9]{9}$' OR whatsapp !~ '^[+]91[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Invalid listing contact'; END IF;
  END IF;
  IF coalesce((f->>'property-rent')::integer,0)<500 OR coalesce(length(trim(f->>'property-title')),0)<4 OR coalesce(length(trim(f->>'property-description')),0)<20
    OR coalesce(length(trim(f->>'property-area')),0)<2 OR f->>'property-college' IS DISTINCT FROM 'kit'
    OR (lat_value IS NULL) <> (lng_value IS NULL)
    OR lat_value NOT BETWEEN -90 AND 90 OR lng_value NOT BETWEEN -180 AND 180
    OR jsonb_typeof(d.payload->'photos') IS DISTINCT FROM 'array' OR jsonb_array_length(d.payload->'photos') NOT BETWEEN 1 AND 12
    THEN RAISE EXCEPTION 'Incomplete listing'; END IF;
  INSERT INTO public.properties(id,owner_id,type,title,description,area,college_id,rent,deposit,
    city,available_from,distance_km,room_bed_count,owner_name,owner_phone,owner_whatsapp,gender,accommodation_type,lat,lng,listing_status,rent_period)
  VALUES(p_id,auth.uid(),f->>'property-type',trim(f->>'property-title'),trim(f->>'property-description'),f->>'property-area','kit',
    (f->>'property-rent')::integer,coalesce(nullif(f->>'property-deposit','')::integer,0),f->>'property-city',
    nullif(f->>'property-available-from','')::date,nullif(f->>'property-distance','')::numeric,nullif(f->>'property-capacity','')::integer,
    f->>'owner-name',phone,whatsapp,f->>'property-gender',nullif(trim(f->>'property-room-type'),''),CASE WHEN privacy='approximate' THEN lat_value END,
    CASE WHEN privacy='approximate' THEN lng_value END,'pending','month');
  INSERT INTO public.property_locations(property_id,owner_id,exact_lat,exact_lng,private_address,privacy_mode)
    VALUES(p_id,auth.uid(),lat_value,lng_value,f->>'property-address',privacy);
  FOR photo IN SELECT value FROM jsonb_array_elements(d.payload->'photos') LOOP
    IF NOT EXISTS(SELECT FROM storage.objects o WHERE o.bucket_id='property-media' AND o.name=photo->>'path'
      AND o.metadata->>'mimetype' IN ('image/jpeg','image/png','image/webp')
      AND (o.metadata->>'size')::bigint BETWEEN 1 AND 8388608
      AND (storage.foldername(o.name))[1]=auth.uid()::text AND (storage.foldername(o.name))[2]=p_id::text)
      THEN RAISE EXCEPTION 'A draft photo has not finished uploading'; END IF;
    INSERT INTO public.property_media(property_id,file_url,storage_path,file_type,display_order)
      VALUES(p_id,'',photo->>'path','image',ordinal);
    ordinal:=ordinal+1;
  END LOOP;
  INSERT INTO public.property_facilities(property_id,facility_id) SELECT p_id,value FROM jsonb_array_elements_text(d.payload->'amenities');
  INSERT INTO public.property_rules(property_id,rule_text,display_order) SELECT p_id,trim(rule),position::integer
    FROM regexp_split_to_table(f->>'property-rules', E'\n') WITH ORDINALITY AS t(rule,position) WHERE trim(rule)<>'';
  UPDATE public.listing_drafts SET submitted_at=now(),payload='{}' WHERE id=p_id;
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.save_listing_draft(uuid,integer,jsonb),public.submit_listing_draft(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_listing_draft(uuid,integer,jsonb),public.submit_listing_draft(uuid,integer) TO authenticated;

-- Save each collection atomically under the caller's existing RLS policies.
CREATE FUNCTION public.replace_listing_details(p_property uuid, p_section text, p_values text[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM 1 FROM public.properties WHERE id=p_property AND owner_id=auth.uid()
    AND public.get_my_role()='owner' AND listing_status IN ('draft','rejected','paused') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Editable owner listing required' USING ERRCODE='42501'; END IF;
  IF p_values IS NULL OR cardinality(p_values)>100 THEN RAISE EXCEPTION 'Invalid selection'; END IF;
  IF p_section='facilities' THEN
    DELETE FROM public.property_facilities WHERE property_id=p_property;
    INSERT INTO public.property_facilities(property_id,facility_id)
      SELECT p_property, value FROM unnest(p_values) AS value;
  ELSIF p_section='rules' THEN
    DELETE FROM public.property_rules WHERE property_id=p_property;
    INSERT INTO public.property_rules(property_id,rule_text,display_order)
      SELECT p_property,trim(value),position-1 FROM unnest(p_values) WITH ORDINALITY AS t(value,position);
  ELSE RAISE EXCEPTION 'Unknown listing section'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.replace_listing_details(uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.replace_listing_details(uuid,text,text[]) TO authenticated;

-- New or changed media must identify the same owned object the reviewer sees.
-- Existing URL-only rows remain untouched for a separately reviewed inventory.
CREATE FUNCTION public.check_media_source() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.file_url IS DISTINCT FROM '' OR NOT EXISTS (
    SELECT FROM public.properties p JOIN storage.objects o ON o.bucket_id='property-media' AND o.name=NEW.storage_path
    WHERE p.id=NEW.property_id AND (storage.foldername(o.name))[1]=p.owner_id::text
      AND (storage.foldername(o.name))[2]=p.id::text
      AND (o.metadata->>'mimetype' IN ('image/png','image/jpeg','image/webp') AND NEW.file_type='image'
        OR o.metadata->>'mimetype'='video/mp4' AND NEW.file_type='video')
  ) THEN RAISE EXCEPTION 'Property media must reference an uploaded listing file'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_media_source BEFORE INSERT OR UPDATE OF file_url,storage_path,file_type,property_id ON public.property_media
  FOR EACH ROW EXECUTE FUNCTION public.check_media_source();
