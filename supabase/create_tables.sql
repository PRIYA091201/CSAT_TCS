-- ============================================================
-- CSat — The Chennai Silks
-- COMPLETE TABLE CREATION SCRIPT
--
-- Paste this entire file into the Supabase SQL Editor and run.
-- URL: https://supabase.com/dashboard/project/mxfuufwztkgirdjjxkci/sql
--
-- Run order is built into this file. Do not reorder sections.
-- Safe to run on a fresh project with no existing tables.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- STEP 0 — Extensions
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ════════════════════════════════════════════════════════════
-- TABLE 1 — product_sections
--
-- Purpose : Master list of product categories in the store.
-- Who uses: Admin (manage), Kiosk (display section name),
--           feedback_records (FK), zones (FK)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.product_sections (
  section_id   TEXT        PRIMARY KEY,
                           -- Slug format: 'sarees', 'shirts', 'kids_wear'
                           -- Used as FK in zones + feedback_records
  display_name TEXT        NOT NULL,
                           -- Human-readable: "Sarees", "Kids Wear"
  is_active    BOOLEAN     NOT NULL DEFAULT true,
                           -- Admin can disable a section without deleting
  sort_order   INTEGER     NOT NULL DEFAULT 0
                           -- Controls display order in admin UI
);

COMMENT ON TABLE public.product_sections IS
  'Master list of product categories. Managed by Store Admin. section_id is a text slug used as FK across the schema.';


-- ════════════════════════════════════════════════════════════
-- TABLE 2 — zones
--
-- Purpose : Represents a physical feedback collection zone
--           (e.g. Billing Counter, Sarees Section browse kiosk).
-- Who uses: Admin (configure), kiosks (FK), tokens (FK),
--           feedback_records (FK)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.zones (
  zone_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  zone_name       TEXT        NOT NULL,
                              -- e.g. "Billing Counter 1", "Browse — Sarees"

  zone_type       TEXT        NOT NULL
                              CHECK (zone_type IN ('billing', 'browse')),
                              -- 'billing' : QR printed on invoice
                              -- 'browse'  : QR shown on kiosk tablet

  branch_id       TEXT        NOT NULL DEFAULT 'chennai-main',
                              -- Future-proofing for multi-branch expansion

  product_section TEXT        REFERENCES public.product_sections(section_id),
                              -- NULL for billing zones (section not fixed per zone)
                              -- Set for browse zones (kiosk knows its section)

  token_ttl_min   INTEGER     NOT NULL DEFAULT 30,
                              -- How long a token stays active after minting (minutes)
                              -- billing default: 30 min | browse default: 10 min

  is_active       BOOLEAN     NOT NULL DEFAULT true,
                              -- Soft delete: inactive zones cannot mint tokens

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_by      UUID        REFERENCES auth.users(id)
                              -- Admin who created this zone (audit trail)
);

COMMENT ON TABLE public.zones IS
  'Physical feedback zones. Billing zones use printed QR invoices. Browse zones use kiosk tablets. product_section is null for billing, set for browse.';

COMMENT ON COLUMN public.zones.token_ttl_min IS
  'Token TTL in minutes. Billing default = 30. Browse default = 10. Comes from zone config — never hardcode in application code.';


-- ════════════════════════════════════════════════════════════
-- TABLE 3 — kiosks
--
-- Purpose : Represents a physical tablet device. Each kiosk has
--           its own Supabase Auth user (machine identity).
-- Who uses: Admin (provision/manage), Edge Functions (heartbeat),
--           tokens (optional FK for audit trail)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.kiosks (
  kiosk_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  kiosk_name   TEXT        NOT NULL,
                           -- e.g. "Browse — Sarees", "Billing Counter 1"

  zone_id      UUID        NOT NULL REFERENCES public.zones(zone_id),
                           -- Which zone this kiosk serves

  auth_user_id UUID        NOT NULL UNIQUE REFERENCES auth.users(id),
                           -- The dedicated Supabase Auth user for this tablet
                           -- Created by provision-kiosk Edge Function
                           -- Role = 'kiosk' in app_metadata
                           -- UNIQUE: one auth user per physical tablet

  branch_id    TEXT        NOT NULL DEFAULT 'chennai-main',

  is_active    BOOLEAN     NOT NULL DEFAULT true,
                           -- Admin can deactivate remotely (e.g. lost/stolen tablet)
                           -- Deactivated kiosk cannot mint tokens

  last_seen_at TIMESTAMPTZ,
                           -- Updated by kiosk heartbeat every 5 minutes
                           -- Lets admin dashboard show online/offline status

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_by   UUID        NOT NULL REFERENCES auth.users(id)
                           -- Admin who provisioned this kiosk
);

COMMENT ON TABLE public.kiosks IS
  'Physical kiosk tablets. Each has a dedicated Supabase Auth user (kiosk role). Provisioned by admin via provision-kiosk Edge Function. Credentials shown once and never stored here.';

COMMENT ON COLUMN public.kiosks.auth_user_id IS
  'Supabase Auth user created for this tablet. Role = kiosk in app_metadata. Kiosk app auto-signs in on boot using credentials from .env set by IT.';


-- ════════════════════════════════════════════════════════════
-- TABLE 4 — tokens
--
-- Purpose : Single-use QR tokens. Every QR code encodes one token.
--           Drives the entire feedback submission flow.
-- Who uses: Kiosk (mint), customer form (validate + consume),
--           admin (revoke + view), expire-tokens cron (expire)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.tokens (
  token_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
             -- This UUID is encoded in the QR URL: /f/{zone_id}/{token_id}

  zone_id    UUID        NOT NULL REFERENCES public.zones(zone_id),
             -- Which zone issued this token

  status     TEXT        NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'used', 'expired', 'revoked')),
             -- State machine:
             --   active  → used     (customer submits feedback)
             --   active  → expired  (TTL elapses, set by cron)
             --   active  → revoked  (admin manually revokes)
             --   used / expired / revoked = terminal states (no transitions out)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
             -- Token mint time

  expires_at TIMESTAMPTZ NOT NULL,
             -- = created_at + zone.token_ttl_min
             -- billing: 30 min | browse: 10 min

  used_at    TIMESTAMPTZ,
             -- Set when customer submits feedback (status → used)

  revoked_at TIMESTAMPTZ,
             -- Set when admin revokes token

  revoked_by UUID        REFERENCES auth.users(id)
             -- Admin user_id who performed the revocation
);

-- ── Indexes ───────────────────────────────────────────────────
-- expire-tokens cron: finds active tokens past their TTL
CREATE INDEX idx_tokens_status_expires
  ON public.tokens(status, expires_at)
  WHERE status = 'active';

-- Admin token management: filter by zone
CREATE INDEX idx_tokens_zone_id
  ON public.tokens(zone_id);

-- General status filter
CREATE INDEX idx_tokens_status
  ON public.tokens(status);

COMMENT ON TABLE public.tokens IS
  'Single-use QR tokens. One token per customer interaction. Terminal states: used, expired, revoked. Never reused.';

COMMENT ON COLUMN public.tokens.expires_at IS
  'Hard expiry. Billing = created_at + 30min. Browse = created_at + 10min. Values come from zone.token_ttl_min at mint time.';


-- ════════════════════════════════════════════════════════════
-- TABLE 5 — feedback_records
--
-- Purpose : Stores one feedback submission per token.
--           Core data for all dashboard analytics.
-- Who uses: submit-feedback Edge Function (INSERT),
--           Admin dashboard (SELECT), MD dashboard (SELECT),
--           CSV export (SELECT)
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.feedback_records (
  feedback_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  token_id        UUID        NOT NULL REFERENCES public.tokens(token_id),
                              -- One feedback per token (enforced by token state machine)

  zone_id         UUID        NOT NULL REFERENCES public.zones(zone_id),
                              -- Denormalized from token for query speed

  branch_id       TEXT        NOT NULL DEFAULT 'chennai-main',
                              -- Denormalized for fast cross-branch queries

  zone_type       TEXT        NOT NULL
                              CHECK (zone_type IN ('billing', 'browse')),
                              -- Denormalized: avoids JOIN on every dashboard query

  -- ── Optional demographics (customer may skip) ───────────
  gender          TEXT
                  CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
                  -- NULL if customer tapped Skip

  age_group       TEXT
                  CHECK (age_group IN ('18-25', '26-35', '36-45', '46+')),
                  -- NULL if customer tapped Skip

  -- ── Product section ──────────────────────────────────────
  product_section TEXT        NOT NULL REFERENCES public.product_sections(section_id),
                              -- ALWAYS from zone config. NEVER from customer input.
                              -- Resolved server-side in submit-feedback Edge Function.

  -- ── 4 emoji ratings (all required) ──────────────────────
  rating_price    TEXT        NOT NULL CHECK (rating_price    IN ('happy', 'neutral', 'sad')),
  rating_design   TEXT        NOT NULL CHECK (rating_design   IN ('happy', 'neutral', 'sad')),
  rating_handling TEXT        NOT NULL CHECK (rating_handling IN ('happy', 'neutral', 'sad')),
  rating_overall  TEXT        NOT NULL CHECK (rating_overall  IN ('happy', 'neutral', 'sad')),
                              -- rating_overall = customer's gut feeling
                              -- NOT a derived average of the other 3

  status          TEXT        NOT NULL DEFAULT 'submitted'
                              CHECK (status IN ('submitted', 'flagged')),
                              -- 'flagged' reserved for post-MVP anomaly detection

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                              -- Submission timestamp
);

-- ── Indexes ───────────────────────────────────────────────────
-- Dashboard: filter by zone
CREATE INDEX idx_feedback_zone_id
  ON public.feedback_records(zone_id);

-- Dashboard: filter by date range (most common filter)
CREATE INDEX idx_feedback_created_at
  ON public.feedback_records(created_at DESC);

-- Section heatmap: filter + group by section
CREATE INDEX idx_feedback_section
  ON public.feedback_records(product_section);

-- Multi-branch future-proofing
CREATE INDEX idx_feedback_branch
  ON public.feedback_records(branch_id);

-- Composite: most dashboard queries filter by branch + date
CREATE INDEX idx_feedback_branch_date
  ON public.feedback_records(branch_id, created_at DESC);

-- Zone comparison: group by zone_type
CREATE INDEX idx_feedback_zone_type
  ON public.feedback_records(zone_type, created_at DESC);

COMMENT ON TABLE public.feedback_records IS
  'One row per customer feedback submission. product_section always resolved server-side from zone config. rating_overall is the customer gut feeling — never derived.';

COMMENT ON COLUMN public.feedback_records.product_section IS
  'Always set from zone config by submit-feedback Edge Function. The customer never selects or overrides this value.';


-- ════════════════════════════════════════════════════════════
-- TABLE 6 — audit_logs
--
-- Purpose : Immutable log of all admin-initiated state changes.
--           Security + compliance trail.
-- Who uses: All admin Edge Functions (INSERT via service role),
--           Admin + MD dashboards (SELECT only)
-- INSERT-ONLY. No UPDATE. No DELETE. Ever.
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.audit_logs (
  log_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id       UUID        NOT NULL REFERENCES auth.users(id),
                            -- Admin or MD who performed the action

  action        TEXT        NOT NULL,
                            -- Values: revoke_token | create_zone | update_zone |
                            --         provision_kiosk | deactivate_kiosk |
                            --         export_csv | enable_2fa | disable_2fa

  resource_type TEXT,
                            -- Values: token | zone | kiosk | export

  resource_id   UUID,
                            -- UUID of the affected record (token_id, zone_id, etc.)

  context       JSONB,
                            -- Structured detail: old/new values, reason, row counts
                            -- Example: {"old_status": "active", "reason": "suspicious"}

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
-- Admin audit log: filter by user
CREATE INDEX idx_audit_logs_user
  ON public.audit_logs(user_id, created_at DESC);

-- Filter by action type
CREATE INDEX idx_audit_logs_action
  ON public.audit_logs(action, created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail. INSERT only via Edge Functions using service role. Never UPDATE or DELETE any row.';

COMMENT ON COLUMN public.audit_logs.action IS
  'Allowed: revoke_token, create_zone, update_zone, provision_kiosk, deactivate_kiosk, export_csv, enable_2fa, disable_2fa';


-- ════════════════════════════════════════════════════════════
-- STEP 1 — Row Level Security
-- Enable RLS on all tables. Policies defined below.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.product_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs        ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════
-- STEP 2 — RLS Policies
-- Role claims live in app_metadata, read with:
--   auth.jwt() -> 'app_metadata' ->> 'role'
-- ════════════════════════════════════════════════════════════

-- ── product_sections ─────────────────────────────────────────

CREATE POLICY "public_read_active_sections"
  ON public.product_sections FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "admin_manage_sections"
  ON public.product_sections FOR ALL
  TO authenticated
  USING  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- ── zones ─────────────────────────────────────────────────────

CREATE POLICY "admin_all_zones"
  ON public.zones FOR ALL
  TO authenticated
  USING  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "md_read_zones"
  ON public.zones FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- ── kiosks ────────────────────────────────────────────────────

CREATE POLICY "admin_all_kiosks"
  ON public.kiosks FOR ALL
  TO authenticated
  USING  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "md_read_kiosks"
  ON public.kiosks FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- ── tokens ────────────────────────────────────────────────────
-- Note: No anon INSERT. Tokens are created only by mint-token Edge Function (service role).
-- Kiosk role has no direct table access — must go through Edge Functions.

CREATE POLICY "admin_all_tokens"
  ON public.tokens FOR ALL
  TO authenticated
  USING  (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "md_read_tokens"
  ON public.tokens FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- ── feedback_records ──────────────────────────────────────────
-- Note: No anon INSERT. Feedback is written only by submit-feedback Edge Function (service role).

CREATE POLICY "admin_read_feedback"
  ON public.feedback_records FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY "md_read_feedback"
  ON public.feedback_records FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- ── audit_logs ────────────────────────────────────────────────
-- INSERT only via Edge Functions (service role — bypasses RLS).
-- No UPDATE. No DELETE.

CREATE POLICY "admin_md_read_audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'md'));


-- ════════════════════════════════════════════════════════════
-- STEP 3 — Seed Data
-- Initial product sections for The Chennai Silks.
-- STOP: Confirm full taxonomy with store owner (specs.md §14 Q3)
-- before production deploy. These are the 6 example slugs from spec.
-- ════════════════════════════════════════════════════════════

INSERT INTO public.product_sections (section_id, display_name, is_active, sort_order)
VALUES
  ('sarees',       'Sarees',       true, 1),
  ('shirts',       'Shirts',       true, 2),
  ('trousers',     'Trousers',     true, 3),
  ('kids_wear',    'Kids Wear',    true, 4),
  ('accessories',  'Accessories',  true, 5),
  ('fabrics',      'Fabrics',      true, 6)
ON CONFLICT (section_id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- DONE
-- Tables created:
--   1. product_sections  — product category master list
--   2. zones             — billing + browse zones
--   3. kiosks            — physical tablet devices
--   4. tokens            — single-use QR tokens
--   5. feedback_records  — customer feedback submissions
--   6. audit_logs        — immutable admin action log
--
-- All indexes created.
-- RLS enabled and policies applied on all 6 tables.
-- Seed data: 6 product sections.
-- ════════════════════════════════════════════════════════════
