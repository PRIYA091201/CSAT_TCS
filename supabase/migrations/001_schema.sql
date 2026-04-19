-- ============================================================
-- Migration 001 — Core schema
-- CSat / The Chennai Silks
-- Run order: 1st
-- ============================================================

-- ── Extensions ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── product_sections ─────────────────────────────────────────
CREATE TABLE public.product_sections (
  section_id   TEXT        PRIMARY KEY,
  display_name TEXT        NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  sort_order   INTEGER     NOT NULL DEFAULT 0
);

-- ── zones ─────────────────────────────────────────────────────
CREATE TABLE public.zones (
  zone_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name       TEXT        NOT NULL,
  zone_type       TEXT        NOT NULL CHECK (zone_type IN ('billing', 'browse')),
  branch_id       TEXT        NOT NULL DEFAULT 'chennai-main',
  product_section TEXT        REFERENCES public.product_sections(section_id),
  token_ttl_min   INTEGER     NOT NULL DEFAULT 30,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id)  -- who created this zone
);

-- ── kiosks ────────────────────────────────────────────────────
CREATE TABLE public.kiosks (
  kiosk_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_name   TEXT        NOT NULL,
  zone_id      UUID        NOT NULL REFERENCES public.zones(zone_id),
  auth_user_id UUID        NOT NULL UNIQUE REFERENCES auth.users(id),
  branch_id    TEXT        NOT NULL DEFAULT 'chennai-main',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID        NOT NULL REFERENCES auth.users(id)
);

-- ── tokens ────────────────────────────────────────────────────
CREATE TABLE public.tokens (
  token_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id    UUID        NOT NULL REFERENCES public.zones(zone_id),
  status     TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID        REFERENCES auth.users(id)
);

-- Indexes for common query patterns
CREATE INDEX idx_tokens_status     ON public.tokens(status);
CREATE INDEX idx_tokens_expires_at ON public.tokens(expires_at) WHERE status = 'active';
CREATE INDEX idx_tokens_zone_id    ON public.tokens(zone_id);

-- ── feedback_records ──────────────────────────────────────────
CREATE TABLE public.feedback_records (
  feedback_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id        UUID        NOT NULL REFERENCES public.tokens(token_id),
  zone_id         UUID        NOT NULL REFERENCES public.zones(zone_id),
  branch_id       TEXT        NOT NULL DEFAULT 'chennai-main',
  zone_type       TEXT        NOT NULL,
  gender          TEXT        CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  age_group       TEXT        CHECK (age_group IN ('18-25', '26-35', '36-45', '46+')),
  product_section TEXT        NOT NULL REFERENCES public.product_sections(section_id),
  rating_price    TEXT        NOT NULL CHECK (rating_price IN ('happy', 'neutral', 'sad')),
  rating_design   TEXT        NOT NULL CHECK (rating_design IN ('happy', 'neutral', 'sad')),
  rating_handling TEXT        NOT NULL CHECK (rating_handling IN ('happy', 'neutral', 'sad')),
  rating_overall  TEXT        NOT NULL CHECK (rating_overall IN ('happy', 'neutral', 'sad')),
  status          TEXT        NOT NULL DEFAULT 'submitted'
                              CHECK (status IN ('submitted', 'flagged')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX idx_feedback_zone_id    ON public.feedback_records(zone_id);
CREATE INDEX idx_feedback_created_at ON public.feedback_records(created_at DESC);
CREATE INDEX idx_feedback_section    ON public.feedback_records(product_section);
CREATE INDEX idx_feedback_branch     ON public.feedback_records(branch_id);
