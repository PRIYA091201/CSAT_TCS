# skills.md — Reusable patterns and recipes for CSat project

---

## How to use this file

When building a feature, check if a matching pattern exists here before writing from scratch. Each skill is a self-contained recipe with context, implementation pattern, and gotchas. The agent should reference the skill name when applying it.

---

## Skill: supabase-edge-function

### When to use
Creating any new Edge Function (mint-token, validate-token, submit-feedback, or future functions).

### Pattern
```typescript
// supabase/functions/{function-name}/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { z } from "https://esm.sh/zod@3"

// 1. Define input schema with Zod
const InputSchema = z.object({
  zone_id: z.string().uuid(),
})

serve(async (req) => {
  // 2. CORS headers (required for browser calls)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    })
  }

  try {
    // 3. Parse and validate input
    const body = await req.json()
    const input = InputSchema.parse(body)

    // 4. Create Supabase client with service role for DB operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 5. Business logic here
    // ...

    // 6. Return success
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status: 200,
    })
  } catch (error) {
    // 7. Return structured error
    const status = error instanceof z.ZodError ? 400 : 500
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      status,
    })
  }
})
```

### Gotchas
- Always include CORS OPTIONS handler. Customer form and kiosk call from different origins.
- Use `SUPABASE_SERVICE_ROLE_KEY` for DB operations in Edge Functions, not the anon key.
- Zod validation first, business logic second. Never trust client input.
- Token operations (validate + update) must be atomic — use `.rpc()` for stored procedures or wrap in a transaction.

---

## Skill: tap-based-selector

### When to use
Any screen where the customer selects from a fixed set of options: demographics (gender, age group), product section, emoji ratings.

### Pattern
```tsx
// components/tap-selector.tsx
import { useState } from "react"
import { cn } from "@/lib/utils"

type TapOption = {
  value: string
  label: string
  icon?: React.ReactNode  // for emoji faces
  activeColor?: string    // tailwind bg class when selected
  activeBorder?: string   // tailwind border class when selected
}

type TapSelectorProps = {
  label: string
  options: TapOption[]
  value: string | null
  onChange: (value: string) => void
}

export function TapSelector({ label, options, value, onChange }: TapSelectorProps) {
  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="flex gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={cn(
              "flex-1 h-13 rounded-lg border flex flex-col items-center justify-center gap-1",
              "text-sm text-muted-foreground transition-all",
              "min-h-[52px]",  // 52px minimum for touch targets
              value === opt.value
                ? `${opt.activeBorder || "border-2 border-primary"} ${opt.activeColor || "bg-primary/10"} scale-[1.04]`
                : "border-border bg-muted"
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

### Usage for emoji ratings
```tsx
const EMOJI_OPTIONS: TapOption[] = [
  { value: "happy", label: "Happy", icon: <HappyFace />, activeColor: "bg-green-50", activeBorder: "border-2 border-green-600" },
  { value: "neutral", label: "Okay", icon: <NeutralFace />, activeColor: "bg-amber-50", activeBorder: "border-2 border-amber-600" },
  { value: "sad", label: "Unhappy", icon: <SadFace />, activeColor: "bg-red-50", activeBorder: "border-2 border-red-600" },
]
```

### Gotchas
- Minimum touch target: 52px height. Never go below 48dp.
- Use `aria-pressed` for toggle buttons, not `aria-selected`.
- `scale-[1.04]` on selection gives tactile feedback without being distracting.
- All labels come from locale file, not hardcoded.

---

## Skill: token-validation-flow

### When to use
Customer form initial load — the first thing that happens after QR scan.

### Pattern
```tsx
// hooks/use-token-validation.ts
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@shared/supabase/client"
import { TokenValidationResponse } from "@shared/types"

export function useTokenValidation(tokenId: string) {
  return useQuery({
    queryKey: ["token", tokenId],
    queryFn: async (): Promise<TokenValidationResponse> => {
      const { data, error } = await supabase.functions.invoke("validate-token", {
        body: { token_id: tokenId },
      })
      if (error) throw error
      return data
    },
    retry: false,        // Don't retry validation — expired is expired
    staleTime: Infinity, // Token state won't change while form is open
    refetchOnWindowFocus: false,
  })
}

// pages/feedback.tsx
export function FeedbackPage() {
  const { zoneId, tokenId } = useParams()
  const { data, isLoading, isError } = useTokenValidation(tokenId)

  if (isLoading) return <LoadingScreen />
  if (isError || !data?.valid) return <ErrorScreen errorCode={data?.error_code} />
  return <FeedbackForm zoneType={data.zone_type} productSection={data.product_section} />
}
```

### Error screen mapping
```tsx
// components/error-screen.tsx
// Two distinct screens: timeout-page and thankyou-page

const TIMEOUT_MESSAGES: Record<string, string> = {
  billing: "Your feedback window has closed. Purchased customers have 30 minutes from billing.",
  browse: "Time is up! You had 10 minutes to submit. Please request a new QR at the kiosk.",
}

const THANKYOU_MESSAGE = "Thanks! We have already received your feedback."

const OTHER_MESSAGES: Record<string, string> = {
  revoked: "This feedback link is no longer active.",
  invalid: "Something went wrong. Please try scanning the QR again.",
}

// Map error_code → which page to show
function getErrorScreen(errorCode: string, zoneType: string) {
  if (errorCode === 'expired') return { type: 'timeout', message: TIMEOUT_MESSAGES[zoneType] ?? TIMEOUT_MESSAGES.billing }
  if (errorCode === 'used') return { type: 'thankyou', message: THANKYOU_MESSAGE }
  return { type: 'error', message: OTHER_MESSAGES[errorCode] ?? OTHER_MESSAGES.invalid }
}
```

### Mid-form expiry polling
```tsx
// hooks/use-token-expiry-watcher.ts
// Polls token status every 60s while customer is filling the form
// If token expires mid-form, redirects to timeout page immediately

export function useTokenExpiryWatcher(tokenId: string, zoneType: string) {
  const navigate = useNavigate()

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke('validate-token', {
        body: { token_id: tokenId },
      })
      if (!data?.valid && data?.error_code === 'expired') {
        navigate(`/timeout?zone=${zoneType}`)
      }
    }, 60_000) // every 60 seconds

    return () => clearInterval(interval)
  }, [tokenId, zoneType, navigate])
}

// Use this hook on every form screen after token validation passes
// Place in the demographics, product section, and ratings screens
```

### Gotchas
- `retry: false` is critical. An expired token won't un-expire on retry.
- `staleTime: Infinity` prevents re-fetching during the form session.
- Extract tokenId and zoneId from URL params: `/f/:zoneId/:tokenId`
- Show a loading skeleton, not a spinner. Perceived performance matters.
- Mid-form polling starts AFTER initial validation passes. Not before.
- Timeout page and thank-you page are DIFFERENT screens with DIFFERENT messages.
- Re-scan of used token → thank-you page (positive tone). Expired token → timeout page (instructional tone).
- Browse zone token_ttl_min = 10. Billing zone token_ttl_min = 30. These values come from the zone config, not hardcoded.

---

## Skill: kiosk-auth-boot

### When to use
Kiosk app startup — auto-sign in as the kiosk service account on boot. Must happen before any token minting.

### Pattern
```tsx
// lib/kiosk-auth.ts
import { supabase } from "@shared/supabase/client"

// Called once on app mount. Credentials come from .env set by IT at setup time.
// Never prompt for login. Never show a login screen.
export async function kioskAutoSignIn(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()

  // Already have a valid session (refresh token persisted in localStorage)
  if (session) return

  // No session — sign in with stored credentials
  const email = import.meta.env.VITE_KIOSK_EMAIL
  const password = import.meta.env.VITE_KIOSK_PASSWORD

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    // Log but do not expose credentials in UI
    console.error("[kiosk-auth] Auto sign-in failed:", error.message)
    // App enters offline/error state — show "Please contact IT support"
    throw new Error("kiosk_auth_failed")
  }
}

// Session auto-refreshes via Supabase JS SDK. No manual refresh needed.
```

```tsx
// App.tsx (kiosk app root)
import { useEffect, useState } from "react"
import { kioskAutoSignIn } from "@/lib/kiosk-auth"

export function App() {
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    kioskAutoSignIn()
      .then(() => setAuthReady(true))
      .catch(() => setAuthError(true))
  }, [])

  if (authError) return <div>Please contact IT support.</div>
  if (!authReady) return null  // Splash screen or blank during auth

  return <KioskIdleScreen />
}
```

### Gotchas
- Store credentials in `.env` as `VITE_KIOSK_EMAIL` and `VITE_KIOSK_PASSWORD`. IT sets these at tablet setup time.
- Supabase JS SDK persists the refresh token in `localStorage` automatically. Session survives reboots.
- Never show a login form on the kiosk. It is a machine identity. If auth fails, show "Please contact IT support."
- The kiosk service account has role `kiosk` in `app_metadata`. Never use `user_metadata` for roles.
- Admin logout on their device has zero effect on the kiosk session — they are different Supabase Auth users.

---

## Skill: kiosk-offline-detection

### When to use
Kiosk idle screen — detect loss of internet connectivity and disable the tap button with a banner.

### Pattern
```tsx
// hooks/use-online-status.ts
import { useEffect, useState } from "react"

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOnline
}
```

```tsx
// components/kiosk-idle-screen.tsx
import { useOnlineStatus } from "@/hooks/use-online-status"

export function KioskIdleScreen({ onTap }: { onTap: () => void }) {
  const isOnline = useOnlineStatus()

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {!isOnline && (
        <div className="w-full bg-amber-100 border-b border-amber-300 text-amber-900 text-sm text-center py-2 px-4">
          Connection lost. Please try again in a moment.
        </div>
      )}
      <h1>{t("kiosk.idle_title")}</h1>
      <p>{t("kiosk.idle_subtitle")}</p>
      <button
        onClick={onTap}
        disabled={!isOnline}
        className={cn(
          "mt-8 px-10 py-5 rounded-2xl text-lg font-semibold transition-all",
          isOnline
            ? "bg-primary text-white cursor-pointer"
            : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
        )}
      >
        {t("kiosk.idle_cta")}
      </button>
      <p className="mt-4 text-xs text-muted-foreground">{t("kiosk.idle_privacy")}</p>
    </div>
  )
}
```

### Gotchas
- `navigator.onLine` can be unreliable (returns true even on captive portals). For MVP this is acceptable — if mint-token fails despite onLine=true, the error surfaces at the Edge Function call level.
- Banner sits at the top, does NOT replace the idle screen. Customer still sees the store branding.
- Button restores automatically when `online` event fires. No manual refresh needed.
- Never attempt token minting when `isOnline === false`. Gate it at the button level.
- The offline banner string must be in `en.json` as `kiosk.offline_banner`. Never hardcode.

---

## Skill: kiosk-realtime-reset

### When to use
Kiosk needs to detect when the token it displayed has been consumed (status changed to 'used') and auto-reset to idle.

### Pattern
```tsx
// hooks/use-kiosk-token-watcher.ts
import { useEffect } from "react"
import { supabase } from "@shared/supabase/client"

export function useKioskTokenWatcher(
  tokenId: string | null,
  onConsumed: () => void
) {
  useEffect(() => {
    if (!tokenId) return

    const channel = supabase
      .channel(`token-${tokenId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tokens",
          filter: `token_id=eq.${tokenId}`,
        },
        (payload) => {
          if (payload.new.status === "used") {
            onConsumed()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tokenId, onConsumed])
}
```

### Countdown pattern (add to kiosk QR state component)
```tsx
// hooks/use-kiosk-countdown.ts
import { useEffect, useState } from "react"

export function useKioskCountdown(seconds: number, onExpired: () => void) {
  const [remaining, setRemaining] = useState(seconds)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (remaining <= 0) {
      setExpired(true)
      // Brief pause before returning to idle — lets customer read "Expired" message
      const pause = setTimeout(onExpired, 1500)
      return () => clearTimeout(pause)
    }
    const tick = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(tick)
  }, [remaining, onExpired])

  return { remaining, expired }
}

// Usage in QR state:
// const { remaining, expired } = useKioskCountdown(30, handleReset)
//
// {expired
//   ? <span className="text-red-500">● Expired — returning to welcome</span>
//   : <span>Expires in {remaining}s</span>
// }
```

### Gotchas
- Clean up the channel subscription on unmount. Memory leaks on kiosks running 24/7.
- Filter by specific token_id, not the whole table. Efficiency matters.
- The kiosk has a local 30-second timer for QR display. If 30s fires before customer scans: kiosk resets to idle after a 1.5s pause showing "● Expired — returning to welcome". Token stays active for its full 10-minute TTL.
- Combine 30s local timer + Realtime for reliability: local timer resets kiosk UI; Realtime detects token consumption.
- Browse zone token_ttl_min = 10. Do NOT hardcode 2 minutes anywhere.
- Countdown text: "Expires in {N}s" — from `en.json` key `kiosk.qr_expiry`. Expired text: `kiosk.qr_expired`. Never hardcode.

---

## Skill: emotion-pulse-bar

### When to use
Admin dashboard and MD dashboard — the stacked horizontal bars showing happy/okay/unhappy split.

### Pattern
```tsx
// components/emotion-pulse-bar.tsx
type EmotionPulseBarProps = {
  label: string
  happy: number   // percentage 0-100
  neutral: number
  unhappy: number
}

export function EmotionPulseBar({ label, happy, neutral, unhappy }: EmotionPulseBarProps) {
  // Percentage shown is ALWAYS happy %. Colour of text signals good/warning/bad.
  const textColor =
    happy >= 60 ? "text-green-400" :
    happy >= 40 ? "text-amber-400" :
    "text-red-400"

  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="w-[70px] text-xs text-muted-foreground text-right shrink-0">
        {label}
      </span>
      <div className="flex-1 h-5 flex rounded overflow-hidden">
        <div className="h-full bg-green-500 transition-[width]" style={{ width: `${happy}%` }} />
        <div className="h-full bg-amber-400 transition-[width]" style={{ width: `${neutral}%` }} />
        <div className="h-full bg-red-500 transition-[width]" style={{ width: `${unhappy}%` }} />
      </div>
      <span className={cn("w-10 text-xs text-right shrink-0", textColor)}>
        {happy}%
      </span>
    </div>
  )
}
```

### Gotchas
- The percentage shown is **always the happy %**. Green text ≥60%, amber text 40-59%, red text <40%.
- Do NOT switch to unhappy % for red bars. Consistent metric everywhere = easier to read.
- Percentages must sum to 100. Validate before rendering.
- Use `transition-[width]` for smooth animation when date range changes.
- Dark theme: use `text-green-400`, `text-amber-400`, `text-red-400` (not 700 variants) — lighter shades read better on dark backgrounds.
- The bar is the same pattern for zone dashboard, cross-zone comparison, and section detail.

---

## Skill: section-heatmap-cell

### When to use
MD dashboard section heatmap — the grid of sections × dimensions.

### Pattern
```tsx
// Colour mapping function
function getHeatmapColor(happyPct: number): { bg: string; text: string } {
  if (happyPct >= 60) return { bg: "bg-green-50", text: "text-green-900" }
  if (happyPct >= 40) return { bg: "bg-amber-50", text: "text-amber-900" }
  return { bg: "bg-red-50", text: "text-red-900" }
}
```

### Top concerns list pattern
```tsx
// types: defined in packages/shared/src/types/
type TopConcern = {
  rank: number           // 1, 2, 3
  section: string        // 'sarees', 'fabrics', etc.
  dimension: string      // 'pricing', 'design', 'handling', 'overall'
  happyPct: number       // e.g. 28
  unhappyPct: number     // e.g. 47
  count: number          // submission count
  isHighestVolume: boolean
}

// lib/insight-templates.ts
// Resolves the hardcoded template string for a given dimension + band
export function getInsightText(concern: TopConcern): string {
  const { dimension, happyPct, unhappyPct, count, isHighestVolume } = concern
  const band = happyPct < 40 ? "red" : "amber"
  const key = `heatmap.insights.${dimension}.${band}` as const
  let text = t(key, { happy: happyPct, unhappy: unhappyPct, count })
  if (isHighestVolume) text += ` (${count} submissions — highest volume).`
  return text
}

// components/top-concern-item.tsx
export function TopConcernItem({ concern }: { concern: TopConcern }) {
  const { rank, section, dimension, happyPct } = concern
  const insight = getInsightText(concern)
  const sectionLabel = t(`sections.${section}`)
  const dimensionLabel = t(`ratings.${dimension}`)

  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border">
      <div className="flex items-start gap-3">
        <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
          {rank}
        </span>
        <div>
          <p className="text-sm font-semibold">{sectionLabel} — {dimensionLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{insight}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-red-400 shrink-0">{happyPct}%</span>
    </div>
  )
}
```

### Gotchas
- Cell shows happy %, not unhappy %.
- Red cells (<40% happy) are clickable for drill-down.
- Three colour bands: green (≥60%), amber (40-59%), red (<40%).
- Use consistent thresholds everywhere. Don't vary by view.
- Top concerns list: ranked by happy % ascending. Top 3 only shown by default.
- Insight text comes from `en.json` `heatmap.insights.*` keys — never hardcoded in components.
- The happy % shown right-aligned is red text always (it's always a concern value).

---

## Skill: supabase-rls-pattern

### When to use
Writing RLS policies for any table.

### Pattern
```sql
-- feedback_records: anonymous can INSERT, authenticated admin/MD can SELECT
ALTER TABLE feedback_records ENABLE ROW LEVEL SECURITY;

-- Anyone can submit feedback (anonymous)
CREATE POLICY "anon_insert_feedback" ON feedback_records
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated users with admin or md role can read
CREATE POLICY "auth_select_feedback" ON feedback_records
  FOR SELECT TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('admin', 'md')
  );

-- tokens: Edge Functions use service role (bypasses RLS)
-- But if direct client access needed:
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_active_token" ON tokens
  FOR SELECT TO anon
  USING (status = 'active');
```

### Gotchas
- Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. RLS policies are for direct client access.
- Custom roles (admin, md) are stored in user metadata or a separate `user_roles` table. Use `auth.jwt()` claims for RLS.
- Never allow anonymous DELETE or UPDATE on any table.
- Test RLS policies with the Supabase SQL editor using `set role anon;` before deploying.

---

## Skill: locale-string-pattern

### When to use
Any user-facing text in any of the three apps.

### Pattern
```json
// src/locales/en.json
{
  "common": {
    "store_name": "The Chennai Silks",
    "submit": "Submit feedback",
    "skip": "Skip",
    "next": "Next"
  },
  "demographics": {
    "title": "Tell us about yourself",
    "subtitle": "Optional — tap or skip",
    "gender_label": "Gender",
    "age_label": "Age group",
    "male": "Male",
    "female": "Female",
    "other": "Other",
    "prefer_not_to_say": "Prefer not to say"
  },
  "ratings": {
    "title": "How was your experience?",
    "subtitle": "Tap one per row",
    "pricing": "Pricing",
    "design": "Design / look",
    "handling": "Handling / feel",
    "overall": "Overall experience",
    "happy": "Happy",
    "neutral": "Okay",
    "unhappy": "Unhappy",
    "disabled": "Select all ratings to submit",
    "ready": "Submit feedback"
  },
  "confirmation": {
    "title": "Thank you for your feedback!",
    "store": "The Chennai Silks"
  },
  "errors": {
    "revoked": "This feedback link is no longer active.",
    "invalid": "Something went wrong. Please try scanning the QR again."
  },
  "timeout": {
    "billing_title": "Feedback window closed",
    "billing_message": "Your feedback window has closed. Purchased customers have 30 minutes from billing.",
    "browse_title": "Time is up!",
    "browse_message": "You had 10 minutes to submit. Please request a new QR at the kiosk."
  },
  "already_received": {
    "title": "Already received!",
    "message": "Thanks! We have already received your feedback."
  },
  "kiosk": {
    "idle_title": "We'd love your feedback!",
    "idle_subtitle": "Help us serve you better. It takes less than a minute.",
    "idle_cta": "Tap to share feedback",
    "idle_privacy": "Your response is anonymous",
    "offline_banner": "Connection lost. Please try again in a moment.",
    "qr_title": "Scan with your phone camera",
    "qr_subtitle": "This QR is just for you",
    "qr_expiry": "Expires in {seconds}s",
    "qr_expired": "Expired — returning to welcome"
  },
  "heatmap": {
    "insights": {
      "pricing": {
        "red": "Only {happy}% happy. {unhappy}% actively unhappy. {count} submissions.",
        "amber": "Only {happy}% happy. Pricing perceived as high. {count} submissions."
      },
      "design": {
        "red": "Only {happy}% happy. {unhappy}% unhappy with appearance. {count} submissions.",
        "amber": "Only {happy}% happy. Design getting mixed reactions. {count} submissions."
      },
      "handling": {
        "red": "Only {happy}% happy. {unhappy}% unhappy. Customers may dislike fabric feel.",
        "amber": "Only {happy}% happy. Handling needs attention. {count} submissions."
      },
      "overall": {
        "red": "Only {happy}% happy overall. {unhappy}% left dissatisfied. {count} submissions.",
        "amber": "Only {happy}% happy overall. {count} submissions."
      }
    }
  }
}
```

```tsx
// lib/i18n.ts
import en from "@/locales/en.json"

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string ? (T[K] extends object ? `${K}.${NestedKeyOf<T[K]>}` : K) : never }[keyof T]
  : never

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split(".")
  let value: any = en
  for (const k of keys) {
    value = value?.[k]
  }
  if (typeof value !== "string") return key
  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      value
    )
  }
  return value
}
```

### Usage
```tsx
<p>{t("ratings.title")}</p>
<span>{t("ratings.remaining", { count: 2 })}</span>
```

### Gotchas
- NEVER hardcode strings in components. Always use `t()`.
- The `{count}` and `{time}` patterns allow dynamic values.
- Adding Tamil = create `ta.json` with same keys, swap the import. No code changes.
- Total strings: ~30. Small surface area.

---

## Skill: submit-with-counter

### When to use
The emoji rating screen — submit button disabled until all 4 ratings selected, with a dynamic counter.

### Pattern
```tsx
const DIMENSIONS = ["price", "design", "handling", "overall"] as const

export function RatingScreen({ onSubmit }: { onSubmit: (ratings: Ratings) => void }) {
  const [ratings, setRatings] = useState<Record<string, string | null>>({
    price: null, design: null, handling: null, overall: null,
  })

  const filledCount = Object.values(ratings).filter(Boolean).length
  const isComplete = filledCount === 4
  const remaining = 4 - filledCount

  return (
    <>
      {DIMENSIONS.map((dim, i) => (
        <div key={dim}>
          {/* Divider before Overall row only */}
          {dim === "overall" && <div className="border-t border-border my-3" />}
          <TapSelector
            label={t(`ratings.${dim}`)}
            options={EMOJI_OPTIONS}
            value={ratings[dim]}
            onChange={(val) => setRatings((prev) => ({ ...prev, [dim]: val }))}
          />
        </div>
      ))}

      <button
        disabled={!isComplete}
        onClick={() => isComplete && onSubmit(ratings as Ratings)}
        className={cn(
          "w-full h-12 rounded-lg text-sm font-medium transition-all mt-2",
          isComplete
            ? "bg-green-600 text-white cursor-pointer"
            : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
        )}
      >
        {isComplete ? t("ratings.ready") : t("ratings.disabled")}
      </button>
    </>
  )
}
```

### Gotchas
- "Overall experience" row must be visually separated with a `border-t` divider above it. The other 3 rows have no dividers between them.
- Disabled button text: `t("ratings.disabled")` = "Select all ratings to submit" — matches mockup exactly. No numeric counter in button text.
- Enabled button text: `t("ratings.ready")` = "Submit feedback". Button turns solid green.
- No numeric "N more to go" counter anywhere in the UI. The button text is the only completion signal.
- Submit button transition: muted/greyed → green. Keep transition smooth (`transition-all`).
- Emoji option cards: square, icon on top, label below. Unselected = dark card. Selected = coloured border + subtle background tint matching emotion colour.

---

## Skill: dashboard-metric-card

### When to use
Summary numbers at the top of any dashboard view (submissions, happiness ratio, response rate).

### Pattern
```tsx
type MetricCardProps = {
  label: string
  value: string | number
  subtitle?: string
  valueClassName?: string
}

export function MetricCard({ label, value, subtitle, valueClassName }: MetricCardProps) {
  return (
    <div className="bg-muted rounded-lg p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-medium", valueClassName)}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  )
}
```

### Usage
```tsx
<div className="grid grid-cols-4 gap-2.5">
  <MetricCard label="Total submissions" value={247} subtitle="+18% vs last week" />
  <MetricCard label="Happiness ratio" value="68%" subtitle="across all dimensions" />
  <MetricCard label="Response rate" value="42%" subtitle="247 of 588 tokens" />
  <MetricCard label="Top concern" value="Pricing" subtitle="38% unhappy" valueClassName="text-base" />
</div>
```

### Gotchas
- 4 cards in a row on desktop, 2×2 on tablet, stacked on mobile.
- Use `text-xl` for numbers, `text-base` for text values (like "Pricing").
- Subtitle is always muted. No colour coding on subtitle.
- Round all numbers. No floating point artifacts on screen.

---

## Skill: prompt-for-new-feature

### When to use
Starting work on a new feature or story from specs.md.

### Prompt template
```
Read specs.md section [X] and agenta.md coding rules.

I need to implement story [S-XX]: [story title].

Acceptance criteria:
[paste the Given/When/Then from specs.md]

Check skills.md for any matching patterns before writing code.

Plan the implementation:
1. Which files will be created or modified?
2. Which shared types are needed?
3. What error states must be handled?
4. Which accessibility requirements apply?

Then implement step by step.
```

---

## Skill: prompt-for-bug-fix

### When to use
Fixing a bug in existing code.

### Prompt template
```
Bug: [describe what's happening]
Expected: [what should happen per specs.md]
Actual: [what's actually happening]

Check the acceptance criteria in specs.md for story [S-XX].
Check agenta.md for relevant coding rules.

Fix the bug and verify it doesn't break any other acceptance criteria.
```

---

## Skill: prompt-for-ui-screen

### When to use
Building a new UI screen from the specs.

### Prompt template
```
Read specs.md section [X] for the screen requirements.
Read skills.md for any matching component patterns (tap-selector, emotion-pulse-bar, etc.).
Read agenta.md for React and Tailwind conventions.

Build [screen name] with:
- All user-facing strings from locales/en.json (add new keys if needed)
- Loading, error, and success states
- Mobile-first layout (customer form) or desktop-first (admin dashboard)
- WCAG 2.1 AA accessibility (48dp touch targets, aria labels, keyboard nav)
- shadcn/ui components where applicable

Show me the component code and any new locale strings needed.
```

---

## Skill: supabase-auth-setup

### When to use
Setting up admin or MD users in Supabase for the first time, or diagnosing login failures where password is correct but dashboard redirects back to `/login`.

### Root cause of "logged in but not entering dashboard"

The frontend `useAuth` hook reads role from `user.app_metadata.role`. If this is missing or wrong, `ProtectedLayout` redirects to `/login` even after a successful Supabase auth sign-in.

The Supabase Auth dashboard UI creates users but does NOT set `raw_app_meta_data.role`. You must set it via SQL.

### Pattern — create admin + MD users

```sql
-- Run in Supabase SQL Editor
-- https://supabase.com/dashboard/project/<your-project-ref>/sql/new

-- Step 1: Create or update admin user
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, role, aud
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@chennaisilks.com',
  crypt('Admin@1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  '{"name":"Store Admin"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
) ON CONFLICT (email) DO UPDATE
SET
  encrypted_password = crypt('Admin@1234', gen_salt('bf')),
  raw_app_meta_data  = '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
  email_confirmed_at = now(),
  updated_at         = now();

-- Step 2: Create identity record (required for Supabase to allow sign-in)
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  created_at, updated_at, last_sign_in_at
)
SELECT
  gen_random_uuid(), u.id, u.email,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
FROM auth.users u
WHERE u.email = 'admin@chennaisilks.com'
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Step 3: Verify
SELECT email, raw_app_meta_data->>'role' AS role, email_confirmed_at IS NOT NULL AS confirmed
FROM auth.users WHERE email = 'admin@chennaisilks.com';
-- Expected: admin@chennaisilks.com | admin | true
```

### Pattern — fix role only (user already exists, just missing role)

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@chennaisilks.com';
```

### Pattern — reset password only

```sql
UPDATE auth.users
SET encrypted_password = crypt('NewPassword@123', gen_salt('bf'))
WHERE email = 'admin@chennaisilks.com';
```

### Diagnosis query

```sql
SELECT
  id,
  email,
  raw_app_meta_data->>'role'     AS role,
  raw_app_meta_data->>'provider' AS provider,
  email_confirmed_at IS NOT NULL AS email_confirmed,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
```

### Gotchas
- Role MUST be in `raw_app_meta_data`, not `raw_user_meta_data`. The user can modify `user_metadata` themselves — it cannot be trusted for RBAC.
- `email_confirmed_at` must not be null. If null, Supabase rejects the sign-in silently. The SQL above sets it to `now()` on creation.
- The `auth.identities` row is required. Without it, sign-in fails with "User not found" even if the `auth.users` row exists.
- The full SQL is in `supabase/create_admin_user.sql`. Always use that file as the reference.
- Default credentials: admin = `admin@chennaisilks.com` / `Admin@1234`. Change after first login.

---

## Skill: response-rate-hook

### When to use
Displaying response rate (tokens minted vs tokens used) on any dashboard — zone dashboard or MD overview.

### Pattern

```tsx
// hooks/use-response-rate.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ResponseRate = {
  tokensMinted: number
  tokensUsed:   number
  ratePct:      number
}

// Zone-level response rate
export function useZoneResponseRate(zoneId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['response-rate', 'zone', zoneId, from, to],
    enabled: !!zoneId,
    queryFn: async (): Promise<ResponseRate> => {
      const { data, error } = await supabase
        .from('tokens')
        .select('status')
        .eq('zone_id', zoneId)
        .gte('created_at', from)
        .lte('created_at', to)
      if (error) throw error
      const rows    = data ?? []
      const minted  = rows.length
      const used    = rows.filter(r => r.status === 'used').length
      return {
        tokensMinted: minted,
        tokensUsed:   used,
        ratePct:      minted > 0 ? Math.round(used / minted * 100) : 0,
      }
    },
  })
}

// Branch-level response rate (MD view)
export function useBranchResponseRate(from: string, to: string) {
  return useQuery({
    queryKey: ['response-rate', 'branch', from, to],
    queryFn: async (): Promise<ResponseRate> => {
      const { data, error } = await supabase
        .from('tokens')
        .select('status, zones!inner(branch_id)')
        .gte('created_at', from)
        .lte('created_at', to)
      if (error) throw error
      const rows   = data ?? []
      const minted = rows.length
      const used   = rows.filter(r => r.status === 'used').length
      return {
        tokensMinted: minted,
        tokensUsed:   used,
        ratePct:      minted > 0 ? Math.round(used / minted * 100) : 0,
      }
    },
  })
}
```

### Usage

```tsx
// Zone dashboard — specs §9.2
const { data: rr } = useZoneResponseRate(zoneId!, from, to)

<MetricCard
  label={t('dashboard.response_rate')}
  value={rr ? formatPct(rr.ratePct) : '—'}
  subtitle={rr ? t('dashboard.tokens_used', { used: rr.tokensUsed, total: rr.tokensMinted }) : ''}
/>

// MD overview — specs §10.1
const { data: rr } = useBranchResponseRate(from, to)
// Same MetricCard usage
```

### Gotchas
- Response rate = `used / minted`. Expired and revoked tokens count as minted but not used — this correctly reflects "how many customers who got a QR actually submitted feedback."
- Always query by `created_at` date range to match the selected date filter.
- The `zones!inner(branch_id)` join filters to the correct branch. Without it, you'd get tokens from all branches (relevant when multi-branch is added post-MVP).
- Never hardcode `—` as a placeholder when the hook is loading. Show `—` only when `rr` is undefined, then replace with real data when loaded.
