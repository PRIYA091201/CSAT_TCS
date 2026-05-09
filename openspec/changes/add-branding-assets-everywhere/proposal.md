## Why

The three apps (kiosk, customer-form, admin-dashboard) have favicon.svg and logo.svg in their public folders and use them minimally (favicon in index.html, logo in one or two components). However, they lack proper PWA manifests, apple-touch-icon references, Open Graph/Twitter Card meta tags, and consistent logo usage on all screens. This means the brand identity is incomplete when users bookmark, share links, or install the apps on mobile devices.

## What Changes

- Add `manifest.json` (web app manifest) to all 3 apps with proper icon references for installability and home-screen branding
- Add `apple-touch-icon` link tags to all 3 apps' `index.html` for iOS home screen icons
- Add Open Graph and Twitter Card meta tags with logo imagery to all 3 apps' `index.html`
- Add `<meta name="theme-color">` to all 3 apps for browser chrome theming
- Add logo to the customer-form error/timeout/already-used screens (currently missing)
- Add `onError` fallback handling to customer-form logo `<img>` tags (currently missing, unlike kiosk and admin-dashboard)
- Ensure favicon.svg is referenced consistently with proper `type` attribute across all apps

## Capabilities

### New Capabilities
- `pwa-manifest`: Web app manifest files with icon declarations for all 3 apps
- `meta-branding`: Open Graph, Twitter Card, apple-touch-icon, and theme-color meta tags across all apps
- `consistent-logo-usage`: Logo displayed on all screens/states in each app with proper error handling

### Modified Capabilities

## Impact

- **Files added**: `manifest.json` in each app's `public/` directory
- **Files modified**: `index.html` in each app (meta tags, manifest link, apple-touch-icon)
- **Files modified**: `customer-form/src/components/customer-form.tsx` (add logo to error screens, add onError handlers)
- **No breaking changes**: All additions are additive
- **No new dependencies**: Uses existing SVG assets already in each app's public folder
