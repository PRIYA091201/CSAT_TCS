Kiosk MVP - Quick Start

- This MVP provides a minimal kiosk frontend that signs in with per-device kiosk credentials,
  mints a token via the mint-token edge function, and renders a QR code for the token URL.
- Public config lives at config.json. Replace placeholders after provisioning.
- To run locally:
  1. Ensure Supabase project is accessible; fill in config.json with real values.
  2. Serve the folder via a simple static server (eg. npx http-server -p 8080) from apps/kiosk.
  3. Sign in with the kiosk credentials provided by admin provisioning.

- End-to-end flow:
  - Sign in as kiosk
  - Click Mint Token
  - View QR and 30-second countdown
  - If token is consumed or expires, kiosk returns to idle automatically
