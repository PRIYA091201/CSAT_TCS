# agenta.md — Agent behaviour rules for CSat project

---

## Identity

You are building the **CSat** project for **The Chennai Silks**. Always read `specs.md` for the full SDD before writing any code. Always read `skills.md` for reusable patterns before implementing a feature.

---

## Decision authority

- **specs.md** is the source of truth for WHAT to build: features, data model, user stories, acceptance criteria.
- **agenta.md** (this file) is the source of truth for HOW to build: tech choices, code style, file conventions, agent behaviour.
- **skills.md** is the source of truth for reusable patterns: component recipes, prompt templates, testing patterns.
- If specs.md and agenta.md conflict, specs.md wins on feature decisions, agenta.md wins on implementation decisions.

---

## Tech stack (enforced)

| Layer | Choice | Non-negotiable? |
|-------|--------|-----------------|
| Frontend | React + TypeScript + Tailwind CSS | Yes. No Next.js, no Remix, no Angular, no Vue. |
| Build tool | Vite | Yes. No webpack, no Create React App, no Parcel. |
| UI components | shadcn/ui | Yes. Accessible components built on Radix UI. Copy/paste into codebase, not installed as dependency. |
| Backend | Deno TypeScript (Supabase Edge Functions) | Yes. No Express, no Fastify, no Node.js runtime. |
| Database | Supabase (PostgreSQL + Auth + Realtime) | Yes. No MongoDB, no MySQL. |
| State management | TanStack Query (react-query) for server state, React useState/useReducer for local state | Yes. No Redux, no Zustand, no MobX. |
| Validation | Zod | Yes. No Yup, no Joi. |
| QR generation | qrcode.react | Yes. Client-side only. |
| Package manager | pnpm | Yes. No npm, no yarn. |
| Monorepo | pnpm workspaces (+ Turborepo if needed) | Yes. |

---

## Vite configuration (enforced)

Each React app (`customer-form`, `kiosk`, `admin-dashboard`) uses Vite with identical base configuration.

**Standard `vite.config.ts` for all apps:**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src')
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'query-vendor': ['@tanstack/react-query']
        }
      }
    }
  },
  server: {
    port: 3000 // customer-form: 3000, kiosk: 3001, admin-dashboard: 3002
  }
})
```

**Why these settings:**
- Path aliases (`@` and `@shared`) eliminate relative import hell
- Source maps enabled for production debugging
- Manual chunks split vendor code for better browser caching
- Port assignment prevents dev server conflicts

**Import conventions with aliases:**
```typescript
// ✅ Correct — use aliases
import { Button } from '@/components/button'
import { tokenSchema } from '@shared/types/token'

// ❌ Wrong — no relative paths crossing directories
import { Button } from '../../../components/button'
import { tokenSchema } from '../../../../packages/shared/src/types/token'
```

**Agent must:**
- Create identical `vite.config.ts` in all three app directories during setup
- Change only the `server.port` value (3000, 3001, 3002)
- Use `@` for local imports, `@shared` for shared package imports
- Never use relative paths like `../../` to access shared code

---

## shadcn/ui configuration (enforced)

shadcn/ui is a collection of accessible, customizable components built on Radix UI primitives. Unlike traditional component libraries, shadcn/ui components are **copied into your codebase** rather than installed as a package dependency.

**Initial setup (run once per app):**

```bash
# From apps/customer-form, apps/kiosk, or apps/admin-dashboard
pnpm dlx shadcn-ui@latest init
```

**Setup prompts — use these exact answers:**
- TypeScript: Yes
- Style: Default
- Base color: Slate
- CSS variables: Yes
- Tailwind config: tailwind.config.ts
- Components location: `@/components/ui`
- Utils location: `@/lib/utils`
- React Server Components: No
- Write config: Yes

This creates:
- `components/ui/` directory for shadcn components
- `lib/utils.ts` with `cn()` helper for conditional classes
- `components.json` config file
- Updated `tailwind.config.ts` with CSS variables for theming

**Adding components:**

```bash
# From any app directory
pnpm dlx shadcn-ui@latest add button
pnpm dlx shadcn-ui@latest add card
pnpm dlx shadcn-ui@latest add dialog
```

Each component is copied into `src/components/ui/` as source code. You own it and can modify it.

**Recommended components for CSat:**

| Component | Used in | Purpose |
|-----------|---------|---------|
| `button` | All apps | Primary/secondary/outline button variants |
| `card` | Dashboard | Metric cards, zone cards |
| `dialog` | Dashboard | Confirmation dialogs (token revocation, 2FA setup) |
| `input` | Dashboard | Email, password fields for auth |
| `label` | Dashboard | Form field labels |
| `table` | Dashboard | Token list, feedback records |
| `badge` | Dashboard | Status badges (active/expired/used/revoked) |
| `toast` | All apps | Success/error notifications |
| `select` | Dashboard | Dropdowns (zone type, product section) |
| `alert` | Customer form | Error messages, timeout page |

**Usage pattern:**

```tsx
// ✅ Correct — import from ui/
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// ❌ Wrong — never import from shadcn-ui package
import { Button } from "shadcn-ui"  // doesn't exist
```

**CSS variables theming:**

shadcn/ui uses CSS variables defined in `app.css`:

```css
/* Light mode */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... */
  }
}
```

**Agent must:**
- Run `pnpm dlx shadcn-ui@latest init` in each app directory during Sprint 1 setup
- Add components as needed with `pnpm dlx shadcn-ui@latest add [component]`
- Never modify `components.json` or `lib/utils.ts` manually
- Use shadcn components for all admin dashboard UI (buttons, forms, tables, dialogs)
- Customer form can use shadcn components for structural elements (Card, Alert) but emoji tap selectors are custom
- Never install shadcn-ui as a package dependency — it's a code generator, not a library

## Auth model (enforced)

Two separate Supabase Auth identities. Never merge them.

| Identity | Account | Auth method | Session | Role | Created by |
|----------|---------|------------|---------|------|------------|
| Browse kiosk | `kiosk-browse@chennaisilks.local` | Email + password, no 2FA | Persistent refresh token on tablet. | `kiosk` | Admin dashboard → `provision-kiosk` Edge Function |
| Billing kiosk | `kiosk-billing@chennaisilks.local` | Email + password, no 2FA | Persistent refresh token on tablet. | `kiosk` | Admin dashboard → `provision-kiosk` Edge Function |
| Store Admin | `admin@chennaisilks.com` (example) | Email + password + TOTP 2FA | Short-lived JWT. Expires. | `admin` | Manual in Supabase Auth dashboard |
| MD / Owner | `md@chennaisilks.com` (example) | Email + password + TOTP 2FA | Short-lived JWT. Expires. | `md` | Manual in Supabase Auth dashboard |

**Kiosk provisioning flow**: Admin creates kiosk in dashboard → `provision-kiosk` Edge Function creates Supabase Auth user + inserts `kiosks` row → admin sees credentials once → IT sets tablet `.env` → tablet auto-signs in on every boot. Admin logging off has zero effect on any kiosk session.

**Role claims**: stored in Supabase `app_metadata` (not `user_metadata`). Use `auth.jwt() -> 'app_metadata' ->> 'role'` in RLS policies.

**RLS role permissions**:
- `kiosk` → INSERT tokens only (via Edge Function service role). No SELECT on feedback_records.
- `admin` → SELECT/INSERT/UPDATE on zones, tokens (revoke), feedback_records. No DELETE.
- `md` → SELECT only on all tables. No INSERT, UPDATE, DELETE.
- `anon` → INSERT on feedback_records (customer form). SELECT active tokens only (validate-token).

---

## Data schema additions (enforced)

Beyond the tables in specs.md §6, the agent must create:

### audit_logs table

```sql
CREATE TABLE audit_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  action TEXT NOT NULL,  -- 'revoke_token', 'create_zone', 'provision_kiosk', 'export_csv'
  resource_type TEXT,    -- 'token', 'zone', 'kiosk', 'export'
  resource_id UUID,      -- ID of affected resource
  context JSONB,         -- Structured data: old/new values, reason, IP (if available from edge)
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for querying by user or time
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- RLS: Admin and MD can SELECT their own logs. No UPDATE, no DELETE.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_own_logs" ON audit_logs
FOR SELECT TO authenticated
USING (
  auth.jwt() -> 'app_metadata' ->> 'role' IN ('admin', 'md')
);

-- No INSERT policy for users — only Edge Functions insert via service role
-- No UPDATE or DELETE policies — logs are immutable
```

**When to log:**
- Token revocation (action='revoke_token', resource_id=token_id, context={reason, old_status})
- Zone creation/update (action='create_zone'/'update_zone', resource_id=zone_id, context={changes})
- Kiosk provisioning (action='provision_kiosk', resource_id=kiosk_id, context={kiosk_name, zone_id})
- CSV exports (action='export_csv', context={date_range, zone_filter, row_count})
- 2FA enable/disable (action='enable_2fa'/'disable_2fa', context={method})

**Never log:**
- Customer feedback submissions (not admin actions)
- Token minting (too high volume, not security-relevant)
- Token validation checks (read-only, not state changes)

**Agent must:**
- Insert audit log entry in every Edge Function that performs admin actions
- Use service role key for INSERT (bypass RLS)
- Include structured context in JSONB, not free-text
- Create migration `003_audit_logs.sql` in Sprint 1

---

## RLS policies (enforced)

All database access is governed by Row Level Security policies. These are PostgreSQL policies, not application-level checks.

**Critical RLS rules:**

1. **Role claims live in `app_metadata`, not `user_metadata`**
   - Every RLS policy MUST read role from `auth.jwt() -> 'app_metadata' ->> 'role'`
   - Never use `user_metadata` — it can be modified by the user
   - Kiosk provisioning sets `app_metadata` via Supabase Admin API

2. **Anonymous customers have zero table access**
   - Customer form uses Edge Functions for all operations
   - `validate-token` and `submit-feedback` run with service role key
   - No direct database queries from customer form client code

3. **Admin scope is branch-limited** (future-proofing)
   - `SELECT` policies filter by `branch_id = auth.jwt() -> 'app_metadata' ->> 'branch_id'`
   - MVP has single branch, but policy structure supports multi-branch

4. **MD is read-only across all branches**
   - `SELECT` allowed on zones, tokens, feedback_records, product_sections
   - No INSERT, UPDATE, DELETE policies for `md` role
   - Cross-zone comparison requires SELECT across all zones

5. **Kiosks can only mint tokens via Edge Functions**
   - Kiosk role has no direct INSERT policy on tokens table
   - `mint-token` Edge Function uses service role key to write
   - Prevents local token generation bypassing validation

**Policy template pattern:**

```sql
-- Example: Admin can SELECT zones in their branch
CREATE POLICY "admin_select_zones" ON zones
FOR SELECT
TO authenticated
USING (
  auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  AND branch_id = auth.jwt() -> 'app_metadata' ->> 'branch_id'
);

-- Example: MD can SELECT all zones (read-only, no branch filter)
CREATE POLICY "md_select_zones" ON zones
FOR SELECT
TO authenticated
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'md');

-- Example: Kiosk has no direct table policies (uses Edge Functions)
-- No policies created for 'kiosk' role on tokens table
```

**Agent must:**
- Create all RLS policies in `supabase/migrations/002_rls_policies.sql`
- Always use `auth.jwt() -> 'app_metadata' ->> 'role'` for role checks
- Never create policies that allow anonymous users direct table access
- Test policies fail correctly (admin cannot see MD-only data, kiosk cannot INSERT directly)

---

## Edge Function authentication (enforced)

Each Edge Function has a specific authentication requirement:

| Function | Auth required? | Allowed roles | Service role key? |
|----------|---------------|---------------|-------------------|
| `mint-token` | Yes | `kiosk`, `admin` | Uses service role for DB writes |
| `validate-token` | No (anonymous) | Anyone | Uses service role for DB reads |
| `submit-feedback` | No (anonymous) | Anyone | Uses service role for DB writes |
| `provision-kiosk` | Yes | `admin` only | Uses Admin API + service role |
| `expire-tokens` | **Cron job** | **No HTTP auth** | **Uses service role** |

**expire-tokens special case:**

This function runs as a **Supabase cron job**, not via HTTP request. It has no bearer token, no JWT, no role claim.

```typescript
// supabase/functions/expire-tokens/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Cron jobs use service role key from environment
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // No auth.jwt() available
)

// No req.headers.authorization check — cron has no JWT
// RLS policies don't apply because service role bypasses RLS

export default async function expireTokens() {
  const now = new Date().toISOString()
  
  // Update all active tokens where expires_at < now
  const { error } = await supabase
    .from('tokens')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .lt('expires_at', now)
  
  if (error) console.error('expire-tokens error:', error)
  return { expired_count: result.length }
}
```

**Cron configuration (supabase/config.toml):**

```toml
[functions.expire-tokens]
cron = "*/5 * * * *"  # Every 5 minutes
```

**Agent must:**
- Never add JWT validation to `expire-tokens` — it's a cron job, not an HTTP endpoint
- Use service role key for all cron functions
- Schedule in `config.toml`, not via HTTP trigger
- Log all cron runs with timestamp + expired count

---

## Localization structure (enforced)

**All three apps have a `locales/` directory** with identical structure:

```
apps/
├── customer-form/src/locales/en.json
├── kiosk/src/locales/en.json
└── admin-dashboard/src/locales/en.json
```

Each app has its own locale file because the strings are app-specific:
- Customer form: feedback questions, error messages, confirmation text
- Kiosk: idle screen CTA, QR instructions, offline banner
- Admin dashboard: zone config labels, metric names, export buttons

**Agent must:**
- Create `src/locales/en.json` in ALL three apps during Sprint 1 setup
- Never share a single locale file across apps
- Add new keys when building features (see skills.md for complete structure)
- Use `t('key.nested.path')` helper, never hardcoded strings

**Tamil support (deferred to post-MVP):**
- Same key structure in `ta.json`
- Swap import in `lib/i18n.ts`
- No code changes required

---

## Route structure (enforced)

### Customer form routes (`apps/customer-form`)

All routes use React Router v6:

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

<Routes>
  <Route path="/f/:zoneId/:tokenId" element={<FeedbackPage />} />
  <Route path="/timeout" element={<TimeoutPage />} />
  <Route path="/thankyou" element={<ThankYouPage />} />
  <Route path="/error" element={<ErrorPage />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

**URL parameters:**
- `:zoneId` — UUID from QR
- `:tokenId` — UUID from QR
- Optional query param: `?pos_section=sarees` (future POS integration, MVP ignores this)

**Navigation rules:**
- Token expired → `/timeout?zone=billing` or `/timeout?zone=browse`
- Token used → `/thankyou`
- Token revoked → `/error?code=revoked`
- Invalid token → `/error?code=invalid`

### Kiosk routes (`apps/kiosk`)

Single-page app, no routing. State machine via React state:

```tsx
type KioskState = 'idle' | 'qr-display' | 'offline'
const [state, setState] = useState<KioskState>('idle')
```

No URL changes. Kiosk lives at `/` always.

### Admin dashboard routes (`apps/admin-dashboard`)

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/setup-2fa" element={<Setup2FAPage />} />
  <Route element={<ProtectedLayout />}>  {/* Requires auth */}
    <Route path="/" element={<DashboardHome />} />
    <Route path="/zones" element={<ZoneConfigPage />} />
    <Route path="/zones/:zoneId" element={<ZoneDashboard />} />
    <Route path="/kiosks" element={<KioskManagementPage />} />
    <Route path="/export" element={<ExportPage />} />
    <Route path="/md-view" element={<MDCrossZoneView />} />  {/* MD only */}
  </Route>
  <Route path="*" element={<NotFound />} />
</Routes>
```

**Agent must:**
- Use React Router v6 (no v5 syntax)
- Never use hash routing (`HashRouter`) — use `BrowserRouter`
- Protected routes wrapped in `<ProtectedLayout>` that checks Supabase auth session
- MD-only routes check `role === 'md'` inside ProtectedLayout

---

## Accessibility (WCAG 2.1 AA — non-negotiable)

**This is a hard requirement, not a "nice to have". Every UI component must meet these standards.**

### Always enforce:

1. **Touch targets ≥ 48dp** (CSS pixels)
   - All buttons, tap selectors, links: `min-height: 48px` or `min-h-12` in Tailwind
   - Emoji rating buttons: 52px minimum (exceeds standard for safety)
   - Admin form inputs: 44px minimum height

2. **Semantic HTML**
   - Buttons are `<button>`, not `<div onclick>`
   - Form fields have `<label>` with matching `for` attribute
   - Main content in `<main>`, navigation in `<nav>`
   - Headings in order (h1 → h2 → h3, no skipping levels)

3. **ARIA attributes where needed**
   - Toggle buttons: `aria-pressed="true|false"`
   - Loading states: `aria-busy="true"`
   - Form errors: `aria-invalid="true"` + `aria-describedby` linking to error message
   - Screen reader text: `<span class="sr-only">` for visually hidden labels

4. **Keyboard navigation**
   - All interactive elements reachable via Tab
   - Modal dialogs trap focus (no tabbing outside)
   - Escape key closes modals and dropdowns
   - Admin dashboard fully keyboard-navigable

5. **Color contrast**
   - Text on background: minimum 4.5:1 ratio
   - Large text (18px+): minimum 3:1 ratio
   - Never use color alone to convey information (add icons or text labels)

6. **Focus indicators**
   - Visible focus ring on all interactive elements
   - Use Tailwind `focus:ring-2 focus:ring-offset-2` pattern
   - Never `outline: none` without a replacement focus style

### Never do:

- ❌ Tap targets below 48dp
- ❌ Color-only status indicators (use icon + color)
- ❌ Missing alt text on images
- ❌ Placeholder text as labels (use real `<label>` elements)
- ❌ Auto-playing content without pause control
- ❌ Time limits without extension option (QR countdown is exempt — customer can re-tap)

**Testing checklist (Sprint 3):**
- Tab through entire customer form without mouse
- Test with screen reader (NVDA on Windows or VoiceOver on Mac)
- Verify all form errors announced to screen readers
- Check color contrast with WebAIM Contrast Checker

---

## Testing strategy (enforced)

### What gets tested:

| Layer | Test type | Tool | Coverage target |
|-------|-----------|------|-----------------|
| Edge Functions | Unit tests | Deno test | 100% of business logic paths |
| React hooks (with logic) | Unit tests | Vitest + React Testing Library | 80%+ of custom hooks |
| Zod schemas | Unit tests (via hook tests) | Vitest | All validation rules |
| RLS policies | SQL assertion tests | pgTAP or manual SQL | All policies |
| UI components | Manual QA + acceptance testing | Human testing | All user stories |

### What does NOT get tested in MVP:

- ❌ Component visual regression tests
- ❌ E2E tests (Playwright, Cypress)
- ❌ Load testing
- ❌ Lighthouse CI performance scores

### Test file conventions:

```
src/
├── hooks/
│   ├── use-token-validation.ts
│   └── use-token-validation.test.ts  ← Co-located
├── lib/
│   ├── helpers.ts
│   └── helpers.test.ts
└── components/
    └── tap-selector.tsx  ← No test file (manual QA only)
```

### Edge Function test pattern:

```typescript
// supabase/functions/validate-token/validate-token.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"

Deno.test("validate-token returns error for expired token", async () => {
  const mockToken = { status: 'expired', expires_at: '2024-01-01' }
  const result = validateTokenLogic(mockToken)
  assertEquals(result.valid, false)
  assertEquals(result.error_code, 'expired')
})
```

### RLS policy test pattern:

```sql
-- supabase/tests/rls_policies.test.sql
BEGIN;
SELECT plan(3);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"app_metadata": {"role": "admin", "branch_id": "chennai-main"}}';

SELECT results_eq(
  'SELECT zone_id FROM zones WHERE branch_id = ''chennai-main''',
  ARRAY['zone-uuid-1', 'zone-uuid-2'],
  'Admin can see zones in their branch'
);

-- Test that admin cannot see other branches
SET LOCAL request.jwt.claims TO '{"app_metadata": {"role": "admin", "branch_id": "delhi-branch"}}';
SELECT is_empty(
  'SELECT zone_id FROM zones WHERE branch_id = ''chennai-main''',
  'Admin cannot see zones from other branches'
);

SELECT finish();
ROLLBACK;
```

**Agent must:**
- Write Deno tests for all Edge Functions before marking Sprint 1 complete
- Test both happy path and all error codes (expired, used, revoked, invalid)
- Write RLS tests that assert failures (e.g., kiosk role cannot INSERT tokens directly)
- Never skip error state tests — every error code path must have a test
- Mark components as "manual QA" in comments, not "untested"

---

## Project structure (enforced)

```
CSat/
├── agenta.md
├── specs.md
├── skills.md
├── docs/
│   └── decisions.md
├── apps/
│   ├── customer-form/
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── pages/         # Route pages
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── lib/           # Utilities, helpers
│   │   │   └── locales/       # en.json (future: ta.json)
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   ├── kiosk/
│   │   ├── src/
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── admin-dashboard/
│       ├── src/
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/         # Zod schemas + TypeScript types
│       │   ├── constants/     # Enums, config values
│       │   └── supabase/      # Supabase client factory
│       └── package.json
├── supabase/
│   ├── migrations/            # Numbered SQL files
│   ├── functions/             # Edge Functions (Deno)
│   │   ├── mint-token/
│   │   ├── validate-token/
│   │   ├── submit-feedback/
│   │   └── expire-tokens/
│   ├── seed.sql               # Initial product sections + test zones
│   └── config.toml
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

---

## Coding rules

### TypeScript
- `strict: true` in all tsconfig files. No exceptions.
- No `any` type. Use `unknown` and type-narrow.
- `const` by default. `let` only when reassignment is genuinely needed. Never `var`.
- Prefer `type` over `interface` unless extending is needed.
- All function parameters and return types must be explicitly typed. No implicit `any`.

### React
- Functional components only. No class components. Ever.
- One component per file. File name = component name in kebab-case (`emoji-rating-row.tsx` exports `EmojiRatingRow`).
- Component names in PascalCase. Hook names start with `use`.
- Props destructured in function signature: `function Button({ label, onClick }: ButtonProps)`
- No inline styles except for truly dynamic values (e.g., computed widths). Use Tailwind classes.
- Every component that can fail gets an Error Boundary wrapper.
- No `useEffect` for data fetching. Use TanStack Query.

### Supabase
- All DB queries go through the shared Supabase client in `packages/shared/src/supabase/`.
- Never raw SQL in frontend code. Use Supabase client methods (`.from().select()` etc).
- Edge Functions are Deno TypeScript. Follow Supabase Edge Function conventions.
- All Edge Functions validate input with Zod before processing.
- Token operations (validate + update) must be atomic. Use Supabase RPC or transactions.
- RLS policies are the security layer. Never trust client-side checks alone.

### File naming
- Files: `kebab-case.tsx`, `kebab-case.ts`
- Components: `PascalCase` (exported name)
- Hooks: `use-kebab-case.ts` → exports `useKebabCase`
- Types: `kebab-case.types.ts`
- Constants: `kebab-case.constants.ts`
- Test files: `kebab-case.test.ts` (co-located with source)

### Strings and localisation
- All user-facing strings go in `src/locales/en.json`. Never hardcode text in components.
- Use a simple `t('key')` helper function that reads from the locale file.
- This makes Tamil support a config change, not a code change.

### Error handling
- Every API call must handle: loading, success, and error states.
- Customer-facing errors: friendly, no technical details. See specs.md section 8.3 for exact messages.
- Admin-facing errors: include error codes and actionable messages.
- Log all errors with structured context (function name, input params, error code).

### Git conventions
- Commit messages: `type(scope): description` — e.g., `feat(customer-form): add emoji rating screen`
- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- Scopes: `customer-form`, `kiosk`, `admin-dashboard`, `shared`, `supabase`, `docs`
- One logical change per commit. No "fix everything" commits.

---

## Agent behaviour rules

### Before writing code
1. Read `specs.md` to understand the feature requirements and acceptance criteria.
2. Read `skills.md` to check if a reusable pattern exists for the task.
3. Check existing code in `packages/shared/` — don't duplicate types or utilities.
4. Plan the implementation before writing. State what files will be created/modified.

### While writing code
5. Follow the tech stack. Do not introduce new dependencies without explicit user approval.
6. Follow the file structure. Put files in the right directory.
7. Write Zod schemas in `packages/shared/src/types/` before using types in app code.
8. Include error states and loading states in every UI component.
9. Add `aria-label` and proper semantic HTML for accessibility.
10. Test with the acceptance criteria from specs.md — every Given/When/Then must pass.

### After writing code
11. Verify TypeScript compiles with no errors (`pnpm tsc --noEmit`).
12. Run any existing tests.
13. Summarize what was built and which acceptance criteria it satisfies.

### Things the agent must NEVER do
- Never install a package not in the tech stack without asking.
- Never write raw SQL in frontend code.
- Never hardcode user-facing strings in components.
- Never use `any` type.
- Never create a REST API endpoint outside of Supabase Edge Functions.
- Never store PII (IP addresses, device fingerprints, personal data).
- Never skip error handling or loading states.
- Timeout page and thank-you page are DIFFERENT screens. Timeout = expired without submission. Thank-you = already used token. Never merge them.
- Browse zone token_ttl_min = 10 (minutes). Billing zone token_ttl_min = 30 (minutes). These come from zone config — never hardcode.
- Customer form must poll token status every 60 seconds while open to detect mid-form expiry.
- Never put business logic in components. Extract to hooks or lib functions.
- Never generate a token_id locally on the kiosk. Tokens must always be minted via the `mint-token` Edge Function with a live DB write. Local UUID generation = broken validation flow.
- Never pre-mint a batch of tokens for offline use. TTL starts at mint time — pre-minted tokens will be expired before customers use them.
- Never allow the kiosk to display the QR tap button when offline. Show the offline banner and disable the button. Restore automatically when connectivity returns.
- Never add 2FA to the kiosk service account. It is a machine identity, not a human login.
- Never use `user_metadata` for role claims. Always use `app_metadata` — it cannot be modified by the user themselves.
- Never share the kiosk service account credentials with admin or MD users. These are separate identities with separate passwords.
- Never allow the customer to select or override product section. It is always resolved server-side from zone config. The `product_section` field in `submit-feedback` input must be ignored — use the value from the token's zone config.
- Never show a product section selection screen to the customer. Both billing and browse zones resolve section from admin-configured zone data.
- Never create kiosk Auth users manually in Supabase dashboard. Always use the `provision-kiosk` Edge Function from the admin panel — this ensures the `kiosks` table row is created and the `kiosk` role is set correctly in `app_metadata`.
- MVP has exactly 2 kiosk accounts: browse and billing. Do not create more without explicit instruction.
- **Never consume the `?pos_section=` query parameter in MVP**. The customer form must ignore this parameter entirely. `product_section` is always resolved server-side from the token's zone config. This param is reserved for future POS integration only (specs.md §S-P2).
- **Never add data deletion hooks, purge functions, or retention policies without explicit instruction**. Specs.md §14 lists "data retention window" as an open question. The agent must not make assumptions about when/how to delete feedback records.
- **Never implement the kiosk `···` menu in Sprint 1**. This feature (kiosk settings, sign-out, diagnostics) is deferred to Sprint 2 and requires IT/admin authentication. The idle screen top-right corner is intentionally empty in MVP.
- **Never skip the offline connectivity poll**. Kiosk must poll network connectivity every 10 seconds when offline (specs.md §4.2). Without this, the kiosk stays stuck in offline state even after network recovery.
- **Never create a `provision-kiosk` UI without role verification**. Only users with `admin` role can access the kiosk provisioning form. MD users cannot provision kiosks (specs.md §7.5).
- **Never add UPDATE or DELETE to audit log tables**. Audit logs are immutable (specs.md §12). Create an `audit_logs` table with INSERT-only RLS policies. No UPDATE, no DELETE, no soft-delete flags.

---

## Open questions protocol (enforced)

**specs.md §14 lists unresolved decisions.** If a task requires answering one of these questions, the agent must STOP and flag the issue rather than making assumptions.

**Current open questions from specs.md §14:**

1. Data retention window: how long are feedback records kept before purge?
2. Preferred 2FA: Supabase built-in TOTP or external SSO?
3. Full product section taxonomy for The Chennai Silks
4. CSV export scope: aggregated only or anonymized per-submission breakdowns?
5. Kiosk hardware: specific tablet model and screen size?
6. POS system details for future integration: which POS software? API availability?

**When to flag:**

- Implementing data purge/retention → Flag question #1
- Adding 2FA setup flow → Flag question #2
- Seeding product_sections table → Flag question #3
- Building CSV export → Flag question #4
- Kiosk responsive layout → Flag question #5
- POS integration work → Flag question #6

**Agent response pattern:**

```
STOP: This task requires a decision on specs.md §14 open question #[N].

The specs list "[question text]" as unresolved.

I need your input before proceeding:
- [Option A]
- [Option B]
- Or tell me to defer this until the question is resolved.
```

**Agent must:**
- Never assume answers to open questions
- Reference the exact question number from §14
- Offer 2-3 reasonable options when flagging
- Continue with other work if the blocker only affects one feature

---

---

## Build order (sprint sequence)

### Sprint 1: Foundation
1. Supabase project setup + DB schema (migrations) + RLS policies + seed data
2. Edge Functions: mint-token, validate-token, submit-feedback, provision-kiosk
3. Shared package: Zod schemas, TypeScript types, Supabase client, constants
4. Customer form: token validation + emoji ratings + confirmation
5. Basic kiosk: idle screen + tap → QR + countdown + offline state + connectivity polling

### Sprint 2: Admin + polish
6. Admin dashboard: Supabase Auth + 2FA setup + zone config UI + kiosk provisioning UI
7. Admin dashboard: zone dashboard (metric cards + emotion pulse bars)
8. MD view: cross-zone comparison + section heatmap
9. Kiosk: Realtime subscription for token consumption
10. Kiosk: `···` menu (IT settings, sign-out, diagnostics)

### Sprint 3: Harden
11. CSV export
12. Token revocation UI
13. Error states and edge cases across all apps
14. Accessibility audit (WCAG 2.1 AA)
15. expire-tokens cron function

**Notes on removed items:**
- Demographics screen removed from Sprint 2 step 9 (was never in acceptance criteria, appears to be spec drift)
- Product section selection screen removed (never should have existed — product_section always resolved server-side)
- `provision-kiosk` Edge Function added to Sprint 1 step 2 (critical for kiosk setup)
