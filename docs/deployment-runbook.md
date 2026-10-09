# WheelForge Deployment Runbook

This runbook describes a repeatable static deployment for the Vite application. It does not claim that a production host or Supabase project is configured; those are release tasks owned by the deployment operator.

Use [the release checklist](release-checklist.md) to record evidence and sign off each staging or production release. The [repository boundary](repository-boundary.md) defines which root application is deployed, and the [operations runbook](operations-runbook.md) covers monitoring, incidents, rollback, and recovery. The checklist is intentionally explicit about external verification that cannot be proven from this repository alone.

## Preflight

1. Work from a clean `main` checkout and confirm the intended commit with `git log -1 --oneline`.
2. Run `npm ci` and `npm run check`.
3. Confirm the repository is deploying the WheelForge app, not the legacy `frontend` or `backend` directories.
4. Create a staging Supabase project and apply `supabase/migrations/202609220001_wheelforge_private_workspaces.sql`.
5. Configure Supabase Auth site URL and redirect URLs for the exact staging origin.
6. Run the two-account RLS test against staging and manually verify sign-up, confirmation, recovery, backup restore, and account deletion.
   The repeatable RLS command is `npm run verify:supabase:staging` with temporary values for `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_TEST_PASSWORD`. Run it from a trusted operator shell only; never expose the service-role key to Vite or commit it.

## Host configuration

Use the repository root as the project directory:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm ci`
- Node version: 22 or newer

Set only these browser-safe variables in the host environment:

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Never configure a Supabase service-role key as a `VITE_*` variable. The checked-in `vercel.json` provides SPA fallback routing and baseline security headers for Vercel deployments. If another host is used, reproduce those headers and the `/settings` deep-link fallback in that host's configuration.

## Staging verification

Run the deployed-site smoke check from a trusted operator shell after the host is configured:

```powershell
$env:DEPLOYMENT_URL = "https://<staging-origin>"
$env:NODE_ENV = "production"
npm run verify:deployment
```

This verifies the root and every primary application route return the HTML app shell, follow the SPA fallback, use HTTPS, and include all required security headers. It does not replace the interactive checks below.

The same route and RLS checks can be run from GitHub Actions with the manual `WheelForge staging verification` workflow. Provide the deployment origin as the workflow input and configure these secrets in the `staging` environment: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_TEST_PASSWORD`. The service-role key is used only by the staging verifier and is never exposed to the browser build.

The deployment also exposes `/health.json` as a small uncached uptime target. It must return JSON with `{ "service": "wheelforge", "status": "ok" }`. This confirms that the host is serving the expected static artifact; it is not a substitute for browser, Supabase, or client-error monitoring.

For recurring HTTP checks, configure the repository variable `DEPLOYMENT_URL` with the staging or production origin. The scheduled `WheelForge deployment monitor` workflow then runs every 15 minutes and checks the app shell, deep-link routes, security headers, module asset, HTTPS, and `/health.json`. The workflow can also be run manually with a temporary URL override. Until `DEPLOYMENT_URL` is configured, the scheduled job remains skipped.

After deployment, verify:

1. `/`, `/spin`, `/chains`, `/templates`, `/tournaments`, `/participants`, and `/settings` load directly in a fresh browser tab.
2. A wheel can be created, spun, dismissed, exported, and restored from backup.
3. A generator can resume after reload.
4. A tournament can be created, hosted, displayed in audience mode, exported, and printed.
5. Two authenticated accounts cannot read, overwrite, restore, or delete each other's cloud backup.
6. Password recovery returns to the exact configured `/settings?password-reset=1` URL.
7. Browser developer tools show the expected CSP, HSTS, frame, referrer, and content-type headers.

Record the commit SHA, deployment URL, test date, Supabase project reference, and any failed checks in the release ticket. Do not put tokens or backup payloads in that ticket.

## Production promotion

Promote the exact staging-verified commit. Do not rebuild from an uncommitted working tree. Recheck the production callback URL, environment variables, Auth email settings, and backup retention before enabling public traffic.

## Rollback

1. Disable the affected deployment or route traffic back to the previous known-good deployment.
2. Preserve the failed deployment URL, commit SHA, CI artifacts, and browser console/network errors.
3. If a database migration was involved, stop and follow the migration-specific rollback plan; do not reverse RLS or grants ad hoc.
4. Confirm local export/import still works and that existing users can access their backups.
5. Open a repair change, rerun `npm run check`, repeat staging verification, and promote a new commit.

## Recovery drill

At least once before public launch and quarterly afterward, export a representative local workspace, restore it into a clean browser profile, restore a cloud backup into a disposable account, and record the observed data counts and any loss of history. Keep the drill result separate from user data.
