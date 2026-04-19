-- ============================================================
-- CSat / The Chennai Silks — Full SQL Query Reference
-- All queries the project needs, organised by layer.
-- Use this file as the reference when building Edge Functions
-- and dashboard data hooks.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- SECTION A: SCHEMA UPDATE (Option 1 — add created_by to zones)
-- Run this once before any other queries.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);


-- ════════════════════════════════════════════════════════════
-- SECTION B: EDGE FUNCTION QUERIES
-- Used inside Deno Edge Functions via the service role client.
-- ════════════════════════════════════════════════════════════

-- ── B1: mint-token — fetch zone config ───────────────────────
-- Used to validate the zone and resolve product_section before minting.

SELECT
  zone_id,
  zone_type,
  branch_id,
  product_section,
  token_ttl_min,
  is_active
FROM public.zones
WHERE zone_id = $1;  -- $1 = zone_id from client input


-- ── B2: mint-token — insert new token ────────────────────────
-- expires_at is computed as: now() + (token_ttl_min * interval '1 minute')

INSERT INTO public.tokens (zone_id, status, expires_at)
VALUES (
  $1,                                          -- zone_id
  'active',
  now() + ($2 * interval '1 minute')          -- $2 = token_ttl_min from zone
)
RETURNING token_id, expires_at;


-- ── B3: validate-token — fetch token + zone in one query ─────
-- Used on customer form load. Joined so one round-trip fetches everything.

SELECT
  t.token_id,
  t.status,
  t.expires_at,
  t.zone_id,
  z.zone_type,
  z.product_section,
  z.branch_id
FROM public.tokens t
JOIN public.zones z ON z.zone_id = t.zone_id
WHERE t.token_id = $1;  -- $1 = token_id from QR URL


-- ── B4: submit-feedback — re-validate token before insert ────
-- Same as B3 but must re-check inside submit to prevent race conditions.

SELECT
  t.token_id,
  t.status,
  t.expires_at,
  t.zone_id,
  z.zone_type,
  z.branch_id,
  z.product_section
FROM public.tokens t
JOIN public.zones z ON z.zone_id = t.zone_id
WHERE t.token_id = $1
  AND t.status = 'active'
  AND t.expires_at > now();


-- ── B5: submit-feedback — insert feedback record ─────────────
-- product_section comes from zone config (B4 result), NEVER from client.

INSERT INTO public.feedback_records (
  token_id,
  zone_id,
  branch_id,
  zone_type,
  gender,
  age_group,
  product_section,
  rating_price,
  rating_design,
  rating_handling,
  rating_overall,
  status
) VALUES (
  $1,   -- token_id
  $2,   -- zone_id       (from zone config)
  $3,   -- branch_id     (from zone config)
  $4,   -- zone_type     (from zone config)
  $5,   -- gender        (nullable, from customer input)
  $6,   -- age_group     (nullable, from customer input)
  $7,   -- product_section (from zone config — NEVER from client)
  $8,   -- rating_price
  $9,   -- rating_design
  $10,  -- rating_handling
  $11,  -- rating_overall
  'submitted'
)
RETURNING feedback_id;


-- ── B6: submit-feedback — mark token as used ─────────────────
-- Guard: only update if still active (prevents double-submit race)

UPDATE public.tokens
SET
  status  = 'used',
  used_at = now()
WHERE token_id = $1
  AND status   = 'active'
RETURNING token_id;


-- ── B7: expire-tokens cron — bulk expire ─────────────────────
-- Runs every 5 minutes. Updates all overdue active tokens.

UPDATE public.tokens
SET status = 'expired'
WHERE status     = 'active'
  AND expires_at < now()
RETURNING token_id;


-- ── B8: provision-kiosk — insert kiosk row ───────────────────

INSERT INTO public.kiosks (kiosk_name, zone_id, auth_user_id, branch_id, created_by)
VALUES ($1, $2, $3, $4, $5)
  -- $1 = kiosk_name
  -- $2 = zone_id
  -- $3 = auth_user_id (just created via Admin API)
  -- $4 = branch_id
  -- $5 = calling admin's user_id
RETURNING kiosk_id;


-- ── B9: audit_logs — insert (used by all admin Edge Functions) ─

INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, context)
VALUES ($1, $2, $3, $4, $5::jsonb);
  -- $1 = admin user_id
  -- $2 = action string e.g. 'revoke_token'
  -- $3 = resource_type e.g. 'token'
  -- $4 = resource_id (UUID)
  -- $5 = JSONB context object


-- ── B10: admin revoke token ───────────────────────────────────

UPDATE public.tokens
SET
  status     = 'revoked',
  revoked_at = now(),
  revoked_by = $2   -- admin user_id
WHERE token_id = $1
  AND status   = 'active'  -- can only revoke active tokens
RETURNING token_id, status;


-- ════════════════════════════════════════════════════════════
-- SECTION C: ADMIN DASHBOARD — STORE ADMIN QUERIES
-- ════════════════════════════════════════════════════════════

-- ── C1: Zone list (zone config page) ─────────────────────────

SELECT
  z.zone_id,
  z.zone_name,
  z.zone_type,
  z.branch_id,
  z.product_section,
  ps.display_name AS section_display_name,
  z.token_ttl_min,
  z.is_active,
  z.created_at
FROM public.zones z
LEFT JOIN public.product_sections ps ON ps.section_id = z.product_section
WHERE z.branch_id = $1   -- $1 = admin's branch_id from app_metadata
ORDER BY z.zone_type, z.zone_name;


-- ── C2: Product sections list (for dropdowns + management) ───

SELECT
  section_id,
  display_name,
  is_active,
  sort_order
FROM public.product_sections
ORDER BY sort_order ASC, display_name ASC;


-- ── C3: Kiosk list with zone and section details ─────────────

SELECT
  k.kiosk_id,
  k.kiosk_name,
  k.branch_id,
  k.is_active,
  k.last_seen_at,
  k.created_at,
  z.zone_id,
  z.zone_name,
  z.zone_type,
  z.product_section,
  ps.display_name AS section_display_name
FROM public.kiosks k
JOIN  public.zones z           ON z.zone_id    = k.zone_id
LEFT JOIN public.product_sections ps ON ps.section_id = z.product_section
WHERE k.branch_id = $1         -- admin's branch
ORDER BY k.created_at DESC;


-- ── C4: Active tokens with remaining TTL (token management) ──

SELECT
  t.token_id,
  t.status,
  t.created_at,
  t.expires_at,
  EXTRACT(EPOCH FROM (t.expires_at - now())) / 60 AS ttl_remaining_min,
  z.zone_name,
  z.zone_type
FROM public.tokens t
JOIN public.zones z ON z.zone_id = t.zone_id
WHERE t.status    = 'active'
  AND z.branch_id = $1          -- admin's branch
ORDER BY t.expires_at ASC;      -- soonest to expire first


-- ── C5: Zone dashboard — total submissions by period ─────────
-- Used for the metric cards (today / week / month).

SELECT
  COUNT(*)                                                    AS total,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)          AS today,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('week',  now())) AS this_week,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS this_month
FROM public.feedback_records
WHERE zone_id = $1;  -- specific zone


-- ── C6: Zone dashboard — emotion pulse (happy/neutral/sad %) ─
-- Returns counts per rating per dimension for one zone.

SELECT
  -- Pricing
  COUNT(*) FILTER (WHERE rating_price    = 'happy')   AS price_happy,
  COUNT(*) FILTER (WHERE rating_price    = 'neutral')  AS price_neutral,
  COUNT(*) FILTER (WHERE rating_price    = 'sad')      AS price_sad,
  -- Design
  COUNT(*) FILTER (WHERE rating_design   = 'happy')   AS design_happy,
  COUNT(*) FILTER (WHERE rating_design   = 'neutral')  AS design_neutral,
  COUNT(*) FILTER (WHERE rating_design   = 'sad')      AS design_sad,
  -- Handling
  COUNT(*) FILTER (WHERE rating_handling = 'happy')   AS handling_happy,
  COUNT(*) FILTER (WHERE rating_handling = 'neutral')  AS handling_neutral,
  COUNT(*) FILTER (WHERE rating_handling = 'sad')      AS handling_sad,
  -- Overall
  COUNT(*) FILTER (WHERE rating_overall  = 'happy')   AS overall_happy,
  COUNT(*) FILTER (WHERE rating_overall  = 'neutral')  AS overall_neutral,
  COUNT(*) FILTER (WHERE rating_overall  = 'sad')      AS overall_sad,
  COUNT(*)                                             AS total
FROM public.feedback_records
WHERE zone_id    = $1               -- specific zone
  AND created_at >= $2              -- date range start
  AND created_at <  $3;             -- date range end


-- ── C7: Zone dashboard — 7-day submission trend ──────────────

SELECT
  DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
  COUNT(*)                                     AS submissions
FROM public.feedback_records
WHERE zone_id    = $1
  AND created_at >= now() - interval '7 days'
GROUP BY day
ORDER BY day ASC;


-- ── C8: Token audit log for admin view ───────────────────────

SELECT
  al.log_id,
  al.action,
  al.resource_type,
  al.resource_id,
  al.context,
  al.created_at,
  au.email AS performed_by
FROM public.audit_logs al
JOIN auth.users au ON au.id = al.user_id
WHERE al.action IN ('revoke_token', 'provision_kiosk', 'create_zone', 'update_zone')
ORDER BY al.created_at DESC
LIMIT 100;


-- ── C9: Response rate — tokens minted vs submitted ───────────

SELECT
  COUNT(*)                                                AS tokens_minted,
  COUNT(*) FILTER (WHERE status = 'used')                 AS tokens_used,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'used')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                       AS response_rate_pct
FROM public.tokens t
JOIN public.zones z ON z.zone_id = t.zone_id
WHERE z.branch_id  = $1
  AND z.zone_id    = $2           -- optional: filter by specific zone
  AND t.created_at >= $3
  AND t.created_at <  $4;


-- ════════════════════════════════════════════════════════════
-- SECTION D: MD / OWNER DASHBOARD QUERIES
-- ════════════════════════════════════════════════════════════

-- ── D1: Overview — total submissions + happiness ratio ───────
-- Powers the 4 metric cards on the MD landing page.

SELECT
  COUNT(*)                                                       AS total_submissions,
  ROUND(
    (
      COUNT(*) FILTER (WHERE rating_price    = 'happy') +
      COUNT(*) FILTER (WHERE rating_design   = 'happy') +
      COUNT(*) FILTER (WHERE rating_handling = 'happy') +
      COUNT(*) FILTER (WHERE rating_overall  = 'happy')
    )::NUMERIC / NULLIF(COUNT(*) * 4, 0) * 100, 1
  )                                                              AS happiness_ratio_pct
FROM public.feedback_records
WHERE branch_id  = 'chennai-main'
  AND created_at >= $1    -- date range start
  AND created_at <  $2;   -- date range end


-- ── D2: Overview — trend vs previous period ──────────────────
-- Compares current period vs same-length period before it.
-- Run twice: once for current period, once for previous period.
-- Frontend computes the % change.

SELECT COUNT(*) AS submissions
FROM public.feedback_records
WHERE branch_id  = 'chennai-main'
  AND created_at >= $1   -- period start
  AND created_at <  $2;  -- period end


-- ── D3: Overview — top concern (worst dimension) ─────────────
-- Returns the single dimension with the lowest happy %.

SELECT
  dimension,
  happy_count,
  total_count,
  ROUND(happy_count::NUMERIC / NULLIF(total_count, 0) * 100, 1) AS happy_pct,
  unhappy_count,
  ROUND(unhappy_count::NUMERIC / NULLIF(total_count, 0) * 100, 1) AS unhappy_pct
FROM (
  SELECT
    'pricing'  AS dimension,
    COUNT(*) FILTER (WHERE rating_price = 'happy')   AS happy_count,
    COUNT(*) FILTER (WHERE rating_price = 'sad')     AS unhappy_count,
    COUNT(*)                                          AS total_count
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
  UNION ALL
  SELECT
    'design',
    COUNT(*) FILTER (WHERE rating_design = 'happy'),
    COUNT(*) FILTER (WHERE rating_design = 'sad'),
    COUNT(*)
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
  UNION ALL
  SELECT
    'handling',
    COUNT(*) FILTER (WHERE rating_handling = 'happy'),
    COUNT(*) FILTER (WHERE rating_handling = 'sad'),
    COUNT(*)
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
  UNION ALL
  SELECT
    'overall',
    COUNT(*) FILTER (WHERE rating_overall = 'happy'),
    COUNT(*) FILTER (WHERE rating_overall = 'sad'),
    COUNT(*)
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
) dims
ORDER BY happy_pct ASC   -- worst first
LIMIT 1;


-- ── D4: Overview — emotion pulse (all zones combined) ─────────
-- Same structure as C6 but across all zones, not one zone.

SELECT
  COUNT(*) FILTER (WHERE rating_price    = 'happy')   AS price_happy,
  COUNT(*) FILTER (WHERE rating_price    = 'neutral')  AS price_neutral,
  COUNT(*) FILTER (WHERE rating_price    = 'sad')      AS price_sad,
  COUNT(*) FILTER (WHERE rating_design   = 'happy')   AS design_happy,
  COUNT(*) FILTER (WHERE rating_design   = 'neutral')  AS design_neutral,
  COUNT(*) FILTER (WHERE rating_design   = 'sad')      AS design_sad,
  COUNT(*) FILTER (WHERE rating_handling = 'happy')   AS handling_happy,
  COUNT(*) FILTER (WHERE rating_handling = 'neutral')  AS handling_neutral,
  COUNT(*) FILTER (WHERE rating_handling = 'sad')      AS handling_sad,
  COUNT(*) FILTER (WHERE rating_overall  = 'happy')   AS overall_happy,
  COUNT(*) FILTER (WHERE rating_overall  = 'neutral')  AS overall_neutral,
  COUNT(*) FILTER (WHERE rating_overall  = 'sad')      AS overall_sad,
  COUNT(*)                                             AS total
FROM public.feedback_records
WHERE branch_id  = 'chennai-main'
  AND created_at >= $1
  AND created_at <  $2;


-- ── D5: Overview — zone comparison (billing vs browse) ────────
-- Side-by-side cards. Run per zone_type or group by zone_type.

SELECT
  zone_type,
  COUNT(*)                                                       AS submissions,
  COUNT(*) FILTER (WHERE rating_price    = 'happy')             AS price_happy,
  COUNT(*) FILTER (WHERE rating_price    = 'neutral')            AS price_neutral,
  COUNT(*) FILTER (WHERE rating_price    = 'sad')                AS price_sad,
  COUNT(*) FILTER (WHERE rating_design   = 'happy')             AS design_happy,
  COUNT(*) FILTER (WHERE rating_design   = 'neutral')            AS design_neutral,
  COUNT(*) FILTER (WHERE rating_design   = 'sad')                AS design_sad,
  COUNT(*) FILTER (WHERE rating_handling = 'happy')             AS handling_happy,
  COUNT(*) FILTER (WHERE rating_handling = 'neutral')            AS handling_neutral,
  COUNT(*) FILTER (WHERE rating_handling = 'sad')                AS handling_sad,
  COUNT(*) FILTER (WHERE rating_overall  = 'happy')             AS overall_happy,
  COUNT(*) FILTER (WHERE rating_overall  = 'neutral')            AS overall_neutral,
  COUNT(*) FILTER (WHERE rating_overall  = 'sad')                AS overall_sad
FROM public.feedback_records
WHERE branch_id  = 'chennai-main'
  AND created_at >= $1
  AND created_at <  $2
GROUP BY zone_type;


-- ── D6: Overview — 7-day trend (volume + happiness ratio) ────
-- Powers the dual-axis chart: blue area (volume) + green line (happiness %)

SELECT
  DATE(created_at AT TIME ZONE 'Asia/Kolkata')        AS day,
  COUNT(*)                                            AS submissions,
  ROUND(
    (
      COUNT(*) FILTER (WHERE rating_price    = 'happy') +
      COUNT(*) FILTER (WHERE rating_design   = 'happy') +
      COUNT(*) FILTER (WHERE rating_handling = 'happy') +
      COUNT(*) FILTER (WHERE rating_overall  = 'happy')
    )::NUMERIC / NULLIF(COUNT(*) * 4, 0) * 100, 1
  )                                                   AS happiness_pct
FROM public.feedback_records
WHERE branch_id  = 'chennai-main'
  AND created_at >= now() - interval '7 days'
GROUP BY day
ORDER BY day ASC;


-- ── D7: Section heatmap — happy % per section × dimension ────
-- Returns one row per product_section with all 4 dimension happy %.
-- Frontend builds the grid from this single query result.

SELECT
  fr.product_section,
  ps.display_name,
  COUNT(*)                                                    AS total,

  -- Pricing
  COUNT(*) FILTER (WHERE rating_price    = 'happy')          AS price_happy,
  COUNT(*) FILTER (WHERE rating_price    = 'sad')            AS price_sad,
  ROUND(COUNT(*) FILTER (WHERE rating_price    = 'happy')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1)                         AS price_happy_pct,

  -- Design
  COUNT(*) FILTER (WHERE rating_design   = 'happy')          AS design_happy,
  COUNT(*) FILTER (WHERE rating_design   = 'sad')            AS design_sad,
  ROUND(COUNT(*) FILTER (WHERE rating_design   = 'happy')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1)                         AS design_happy_pct,

  -- Handling
  COUNT(*) FILTER (WHERE rating_handling = 'happy')          AS handling_happy,
  COUNT(*) FILTER (WHERE rating_handling = 'sad')            AS handling_sad,
  ROUND(COUNT(*) FILTER (WHERE rating_handling = 'happy')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1)                         AS handling_happy_pct,

  -- Overall
  COUNT(*) FILTER (WHERE rating_overall  = 'happy')          AS overall_happy,
  COUNT(*) FILTER (WHERE rating_overall  = 'sad')            AS overall_sad,
  ROUND(COUNT(*) FILTER (WHERE rating_overall  = 'happy')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1)                         AS overall_happy_pct

FROM public.feedback_records fr
JOIN public.product_sections ps ON ps.section_id = fr.product_section
WHERE fr.branch_id  = 'chennai-main'
  AND fr.created_at >= $1
  AND fr.created_at <  $2
GROUP BY fr.product_section, ps.display_name, ps.sort_order
ORDER BY ps.sort_order ASC;


-- ── D8: Top concerns — worst section×dimension pairs ─────────
-- Powers the ranked list below the heatmap.
-- Returns top 3 worst-performing section+dimension combos by happy %.

SELECT
  section,
  dimension,
  happy_count,
  unhappy_count,
  total_count,
  ROUND(happy_count::NUMERIC   / NULLIF(total_count, 0) * 100, 1) AS happy_pct,
  ROUND(unhappy_count::NUMERIC / NULLIF(total_count, 0) * 100, 1) AS unhappy_pct
FROM (
  SELECT product_section AS section, 'pricing'  AS dimension,
    COUNT(*) FILTER (WHERE rating_price    = 'happy') AS happy_count,
    COUNT(*) FILTER (WHERE rating_price    = 'sad')   AS unhappy_count,
    COUNT(*)                                           AS total_count
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
  GROUP BY product_section
  UNION ALL
  SELECT product_section, 'design',
    COUNT(*) FILTER (WHERE rating_design   = 'happy'),
    COUNT(*) FILTER (WHERE rating_design   = 'sad'),
    COUNT(*)
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
  GROUP BY product_section
  UNION ALL
  SELECT product_section, 'handling',
    COUNT(*) FILTER (WHERE rating_handling = 'happy'),
    COUNT(*) FILTER (WHERE rating_handling = 'sad'),
    COUNT(*)
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
  GROUP BY product_section
  UNION ALL
  SELECT product_section, 'overall',
    COUNT(*) FILTER (WHERE rating_overall  = 'happy'),
    COUNT(*) FILTER (WHERE rating_overall  = 'sad'),
    COUNT(*)
  FROM public.feedback_records
  WHERE branch_id = 'chennai-main' AND created_at >= $1 AND created_at < $2
  GROUP BY product_section
) all_combos
WHERE total_count >= 5    -- ignore noise: require at least 5 submissions
ORDER BY happy_pct ASC    -- worst first
LIMIT 3;


-- ── D9: Section heatmap drill-down — demographic split ────────
-- Triggered when admin/MD clicks a red cell.
-- Shows gender + age_group breakdown for one section × dimension.

SELECT
  gender,
  age_group,
  COUNT(*)                                                    AS total,
  COUNT(*) FILTER (WHERE rating_price = 'happy')              AS happy,
  COUNT(*) FILTER (WHERE rating_price = 'sad')                AS unhappy
FROM public.feedback_records
WHERE branch_id      = 'chennai-main'
  AND product_section = $1              -- clicked section
  AND created_at      >= $2
  AND created_at      <  $3
  AND gender IS NOT NULL
GROUP BY gender, age_group
ORDER BY gender, age_group;
-- Replace rating_price with the clicked dimension column dynamically


-- ── D10: Trend analysis — daily happiness per dimension ───────
-- Powers the sentiment timeline line chart.

SELECT
  DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
  ROUND(COUNT(*) FILTER (WHERE rating_price    = 'happy')::NUMERIC / NULLIF(COUNT(*),0)*100,1) AS price_happy_pct,
  ROUND(COUNT(*) FILTER (WHERE rating_design   = 'happy')::NUMERIC / NULLIF(COUNT(*),0)*100,1) AS design_happy_pct,
  ROUND(COUNT(*) FILTER (WHERE rating_handling = 'happy')::NUMERIC / NULLIF(COUNT(*),0)*100,1) AS handling_happy_pct,
  ROUND(COUNT(*) FILTER (WHERE rating_overall  = 'happy')::NUMERIC / NULLIF(COUNT(*),0)*100,1) AS overall_happy_pct,
  COUNT(*) AS submissions
FROM public.feedback_records
WHERE branch_id  = 'chennai-main'
  AND created_at >= $1
  AND created_at <  $2
GROUP BY day
ORDER BY day ASC;


-- ── D11: Trend analysis — peak hours heatmap ─────────────────
-- hour_of_day (0-23) × day_of_week (0=Sun…6=Sat)
-- Coloured by submission volume.

SELECT
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::INT    AS hour_of_day,
  EXTRACT(DOW  FROM created_at AT TIME ZONE 'Asia/Kolkata')::INT    AS day_of_week,
  COUNT(*)                                                           AS submissions,
  ROUND(
    (
      COUNT(*) FILTER (WHERE rating_price    = 'happy') +
      COUNT(*) FILTER (WHERE rating_design   = 'happy') +
      COUNT(*) FILTER (WHERE rating_handling = 'happy') +
      COUNT(*) FILTER (WHERE rating_overall  = 'happy')
    )::NUMERIC / NULLIF(COUNT(*) * 4, 0) * 100, 1
  )                                                                  AS happiness_pct
FROM public.feedback_records
WHERE branch_id  = 'chennai-main'
  AND created_at >= $1
  AND created_at <  $2
GROUP BY hour_of_day, day_of_week
ORDER BY day_of_week, hour_of_day;


-- ── D12: Overview — response rate (MD view) ──────────────────
-- Tokens minted vs tokens used across all zones.

SELECT
  COUNT(*)                                                   AS tokens_minted,
  COUNT(*) FILTER (WHERE t.status = 'used')                  AS tokens_used,
  ROUND(
    COUNT(*) FILTER (WHERE t.status = 'used')::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                          AS response_rate_pct
FROM public.tokens t
JOIN public.zones z ON z.zone_id = t.zone_id
WHERE z.branch_id  = 'chennai-main'
  AND t.created_at >= $1
  AND t.created_at <  $2;


-- ════════════════════════════════════════════════════════════
-- SECTION E: CSV EXPORT QUERIES
-- Non-PII only. Aggregated metrics.
-- ════════════════════════════════════════════════════════════

-- ── E1: Export — submissions by zone × section × date ────────

SELECT
  DATE(fr.created_at AT TIME ZONE 'Asia/Kolkata')   AS date,
  z.zone_name,
  z.zone_type,
  fr.product_section,
  ps.display_name                                    AS section_name,
  COUNT(*)                                           AS total_submissions,
  COUNT(*) FILTER (WHERE fr.rating_price    = 'happy') AS price_happy,
  COUNT(*) FILTER (WHERE fr.rating_price    = 'neutral') AS price_neutral,
  COUNT(*) FILTER (WHERE fr.rating_price    = 'sad')   AS price_sad,
  COUNT(*) FILTER (WHERE fr.rating_design   = 'happy') AS design_happy,
  COUNT(*) FILTER (WHERE fr.rating_design   = 'neutral') AS design_neutral,
  COUNT(*) FILTER (WHERE fr.rating_design   = 'sad')   AS design_sad,
  COUNT(*) FILTER (WHERE fr.rating_handling = 'happy') AS handling_happy,
  COUNT(*) FILTER (WHERE fr.rating_handling = 'neutral') AS handling_neutral,
  COUNT(*) FILTER (WHERE fr.rating_handling = 'sad')   AS handling_sad,
  COUNT(*) FILTER (WHERE fr.rating_overall  = 'happy') AS overall_happy,
  COUNT(*) FILTER (WHERE fr.rating_overall  = 'neutral') AS overall_neutral,
  COUNT(*) FILTER (WHERE fr.rating_overall  = 'sad')   AS overall_sad
FROM public.feedback_records fr
JOIN public.zones z            ON z.zone_id    = fr.zone_id
JOIN public.product_sections ps ON ps.section_id = fr.product_section
WHERE fr.branch_id  = 'chennai-main'
  AND fr.created_at >= $1     -- date range start
  AND fr.created_at <  $2     -- date range end
  AND (fr.zone_id   = $3 OR $3 IS NULL)   -- optional zone filter
GROUP BY date, z.zone_name, z.zone_type, fr.product_section, ps.display_name
ORDER BY date DESC, z.zone_type, ps.display_name;


-- ════════════════════════════════════════════════════════════
-- SECTION F: KIOSK REALTIME SUBSCRIPTION
-- Not a SQL query — this is the Supabase Realtime filter
-- the kiosk app subscribes to, documented here for reference.
-- ════════════════════════════════════════════════════════════

-- The kiosk subscribes to:
--   table: tokens
--   event: UPDATE
--   filter: token_id=eq.{mintedTokenId}
--
-- When payload.new.status === 'used' → kiosk resets to idle.
-- When local 30s timer fires → kiosk resets to idle (token stays active).
--
-- Supabase JS SDK call (in use-kiosk-token-watcher.ts):
--   supabase
--     .channel(`token-${tokenId}`)
--     .on('postgres_changes', {
--       event: 'UPDATE',
--       schema: 'public',
--       table: 'tokens',
--       filter: `token_id=eq.${tokenId}`
--     }, handler)
--     .subscribe()


-- ════════════════════════════════════════════════════════════
-- SECTION G: USEFUL ADMIN LOOKUPS
-- ════════════════════════════════════════════════════════════

-- ── G1: Find a specific token by ID (admin lookup) ───────────

SELECT
  t.token_id,
  t.status,
  t.created_at,
  t.expires_at,
  t.used_at,
  t.revoked_at,
  z.zone_name,
  z.zone_type,
  z.product_section,
  fr.feedback_id,
  fr.rating_price,
  fr.rating_design,
  fr.rating_handling,
  fr.rating_overall
FROM public.tokens t
JOIN  public.zones z           ON z.zone_id    = t.zone_id
LEFT JOIN public.feedback_records fr ON fr.token_id  = t.token_id
WHERE t.token_id = $1;


-- ── G2: Kiosk last-seen heartbeat update ─────────────────────
-- Called by kiosk app periodically (e.g. every 5 minutes) to
-- update last_seen_at so admin dashboard can show online status.

UPDATE public.kiosks
SET last_seen_at = now()
WHERE auth_user_id = $1;  -- $1 = kiosk's Supabase Auth user_id


-- ── G3: Deactivate a kiosk (admin action) ────────────────────

UPDATE public.kiosks
SET is_active = false
WHERE kiosk_id = $1
RETURNING kiosk_id, kiosk_name;
