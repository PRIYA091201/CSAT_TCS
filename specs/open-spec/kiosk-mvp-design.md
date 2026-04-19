# Kiosk MVP Design (OpenSpec)

## Overview
- Aligns with MVP scope in specs.md: two zones (billing and browse), 1 branch, 1 tablet kiosk for browse, per-device kiosk accounts,
  on-demand token minting via mint-token, offline mode, 30s QR countdown, 10-minute token TTL, and admin kiosk provisioning.

## System Architecture
- Frontend apps: kiosk (apps/kiosk), admin-dashboard (apps/admin-dashboard), customer-form (apps/customer-form)
- Backend: Supabase edge functions (mint-token, validate-token, submit-feedback, expire-tokens, provision-kiosk)
- Data: zones, kiosks, tokens, product_sections, feedback_records, audit_logs
- RBAC: kiosk (mint-token only), admin (provision and manage), md (read-only MD view)

## Token lifecycle (state machine)
- Minted -> Active
- Active -> Used (upon feedback submission)
- Active -> Expired (TTL elapsed)
- Active -> Revoked (admin revocation)
- Terminal states: Used, Expired, Revoked

## Kiosk UX state machine
- Idle: shows store + zone + CTA; tap → QR display
- QR-display: mint-token happens; show QR; 30s countdown; on expiry or use, return to idle
- Offline: show offline banner; retry every 10s; resume when online

## Data contracts mapping (summary)
- Zones, Kiosks, Tokens, Feedback_Records, Product_Sections, Audit_Logs
- Tokens record kiosk minting context via zone_id and token_id
- RLS policies enforce per-kiosk data isolation

## Edge Functions (per spec)
- mint-token: input zone_id; returns token_id, expires_at, zone_id, zone_type, product_section
- validate-token: public; returns valid + zone details
- submit-feedback: atomic write of feedback and token state -> 'used'
- expire-tokens: cron-based TTL enforcement
- provision-kiosk: admin provisioning path to create kiosk auth user and kiosk row

## Admin provisioning and kiosk management
- Admin UI supports: create zones, create kiosks (with zone_id, TTL, and branch), view last_seen, revoke kiosks

## Admin/MD login flows
- Admin: full access; MD: read-only view; kiosk: per-device mint-token logins

## Non-functional considerations
- Offline resilience; 30s/mint latency targets; UI responsive in 4G; accessibility

## OpenSpec alignment
- Maps to specs.md sections: MVP scope, 4.2 kiosk, 5 token lifecycle, 6 data contracts, 7 edge functions, 9 admin provisioning
