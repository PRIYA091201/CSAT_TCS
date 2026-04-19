-- Create browse kiosk user for testing
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
VALUES (
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'kiosk-browse@chennaisilks.local', crypt('Kiosk@1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"kiosk","branch_id":"chennai-main"}'::jsonb,
  '{"name":"Browse Kiosk"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (email) DO UPDATE
SET encrypted_password = crypt('Kiosk@1234', gen_salt('bf')),
    raw_app_meta_data = '{"provider":"email","providers":["email"],"role":"kiosk","branch_id":"chennai-main"}'::jsonb,
    email_confirmed_at = now(), updated_at = now();

-- Insert identity record
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
SELECT gen_random_uuid(), u.id, u.email,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
FROM auth.users u
WHERE u.email = 'kiosk-browse@chennaisilks.local'
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Also create a kiosks table entry
INSERT INTO public.kiosks (kiosk_id, kiosk_name, zone_id, auth_user_id, branch_id, is_active, created_by)
SELECT gen_random_uuid(), 'Browse - Sarees', '00000000-0000-0000-0000-000000000002', u.id, 'chennai-main', true, u.id
FROM auth.users u
WHERE u.email = 'kiosk-browse@chennaisilks.local'
ON CONFLICT (kiosk_id) DO NOTHING;