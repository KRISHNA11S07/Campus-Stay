-- ============================================================
-- CampusStay — Inquiries and Reports
-- Run after 001–009. Safe to apply to existing data.
-- ============================================================

-- Inquiries: students contact owners about a property
CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'responded', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_property ON public.inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_student ON public.inquiries(student_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_owner ON public.inquiries(owner_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);

-- Reports: students or owners can report listings/users
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_property ON public.reports(property_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- RLS for inquiries
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inquiries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;

CREATE POLICY inquiries_select_student ON public.inquiries
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND public.get_my_role() = 'student');

CREATE POLICY inquiries_select_owner ON public.inquiries
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner');

CREATE POLICY inquiries_select_admin ON public.inquiries
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY inquiries_insert_student ON public.inquiries
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_my_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id
        AND p.verification_status = 'verified'
    )
  );

CREATE POLICY inquiries_update_owner ON public.inquiries
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND public.get_my_role() = 'owner')
  WITH CHECK (owner_id = auth.uid() AND public.get_my_role() = 'owner');

-- RLS for reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reports FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;

CREATE POLICY reports_select_reporter ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY reports_select_admin ON public.reports
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY reports_insert_reporter ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY reports_update_admin ON public.reports
  FOR UPDATE TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

-- Property views: track views for analytics (privacy-safe, no student PII)
CREATE TABLE IF NOT EXISTS public.property_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_views_property ON public.property_views(property_id);
CREATE INDEX IF NOT EXISTS idx_property_views_viewer ON public.property_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_property_views_viewed_at ON public.property_views(viewed_at);

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_views FROM anon, authenticated;
GRANT SELECT, INSERT ON public.property_views TO authenticated;

CREATE POLICY property_views_insert_public ON public.property_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY property_views_select_owner ON public.property_views
  FOR SELECT TO authenticated
  USING (
    public.get_my_role() = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY property_views_select_admin ON public.property_views
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'admin');

-- Updated at trigger for inquiries and reports
CREATE OR REPLACE FUNCTION public.set_updated_at_inquiries_reports()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inquiries_updated_at ON public.inquiries;
CREATE TRIGGER inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_inquiries_reports();

DROP TRIGGER IF EXISTS reports_updated_at ON public.reports;
CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_inquiries_reports();