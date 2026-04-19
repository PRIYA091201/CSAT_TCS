// ============================================================
// Edge Function: mint-token
// CSat / The Chennai Silks
//
// Triggered by: kiosk tap (browse) or admin generates billing QR
// Auth required: YES — kiosk role (browse) or admin role (billing)
// Anonymous callers are rejected.
//
// product_section is ALWAYS resolved server-side from zone config.
// The client cannot pass or override it.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const InputSchema = z.object({
  zone_id: z.string().uuid(),
})

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Parse and validate input ──────────────────────────
    const body = await req.json()
    const input = InputSchema.parse(body)

    // ── 2. Authenticate caller ───────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonError(401, 'missing_auth', 'Authorization header required')
    }

    // Use caller's JWT to verify role
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await callerClient.auth.getUser()
    if (authError || !user) {
      return jsonError(401, 'invalid_auth', 'Invalid or expired token')
    }

    const role = user.app_metadata?.role as string | undefined
    if (role !== 'kiosk' && role !== 'admin') {
      return jsonError(403, 'forbidden', 'Only kiosk or admin roles can mint tokens')
    }

    // ── 3. Service role client for DB writes ─────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── 4. Fetch and validate zone ───────────────────────────
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('zone_id, zone_type, branch_id, product_section, token_ttl_min, is_active')
      .eq('zone_id', input.zone_id)
      .single()

    if (zoneError || !zone) {
      return jsonError(404, 'zone_not_found', 'Zone does not exist')
    }
    if (!zone.is_active) {
      return jsonError(400, 'zone_inactive', 'Zone is not active')
    }

    // ── 5. Role-zone type validation ─────────────────────────
    // Kiosk role can only mint for browse zones
    // Admin role can only mint for billing zones
    if (role === 'kiosk' && zone.zone_type !== 'browse') {
      return jsonError(403, 'forbidden', 'Kiosk role can only mint tokens for browse zones')
    }
    if (role === 'admin' && zone.zone_type !== 'billing') {
      return jsonError(403, 'forbidden', 'Admin role can only mint tokens for billing zones via this function')
    }

    // ── 6. Mint token ────────────────────────────────────────
    const expiresAt = new Date(
      Date.now() + zone.token_ttl_min * 60 * 1000
    ).toISOString()

    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .insert({
        zone_id:    zone.zone_id,
        status:     'active',
        expires_at: expiresAt,
      })
      .select('token_id, expires_at')
      .single()

    if (tokenError || !token) {
      console.error('[mint-token] Insert error:', tokenError)
      return jsonError(500, 'insert_failed', 'Failed to mint token')
    }

    // ── 7. Return token + zone details ───────────────────────
    return jsonSuccess({
      token_id:        token.token_id,
      expires_at:      token.expires_at,
      zone_id:         zone.zone_id,
      zone_type:       zone.zone_type,
      product_section: zone.product_section ?? '',
    })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, 'invalid_input', err.errors[0]?.message ?? 'Invalid input')
    }
    console.error('[mint-token] Unexpected error:', err)
    return jsonError(500, 'server_error', 'An unexpected error occurred')
  }
})

// ── Helpers ───────────────────────────────────────────────────

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
