-- ============================================================
-- RUNME — Activate admin users for The Chennai Silks CSat
-- 
-- STEP 1: Go to this URL in your browser:
-- https://supabase.com/dashboard/project/mxfuufwztkgirdjjxkci/sql/new
--
-- STEP 2: Paste this ENTIRE file and click RUN
--
-- STEP 3: You should see 2 rows with role=admin/md and confirmed=true
-- ============================================================

-- Confirm email + set admin role
UPDATE auth.users
SET
  email_confirmed_at = now(),
  confirmed_at       = now(),
  raw_app_meta_data  = '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  updated_at         = now()
WHERE email = 'admin@chennaisilks.com';

-- Confirm email + set MD role  
UPDATE auth.users
SET
  email_confirmed_at = now(),
  confirmed_at       = now(),
  raw_app_meta_data  = '{"provider":"email","providers":["email"],"role":"md"}'::jsonb,
  updated_at         = now()
WHERE email = 'md@chennaisilks.com';

-- Add identity records if missing (required for login to work)
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data,
  provider, created_at, updated_at, last_sign_in_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.email,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(), now(), now()
FROM auth.users u
WHERE u.email IN ('admin@chennaisilks.com', 'md@chennaisilks.com')
ON CONFLICT (provider, provider_id) DO NOTHING;

-- VERIFY: Should show role=admin/md and confirmed=true for both rows
SELECT
  email,
  raw_app_meta_data->>'role'     AS role,
  email_confirmed_at IS NOT NULL AS email_confirmed,
  (SELECT COUNT(*) FROM auth.identities i WHERE i.user_id = u.id) AS identity_count
FROM auth.users u
WHERE email IN ('admin@chennaisilks.com', 'md@chennaisilks.com')
ORDER BY email;
