-- ============================================================
-- Migration 003 — Audit logs table
-- CSat / The Chennai Silks
-- Run order: 3rd (after 002_rls_policies.sql)
--
-- Immutable log of all admin-initiated state changes.
-- INSERT-only via Edge Functions (service role).
-- No UPDATE. No DELETE. Ever.
-- ============================================================

CREATE TABLE public.audit_logs (
  log_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  action        TEXT        NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  context       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for admin audit log queries
CREATE INDEX idx_audit_logs_user   ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin and MD can read audit logs
CREATE POLICY "admin_md_select_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'md')
  );

-- No INSERT policy for authenticated users — only Edge Functions via service role insert.
-- No UPDATE policy — logs are immutable.
-- No DELETE policy — logs are immutable.

-- ── Comment on action values ──────────────────────────────────
COMMENT ON COLUMN public.audit_logs.action IS
  'Allowed values: revoke_token, create_zone, update_zone, provision_kiosk, deactivate_kiosk, export_csv, enable_2fa, disable_2fa';

COMMENT ON COLUMN public.audit_logs.resource_type IS
  'Allowed values: token, zone, kiosk, export';

COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail for all admin-initiated state changes. INSERT via Edge Functions only. Never UPDATE or DELETE.';
