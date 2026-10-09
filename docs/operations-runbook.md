# WheelForge Operations Runbook

This runbook covers a controlled beta or production deployment after the release checklist has been completed. It is intentionally vendor-neutral; hosting, Supabase, monitoring, and notification owners must be filled in before public launch.

## Ownership

- Product owner: `________________`
- Technical owner: `________________`
- Hosting project: `________________`
- Supabase project: `________________`
- Incident contact: `________________`
- Backup/recovery owner: `________________`

## Health and monitoring

1. Configure the repository variable `DEPLOYMENT_URL`.
2. Confirm the scheduled deployment monitor is producing successful runs.
3. Monitor `/health.json` and at least one SPA deep link.
4. Configure client error tracking separately from the local diagnostics export.
5. Alert on repeated deployment-monitor failures, elevated client errors, failed Supabase checks, and storage/recovery incidents.

The health endpoint proves that the host serves the expected static artifact. It does not prove that Supabase, authentication, browser storage, or user workflows are healthy.

## Incident response

1. Record the first observed time, affected URL, commit SHA, deployment URL, and symptoms.
2. Check `/health.json`, the deployment provider status, GitHub Actions, Supabase status, and client-error events.
3. Preserve browser console/network evidence without including workspace payloads, tokens, or participant data.
4. If a release caused the issue, stop promotion and roll traffic back to the last verified deployment.
5. If cloud data may be affected, disable cloud promotion and preserve the Supabase project/audit evidence before changing policies or migrations.
6. Communicate impact, workaround, and next update owner to affected users.
7. After repair, rerun the full release gate and document the root cause and prevention.

## Rollback

- Roll back the hosting deployment to the last staging-verified commit.
- Do not reverse a database migration ad hoc.
- Treat destructive schema or RLS changes as a separate reviewed recovery operation.
- Recheck `/health.json`, deep links, authentication redirects, local backup export/import, and cloud backup access after rollback.
- Keep the failed commit, CI artifacts, deployment URL, and incident notes available for diagnosis.

## Backup and recovery

- Local workspace recovery is user-controlled through Settings export/import.
- Cloud backup recovery must be tested with a disposable account before launch and at least quarterly afterward.
- Define cloud backup retention, deletion, and provider backup settings with the Supabase owner.
- Take a provider/database backup before a production migration when the hosting provider supports it.
- Never use production participant data in test fixtures or issue reports.
- Record recovery date, input backup, expected counts, observed counts, operator, and any loss of history in the release ticket.

## Change control

Promote only an exact commit that passed the application CI, pgTAP database tests, staging deployment verification, manual QA, and recovery drill. Keep the release checklist and this runbook linked from the deployment record.
