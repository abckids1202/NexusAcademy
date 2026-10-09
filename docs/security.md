# WheelForge Security Notes

- Supabase Auth owns password hashing and session management; never add or expose a custom password store in the browser.
- Only the publishable Supabase key may be exposed through `VITE_*` variables. Never ship a service-role key to the client.
- Keep the workspace table protected by per-user RLS policies for select, insert, update, and delete.
- Validate imported backups and cloud payloads before exposing them to application state.
- Treat local activity history as editable application data, not tamper-proof evidence or certified randomness.
- Use optimistic revision checks for local drafts and cloud backups; surface conflicts instead of silently overwriting newer data.
- Configure exact password-reset redirect URLs, HTTPS, CSP, frame, referrer, and content-type headers before deployment.
- Test account deletion, recovery, two-account isolation, backup restore, and rollback against staging before public release.
- The account-deletion Edge Function accepts POST only and derives the target user from the verified JWT; keep its method restriction and test cross-account insert, update, and delete isolation against staging.
- Keep exported backups private and avoid placing participant data, tokens, or backup payloads in logs or issue trackers.

