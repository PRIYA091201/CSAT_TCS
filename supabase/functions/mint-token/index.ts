// ============================================================
// Edge Function: mint-token
// CSat / The Chennai Silks
//
// Triggered by: kiosk tap (browse) or admin generates billing QR
// Auth required: YES - kiosk role (browse) or admin role (billing)
//
// Note: JWT is decoded manually (not verified locally) to avoid
// ES256 algorithm issues with old client libraries. The Supabase
// gateway already verifies the signature before the function runs.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JwtPayload {
  sub?: string
  email?: string
  app_metadata?: {
    role?: string
    branch_id?: string
  }
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    // base64url decode
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4)
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

// Legacy HS256 JWT verifier (optional)
async function verifyLegacyJwtHS256(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [headB64, payloadB64, sigB64] = parts
    // Decode header to verify alg
    const headJson = JSON.parse(b64urlDecodeToString(headB64))
    const alg = headJson?.alg ?? ''
    if (alg !== 'HS256') return false
    // Optional: log when legacy HS256 verification path is taken
    console.info('[mint-token] Attempting HS256 legacy verification for token')
    const data = `${headB64}.${payloadB64}`
    const dataBytes = new TextEncoder().encode(data)
    // Import legacy secret key for HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign', 'verify']
    )
    // Decode provided signature
    const providedSig = base64UrlToBytes(sigB64)
    // Compute signature with the secret
    const computed = await crypto.subtle.sign(
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      key,
      dataBytes
    )
    const computedBytes = new Uint8Array(computed)
    if (computedBytes.length !== providedSig.length) return false
    let mismatch = 0
    for (let i = 0; i < computedBytes.length; i++) {
      mismatch |= computedBytes[i] ^ providedSig[i]
    }
    return mismatch === 0
  } catch {
    return false
  }
}

function b64urlDecodeToString(b64u: string): string {
  const base64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  const padded = base64 + '='.repeat((4 - pad) % 4)
  return atob(padded)
}

function base64UrlToBytes(b64u: string): Uint8Array {
  const base64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  const padded = base64 + '='.repeat((4 - pad) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json()
    if (!body.zone_id || typeof body.zone_id !== 'string') {
      return jsonError(400, 'invalid_input', 'zone_id is required')
    }

    // Extract token from Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonError(401, 'missing_auth', 'Authorization header required')
    }
    const token = authHeader.replace('Bearer ', '')

    // Decode JWT manually (no signature verification - trust the Supabase gateway)
    let payload = decodeJwt(token)
    if (!payload) {
      // Attempt legacy HS256 verification if configured
      const legacySecret = Deno.env.get('LEGACY_JWT_SECRET')
      if (legacySecret) {
        const okLegacy = await verifyLegacyJwtHS256(token, legacySecret)
        if (okLegacy) {
          payload = decodeJwt(token)
        } else {
          return jsonError(401, 'invalid_auth', 'Invalid JWT')
        }
      } else {
        return jsonError(401, 'invalid_auth', 'Invalid JWT')
      }
    }
    if (!payload) {
      return jsonError(401, 'invalid_auth', 'Invalid JWT')
    }

    const role = payload.app_metadata?.role
    if (role !== 'kiosk' && role !== 'admin') {
      return jsonError(403, 'forbidden', 'Only kiosk or admin roles can mint tokens')
    }

    // Service role client for DB writes
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch and validate zone
    const { data: zone, error: zoneError } = await supabase
      .from('zones')
      .select('zone_id, zone_type, branch_id, product_section, token_ttl_min, is_active')
      .eq('zone_id', body.zone_id)
      .single()

    if (zoneError || !zone) {
      return jsonError(404, 'zone_not_found', 'Zone does not exist')
    }
    if (!zone.is_active) {
      return jsonError(400, 'zone_inactive', 'Zone is not active')
    }

    // Role-zone type validation
    if (role === 'kiosk' && zone.zone_type !== 'browse') {
      return jsonError(403, 'forbidden', 'Kiosk role can only mint tokens for browse zones')
    }

    // Mint token
    const expiresAt = new Date(Date.now() + zone.token_ttl_min * 60 * 1000).toISOString()

    const { data: tokenData, error: tokenError } = await supabase
      .from('tokens')
      .insert({
        zone_id: zone.zone_id,
        status: 'active',
        expires_at: expiresAt,
      })
      .select('token_id, expires_at')
      .single()

    if (tokenError || !tokenData) {
      console.error('[mint-token] Insert error:', tokenError)
      return jsonError(500, 'insert_failed', 'Failed to mint token')
    }

    return jsonSuccess({
      token_id: tokenData.token_id,
      expires_at: tokenData.expires_at,
      zone_id: zone.zone_id,
      zone_type: zone.zone_type,
      product_section: zone.product_section ?? '',
    })
  } catch (err) {
    console.error('[mint-token] Unexpected error:', err)
    return jsonError(500, 'server_error', 'An unexpected error occurred')
  }
})

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
