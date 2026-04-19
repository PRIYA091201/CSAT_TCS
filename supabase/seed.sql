-- ============================================================
-- Seed data — CSat / The Chennai Silks
-- Run after all migrations.
-- Safe to re-run (uses ON CONFLICT DO NOTHING).
-- ============================================================

-- ── Product sections ─────────────────────────────────────────
-- STOP: specs.md §14 open question #3 — full product section taxonomy
-- is unresolved. Using the 6 example slugs from specs.md §6.4 for now.
-- Confirm the full list with the store owner before production deploy.

INSERT INTO public.product_sections (section_id, display_name, is_active, sort_order) VALUES
  ('sarees',      'Sarees',       true, 1),
  ('shirts',      'Shirts',       true, 2),
  ('trousers',    'Trousers',     true, 3),
  ('kids_wear',   'Kids Wear',    true, 4),
  ('accessories', 'Accessories',  true, 5),
  ('fabrics',     'Fabrics',      true, 6)
ON CONFLICT (section_id) DO NOTHING;

-- ── Test zones (dev/staging only) ────────────────────────────
-- These zones are for local development. Do NOT run in production.
-- Production zones are created by the Store Admin via the dashboard.

INSERT INTO public.zones (zone_id, zone_name, zone_type, branch_id, product_section, token_ttl_min, is_active) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Billing Counter 1',
    'billing',
    'chennai-main',
    NULL,          -- billing zones have no product section (customer selects on form)
    30,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Browse — Sarees Section',
    'browse',
    'chennai-main',
    'sarees',
    10,
    true
  )
ON CONFLICT (zone_id) DO NOTHING;
