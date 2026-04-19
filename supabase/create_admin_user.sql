-- ============================================================
-- Create admin user for The Chennai Silks CSat dashboard
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/mxfuufwztkgirdjjxkci/sql/new
-- ============================================================

-- Step 1: Create the admin user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@chennaisilks.com',
  crypt('Admin@1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  '{"name":"Store Admin"}'::jsonb,
  now(),
  now(),
  'authenticated',
  'authenticated'
)
ON CONFLICT (email) DO UPDATE
SET
  encrypted_password = crypt('Admin@1234', gen_salt('bf')),
  raw_app_meta_data  = '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  email_confirmed_at = now(),
  updated_at         = now();

-- Step 2: Create the MD user
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'md@chennaisilks.com',
  crypt('MD@1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"md"}'::jsonb,
  '{"name":"MD Owner"}'::jsonb,
  now(),
  now(),
  'authenticated',
  'authenticated'
)
ON CONFLICT (email) DO UPDATE
SET
  encrypted_password = crypt('MD@1234', gen_salt('bf')),
  raw_app_meta_data  = '{"provider":"email","providers":["email"],"role":"md"}'::jsonb,
  email_confirmed_at = now(),
  updated_at         = now();

-- Step 3: Also insert identity records (required for Supabase auth to work)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  created_at,
  updated_at,
  last_sign_in_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.email,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email IN ('admin@chennaisilks.com', 'md@chennaisilks.com')
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Step 4: Verify users were created with correct roles
SELECT
  email,
  raw_app_meta_data->>'role'  AS role,
  email_confirmed_at          IS NOT NULL AS confirmed,
  created_at
FROM auth.users
WHERE email IN ('admin@chennaisilks.com', 'md@chennaisilks.com')
ORDER BY email;
