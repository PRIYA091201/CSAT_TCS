## Context

Three Vite + React + TypeScript apps (admin-dashboard, customer-form, kiosk) serve "The Chennai Silks" brand. Each already has `favicon.svg` (49x49 circular emblem) and `logo.svg` (539x109 wide banner with yellow background) in their `public/` directories. Currently these are referenced only via a `<link rel="icon">` in index.html and a single `<img>` component per app. The apps lack PWA support, social sharing metadata, and consistent logo presence across all UI states.

## Goals / Non-Goals

**Goals:**
- Every app has a `manifest.json` enabling PWA installation with proper icons
- Every app's `index.html` includes apple-touch-icon, theme-color, and OG/Twitter meta tags
- Logo appears on all customer-form screens (including error/timeout states)
- Consistent `onError` fallback handling on all logo `<img>` elements

**Non-Goals:**
- Converting SVG to PNG/ICO formats (browsers support SVG favicons natively)
- Implementing full PWA service worker / offline functionality
- Redesigning existing logo or favicon artwork
- Adding new SVG variants or sizes beyond existing assets

## Decisions

### 1. Use SVG directly in manifest.json icon declarations

**Decision**: Reference `/favicon.svg` with `"type": "image/svg+xml"` and `"sizes": "any"` in manifest icons.

**Rationale**: All target browsers for kiosk/form/dashboard scenarios support SVG icons in manifests. Avoids needing to generate multiple PNG sizes. SVGs scale perfectly to any resolution.

**Alternative considered**: Generate PNG icons at 192x192 and 512x512 from SVG. Rejected because it adds build complexity and the SVG is already available.

### 2. Reuse existing `/logo.svg` for OG image via relative URL

**Decision**: Set `<meta property="og:image" content="/logo.svg" />` using the existing logo asset.

**Rationale**: Avoids asset duplication. The logo.svg at 539x109 provides adequate branding for link previews. Some social platforms may not render SVG previews perfectly, but this is acceptable given the non-goal of creating PNG variants.

**Alternative considered**: Create a separate `og-image.png` at 1200x630. Rejected as out of scope for this change.

### 3. Theme color derived from brand yellow

**Decision**: Use `#F5C518` (the yellow from the logo background) as the theme-color for all apps.

**Rationale**: Consistent brand identity in browser chrome. The yellow is the dominant background color in the logo SVG.

### 4. Shared manifest structure, per-app names

**Decision**: Each app gets its own `manifest.json` with app-specific `name` and `short_name` but identical icon references.

**Rationale**: Each app serves a different purpose (kiosk display, customer form, admin dashboard) and should identify itself appropriately when installed.

### 5. Add logo with onError to customer-form error screens

**Decision**: Add `<img src="/logo.svg" ... onError={...} />` pattern (matching kiosk/admin-dashboard style) to all customer-form screen states that currently lack it.

**Rationale**: Maintains brand presence during error states. The onError fallback ensures graceful degradation if the asset fails to load.

## Risks / Trade-offs

- **[SVG OG image compatibility]** → Some social platforms (Facebook, LinkedIn) may not render SVG og:image. Mitigation: Acceptable for now; can add PNG variant in future change if social sharing becomes a priority.
- **[Manifest without service worker]** → The manifest enables "Add to Home Screen" but without a service worker the app won't work offline. Mitigation: Explicitly a non-goal; PWA offline support can be added separately.
- **[Theme color mismatch]** → The yellow theme-color may look unexpected on admin-dashboard which has a darker UI. Mitigation: Can be customized per-app later if needed; for now brand consistency is prioritized.
