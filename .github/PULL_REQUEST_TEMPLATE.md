## Summary
<!-- 1-3 bullet points describing what this PR does -->
-
-
-

## Why
<!-- Why is this change needed? What problem does it solve? -->

## SDD alignment
<!-- Map your changes to the relevant specs.md sections -->
| Change | SDD Section |
|--------|-------------|
| | |

## OpenSpec artifacts updated
- [ ] `specs.md` updated
- [ ] `specs/open-spec/kiosk-mvp-design.md` updated (if kiosk change)
- [ ] `specs/open-spec/kiosk-mvp-tasks.md` updated (if kiosk change)

## Type of change
- [ ] New feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Spec/doc update
- [ ] Migration

## Checklist
- [ ] TypeScript compiles (`pnpm --filter @csat/<app> exec tsc --noEmit`)
- [ ] Build passes (`pnpm --filter @csat/<app> run build`)
- [ ] Spec alignment check passes (CI)
- [ ] Edge functions tested manually or via integration test
- [ ] No secrets committed
- [ ] Migrations are idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`)

## Screenshots / Demo (if UI change)
<!-- Paste screenshots or screen recording link here -->