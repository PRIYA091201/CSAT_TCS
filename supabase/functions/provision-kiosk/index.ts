// ============================================================
// Edge Function: provision-kiosk
// CSat / The Chennai Silks
//
// Triggered by: Admin creates a kiosk from the admin dashboard
// Auth required: YES — admin role only. MD cannot provision.
//
// Creates a Supabase Auth user for the kiosk (machine identity),
// inserts a row in the kiosks table, writes to audit_logs.
// Returns credentials ONCE — never stored in DB.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const InputSchema = z.object({
  kiosk_name: z.string().min(1).max(100),
  zone_id:    z.string().uuid(),
  branch_id:  z.string().min(1).default('chennai-main'),
})

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Parse and validate input ──────────────────────────
    const body = await req.json()
    const input = InputSchema.parse(body)

    // ── 2. Authenticate — admin role only ────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError(401, 'missing_auth', 'Authorization header required')
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser()
    if (authError || !callerUser) {
      return jsonError(401, 'invalid_auth', 'Invalid or expired session')
    }

    const callerRole = callerUser.app_metadata?.role as string | undefined
    if (callerRole !== 'admin') {
      return jsonError(403, 'forbidden', 'Only admin role can provision kiosks')
    }

    // ── 3. Service role client for all DB + Admin API ops ────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── 4. Validate zone exists and is active ────────────────
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('zone_id, zone_type, is_active')
      .eq('zone_id', input.zone_id)
      .single()

    if (zoneError || !zone) {
      return jsonError(404, 'zone_not_found', 'Zone does not exist')
    }
    if (!zone.is_active) {
      return jsonError(400, 'zone_inactive', 'Cannot provision kiosk for an inactive zone')
    }

    // ── 5. Generate kiosk credentials ───────────────────────
    const kioskSlug = input.kiosk_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30)

    const kioskEmail    = `kiosk-${kioskSlug}-${Date.now()}@chennaisilks.local`
    const kioskPassword = generateSecurePassword()

    // ── 6. Create Supabase Auth user for kiosk ───────────────
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email:    kioskEmail,
      password: kioskPassword,
      email_confirm: true,
      app_metadata: {
        role:      'kiosk',
        branch_id: input.branch_id,
      },
    })

    if (createUserError || !authData.user) {
      console.error('[provision-kiosk] Auth user creation error:', createUserError)
      return jsonError(500, 'auth_create_failed', 'Failed to create kiosk auth user')
    }

    const kioskAuthUserId = authData.user.id

    // ── 7. Insert kiosks row ─────────────────────────────────
    const { data: kiosk, error: kioskInsertError } = await supabase
      .from('kiosks')
      .insert({
        kiosk_name:   input.kiosk_name,
        zone_id:      input.zone_id,
        auth_user_id: kioskAuthUserId,
        branch_id:    input.branch_id,
        is_active:    true,
        created_by:   callerUser.id,
      })
      .select('kiosk_id')
      .single()

    if (kioskInsertError || !kiosk) {
      // Rollback: delete the auth user we just created
      await supabase.auth.admin.deleteUser(kioskAuthUserId)
      console.error('[provision-kiosk] Kiosk insert error:', kioskInsertError)
      return jsonError(500, 'kiosk_insert_failed', 'Failed to create kiosk record')
    }

    // ── 8. Write audit log ───────────────────────────────────
    await supabase.from('audit_logs').insert({
      user_id:       callerUser.id,
      action:        'provision_kiosk',
      resource_type: 'kiosk',
      resource_id:   kiosk.kiosk_id,
      context: {
        kiosk_name: input.kiosk_name,
        zone_id:    input.zone_id,
        branch_id:  input.branch_id,
        zone_type:  zone.zone_type,
      },
    })

    // ── 9. Return credentials (shown once, never stored) ────
    return jsonSuccess({
      kiosk_id: kiosk.kiosk_id,
      email:    kioskEmail,
      password: kioskPassword,
    })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, 'invalid_input', err.errors[0]?.message ?? 'Invalid input')
    }
    console.error('[provision-kiosk] Unexpected error:', err)
    return jsonError(500, 'server_error', 'An unexpected error occurred')
  }
})

// ── Helpers ───────────────────────────────────────────────────

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

function jsonSuccess(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
