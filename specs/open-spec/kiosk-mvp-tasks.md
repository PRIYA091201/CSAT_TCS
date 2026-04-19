# Kiosk MVP Tasks (OpenSpec)

1. Provision per-device kiosk accounts in admin dashboard
- UI: Create kiosk with name, zone, TTL; generate kiosk credentials; store securely on device

2. Implement kiosk frontend scaffold (apps/kiosk)
- Idle, QR display, offline states; sign-in flow for kiosk; 30s countdown; QR mint on tap

3. Implement edge function wiring for mint-token (admin/kiosk roles)
- Validate zone, resolve product_section server-side; create token with TTL; return token_id

4. Implement admin provisioning UI
- Zone config, kiosk provisioning, audit-log hooks

5. Implement data migrations for zones/kiosks/tokens/feedback/audit_logs

6. Implement customer flow (apps/customer-form) per SDD
- 3 screens: demographics, ratings, confirmation; verify token; handle timeouts

7. Implement Realtime token consumption signals for kiosk reset

8. Write tests: unit tests for new hooks, integration tests for mint/validate/submit-feedback

9. Create OpenSpec alignment checklist for PR
- Ensure specs.md linking to kiosk-mvp-design.md and kiosk-mvp-tasks.md

10. Prepare PR with design notes and task progress
