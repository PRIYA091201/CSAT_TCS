-- ============================================================
-- CSat — The Chennai Silks
-- Run this in Supabase SQL Editor to activate admin users
-- https://supabase.com/dashboard/project/mxfuufwztkgirdjjxkci/sql/new
-- ============================================================

-- Step 1: Confirm email addresses (bypass email verification)
-- Step 2: Set correct roles in app_metadata
-- Step 3: Ensure identity records exist

UPDATE auth.users
SET
  email_confirmed_at = now(),
  raw_app_meta_data  = '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  updated_at         = now()
WHERE email = 'admin@chennaisilks.com';

UPDATE auth.users
SET
  email_confirmed_at = now(),
  raw_app_meta_data  = '{"provider":"email","providers":["email"],"role":"md"}'::jsonb,
  updated_at         = now()
WHERE email = 'md@chennaisilks.com';

-- Step 3: Insert identity records if missing
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

-- Step 4: Verify — should show role = admin/md and confirmed = true
SELECT
  email,
  raw_app_meta_data->>'role' AS role,
  email_confirmed_at IS NOT NULL AS email_confirmed
FROM auth.users
WHERE email IN ('admin@chennaisilks.com', 'md@chennaisilks.com')
ORDER BY email;
