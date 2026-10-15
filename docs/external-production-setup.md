# WheelForge External Production Setup

This runbook is the operator handoff for moving WheelForge from a locally verified beta to a verified staging deployment and then production. It assumes the root application in the `NexusAcademy` repository remains the official WheelForge monorepo boundary.

Do not paste service-role keys, database passwords, recovery tokens, or backup payloads into Git, issues, chat, screenshots, or release notes. Only the Supabase publishable key may be exposed to the browser build.

## 1. Resources To Prepare

Create or obtain these resources before starting:

| Resource | Required for | Owner / value to record |
| --- | --- | --- |
| GitHub repository admin access | Secrets, environments, branch protection | `abckids1202/NexusAcademy` |
| Supabase staging project | RLS, auth, cloud-backup verification | Project reference, URL |
| Supabase production project | Production cloud backup | Project reference, URL |
| Vercel project or equivalent static host | Preview, staging, and production builds | Project name and deployment origin |
| Staging origin | Live route and cloud verification | `https://...` |
| Production origin | Public launch and monitoring | `https://...` |
| DNS/domain access | Stable staging/production URLs | Registrar or DNS owner |
| Monitoring owner | Alerts and incident response | Person/team and contact |
| Backup/recovery owner | Restore drills and retention | Person/team and contact |

Recommended environment separation:

- Supabase `staging` is disposable and never contains real participant data.
- Supabase `production` is separate from staging.
- Vercel Preview or a Vercel Custom Environment is used for staging; Vercel documents Custom Environments for specialized environments such as staging.
- Production deployment is promoted only from an exact commit that passed staging.

## 2. Choose The Repository Boundary

Record this decision in the release ticket:

```text
WheelForge deployment source: repository root of abckids1202/NexusAcademy
Legacy directories excluded: frontend/, backend/, worker/, infrastructure/
Build command: npm run build
Output directory: dist
Node: 22
```

Do not configure the host to build from `frontend`, `backend`, or `worker`.

## 3. Create Supabase Staging

1. Create a new Supabase project named something like `wheelforge-staging`.
2. Copy the project URL and publishable key from the project API settings.
3. Keep the service-role key in the Supabase/GitHub secret store only. Never use it as a `VITE_*` variable.
4. Apply the checked-in migration:

   `supabase/migrations/202609220001_wheelforge_private_workspaces.sql`

   Use the Supabase SQL editor or the Supabase CLI after linking the staging project. Do not edit the migration before applying it.
5. In Supabase Auth URL Configuration, set:

   - Site URL: the exact staging origin, for example `https://staging.example.com`
   - Redirect URL: `https://staging.example.com/settings?password-reset=1`
   - Local development redirect, if needed: `http://localhost:5173/settings?password-reset=1`

   Supabase requires the redirect target used by password recovery to be present in the allowed redirect list.

6. Use disposable test accounts only. The staging verifier creates two temporary accounts and removes them with the service role after the test.

Official references:

- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)

## 4. Configure Vercel Staging

The Vercel project must use the repository root.

Dashboard values:

```text
Framework preset: Vite or Other
Install command: npm ci
Build command: npm run build
Output directory: dist
Node version: 22
```

Add only these two staging build variables:

```text
VITE_SUPABASE_URL=https://<staging-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
```

Do not add any of these to Vercel as `VITE_*` variables:

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SECRET_KEY
SUPABASE_TEST_PASSWORD
```

CLI alternative from a trusted operator shell:

```powershell
npm install --global vercel
vercel login
vercel link
vercel env add VITE_SUPABASE_URL preview
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY preview
vercel --yes
```

Use the resulting HTTPS preview/staging origin as `DEPLOYMENT_URL`. Environment-variable changes apply to new deployments, so redeploy after changing them.

Official references:

- [Vercel environments](https://vercel.com/docs/deployments/environments)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel CLI deployment](https://vercel.com/docs/cli/deploy)

## 5. Configure GitHub Staging Secrets

In GitHub, open **Settings > Environments** and create an environment named `staging`. Add these environment secrets:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_TEST_PASSWORD
```

Add this repository variable under **Settings > Secrets and variables > Actions > Variables**:

```text
DEPLOYMENT_URL=https://<staging-origin>
```

Use environment secrets, not committed files or command-line literals. GitHub makes environment secrets available only to jobs that reference the environment; this repository's staging workflow already references `environment: staging` for the Supabase job.

Official references:

- [GitHub deployment environments and environment secrets](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)

## 6. Run Staging Verification

Start from the exact pushed commit:

```powershell
git fetch origin
git checkout f7462e7
npm ci
npm run check
```

Run the deployment verifier from a trusted operator shell:

```powershell
$env:DEPLOYMENT_URL = "https://<staging-origin>"
$env:NODE_ENV = "production"
npm run verify:deployment
```

Run the live two-account RLS verifier. Use a strong disposable password and clear the values after the command:

```powershell
$env:SUPABASE_URL = "https://<staging-project-ref>.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "<staging-publishable-key>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<staging-service-role-key>"
$env:SUPABASE_TEST_PASSWORD = "<temporary-test-password>"
npm run verify:supabase:staging
Remove-Item Env:SUPABASE_URL, Env:SUPABASE_PUBLISHABLE_KEY, Env:SUPABASE_SERVICE_ROLE_KEY, Env:SUPABASE_TEST_PASSWORD
```

The command must prove owner CRUD, cross-account isolation, and cleanup. If it fails, do not promote the deployment.

Then run the manual GitHub Actions workflow **WheelForge staging verification** with the staging origin. Record both workflow URLs, the commit SHA, deployment URL, and Supabase project reference in the release checklist. Never record secret values.

## 7. Manual Staging QA

Use `docs/manual-release-qa.md` against the exact staging commit. At minimum, record PASS/FAIL evidence for:

- Keyboard-only wheel creation and result actions
- Screen-reader landmarks, headings, dialogs, live result announcements, and canvas fallback
- Chrome, Edge, Firefox, WebKit/Safari, mobile Chromium, and mobile WebKit
- Weighted spin, auto-spin cancellation, elimination, random order, and undo
- Generator resume after reload
- Template pack install/update/restore
- Participant import, mapping, teams, roles, seating, attendance, and withdrawal
- Single, round-robin, and double-elimination tournament host/audience flows
- Export, print, local backup restore, invalid-data recovery, and quota warning
- Sign-up, email confirmation, password recovery, cloud upload, cloud restore, conflict handling, and account deletion

## 8. Recovery And Rollback Drill

Before production:

1. Export a representative local workspace.
2. Restore it into a clean browser profile and compare entity counts.
3. Upload a staging cloud backup.
4. Restore it into a disposable staging account.
5. Delete the staging cloud backup and account.
6. Confirm local browser data remains intact.
7. Deploy a known-good build, then rehearse returning traffic to the previous deployment.
8. Record operator, dates, commit SHAs, expected/observed counts, and any data loss.

Vercel's rollback behavior restores a prior deployment, but environment-variable changes are not retroactively applied to an old build. Recheck the environment configuration after rollback.

## 9. Production Promotion

Only after every staging gate is green:

1. Create/configure the separate production Supabase project.
2. Apply the reviewed migration.
3. Configure the production Site URL and password-reset redirect URL.
4. Add production Vercel variables for only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Deploy the exact staging-verified commit.
6. Run `npm run verify:deployment` against the production origin.
7. Configure the repository `DEPLOYMENT_URL` variable to the production origin.
8. Confirm the scheduled deployment monitor produces a passing run.
9. Perform a smoke test with a disposable account.
10. Record the production commit, URLs, project reference, monitor evidence, rollback target, and release owner.

Do not use real participant data until the staging recovery drill and production smoke test are complete.

## 10. Required Sign-Off Record

```text
Release commit:
Staging URL:
Production URL:
Staging Supabase project:
Production Supabase project:
Application CI URL:
Database CI URL:
Staging verification URL:
Deployment verification result:
Recovery drill result:
Manual QA evidence:
Monitoring evidence:
Rollback target:
Release owner:
QA owner:
Decision: BLOCKED / CONTROLLED BETA / APPROVED FOR PRODUCTION
```
