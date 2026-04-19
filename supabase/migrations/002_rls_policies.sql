-- ============================================================
-- Migration 002 — Row Level Security policies
-- CSat / The Chennai Silks
-- Run order: 2nd (after 001_schema.sql)
--
-- Role claims are stored in app_metadata (NOT user_metadata).
-- Read with: auth.jwt() -> 'app_metadata' ->> 'role'
-- ============================================================

-- ── Enable RLS on all tables ──────────────────────────────────
ALTER TABLE public.product_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_records  ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════
-- product_sections
-- ════════════════════════════════════════════════════════════

-- Anyone can read active sections (customer form needs section display names)
CREATE POLICY "public_read_active_sections" ON public.product_sections
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Admin can read all sections (including inactive)
CREATE POLICY "admin_read_all_sections" ON public.product_sections
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- Admin can insert/update sections
CREATE POLICY "admin_insert_sections" ON public.product_sections
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "admin_update_sections" ON public.product_sections
  FOR UPDATE TO authenticated
  USING  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- ════════════════════════════════════════════════════════════
-- zones
-- ════════════════════════════════════════════════════════════

-- Admin: read zones in their branch
CREATE POLICY "admin_select_zones" ON public.zones
  FOR SELECT TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    AND branch_id = COALESCE(auth.jwt() -> 'app_metadata' ->> 'branch_id', 'chennai-main')
  );

-- Admin: create/update zones
CREATE POLICY "admin_insert_zones" ON public.zones
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "admin_update_zones" ON public.zones
  FOR UPDATE TO authenticated
  USING  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- MD: read all zones (cross-branch, read-only)
CREATE POLICY "md_select_zones" ON public.zones
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- ════════════════════════════════════════════════════════════
-- kiosks
-- ════════════════════════════════════════════════════════════

-- Admin: read kiosks in their branch
CREATE POLICY "admin_select_kiosks" ON public.kiosks
  FOR SELECT TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    AND branch_id = COALESCE(auth.jwt() -> 'app_metadata' ->> 'branch_id', 'chennai-main')
  );

-- Admin: update kiosk (activate/deactivate, last_seen_at)
CREATE POLICY "admin_update_kiosks" ON public.kiosks
  FOR UPDATE TO authenticated
  USING  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- MD: read all kiosks (read-only)
CREATE POLICY "md_select_kiosks" ON public.kiosks
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- Note: INSERT on kiosks is done by provision-kiosk Edge Function via service role.
-- No direct INSERT policy for any role.

-- ════════════════════════════════════════════════════════════
-- tokens
-- ════════════════════════════════════════════════════════════

-- Anon: read a single active token (validate-token Edge Function uses service role,
--       but this policy enables the lightweight public read path if ever needed)
CREATE POLICY "anon_read_active_token" ON public.tokens
  FOR SELECT TO anon
  USING (status = 'active');

-- Admin: read all tokens in their branch (via joined zone)
CREATE POLICY "admin_select_tokens" ON public.tokens
  FOR SELECT TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.zones z
      WHERE z.zone_id = tokens.zone_id
        AND z.branch_id = COALESCE(auth.jwt() -> 'app_metadata' ->> 'branch_id', 'chennai-main')
    )
  );

-- Admin: update tokens (for revocation)
CREATE POLICY "admin_update_tokens" ON public.tokens
  FOR UPDATE TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.zones z
      WHERE z.zone_id = tokens.zone_id
        AND z.branch_id = COALESCE(auth.jwt() -> 'app_metadata' ->> 'branch_id', 'chennai-main')
    )
  );

-- MD: read all tokens (read-only)
CREATE POLICY "md_select_tokens" ON public.tokens
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- Note: INSERT on tokens is done by mint-token Edge Function via service role.
-- Note: Kiosk role has NO direct table policies — must go through Edge Functions.

-- ════════════════════════════════════════════════════════════
-- feedback_records
-- ════════════════════════════════════════════════════════════

-- Admin: read feedback in their branch
CREATE POLICY "admin_select_feedback" ON public.feedback_records
  FOR SELECT TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
    AND branch_id = COALESCE(auth.jwt() -> 'app_metadata' ->> 'branch_id', 'chennai-main')
  );

-- MD: read all feedback (cross-zone, read-only)
CREATE POLICY "md_select_feedback" ON public.feedback_records
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- Note: INSERT on feedback_records is done by submit-feedback Edge Function via service role.
-- No anon INSERT policy — customer form never writes directly to DB.
-- No UPDATE or DELETE policies for any role.
