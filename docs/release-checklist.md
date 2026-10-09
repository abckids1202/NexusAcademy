# WheelForge Release Checklist

Use this checklist for each staging release and for the production promotion decision. A checked application test suite does not, by itself, make a release production-ready. Every unchecked external or manual item must be recorded as a blocker or accepted limitation.

## Release Identity

- [ ] Release candidate commit SHA: `________________`
- [ ] Staging URL: `________________`
- [ ] Production URL: `________________`
- [ ] Supabase project reference: `________________`
- [ ] Release owner: `________________`
- [ ] QA owner: `________________`
- [ ] Planned release date: `________________`
- [ ] Documented monorepo boundary accepted, or a dedicated WheelForge repository decision is recorded.

## Automated Gate

- [ ] Fresh checkout uses the intended commit and has a clean working tree.
- [ ] `npm ci` succeeds from a clean checkout.
- [ ] `npm run check` passes.
- [ ] Coverage thresholds pass and the report is retained with the release evidence.
- [ ] Dependency audit has zero high or critical vulnerabilities, or exceptions are documented.
- [ ] Production build succeeds.
- [ ] Static deployment configuration validation succeeds.
- [ ] Chromium E2E suite passes.
- [ ] Cloud-mock E2E suite passes.
- [ ] Firefox and WebKit smoke suites pass in CI or an equivalent supported environment.
- [ ] Mobile Chromium and mobile WebKit smoke suites pass.
- [ ] CI run URL and artifact locations: `________________`
- [ ] Supabase pgTAP database-test workflow passes for the release commit.

## Hosting and Deployment

- [ ] The host deploys from the repository root, not the legacy `frontend`, `backend`, or `worker` directories.
- [ ] Install command is `npm ci`.
- [ ] Build command is `npm run build`.
- [ ] Output directory is `dist`.
- [ ] Supported Node version is configured.
- [ ] Only browser-safe `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` variables are exposed to the build.
- [ ] No service-role key or other secret appears in client bundles, logs, or repository files.
- [ ] SPA fallback works for `/`, `/spin`, `/chains`, `/templates`, `/tournaments`, `/participants`, and `/settings`.
- [ ] `npm run verify:deployment` passes against the staging URL.
- [ ] HTTPS, CSP, HSTS, frame, referrer, and content-type headers are present.
- [ ] Deployment URL, headers, route results, and commit SHA are recorded.

## Supabase Staging

- [ ] Staging project exists and is separate from production.
- [ ] The checked-in migration has been applied successfully.
- [ ] Auth site URL and redirect URLs match the deployed staging origin.
- [ ] `npm run verify:supabase:staging` passes with temporary operator secrets.
- [ ] Two accounts cannot read, overwrite, restore, or delete each other’s backup.
- [ ] Sign-up and email confirmation work.
- [ ] Password recovery returns to the configured `/settings?password-reset=1` route.
- [ ] Backup upload and restore work for a disposable account.
- [ ] Stale cloud-write conflict behavior is understood and documented.
- [ ] Account deletion has been tested and removes the intended cloud data.
- [ ] Deployed Edge Functions, if enabled, are reachable and authorized correctly.

## Manual Product QA

Use the reproducible [manual release QA matrix](manual-release-qa.md) and attach its completed evidence to the release record.

- [ ] Keyboard-only walkthrough completes for wheel creation, spin, result actions, templates, chains, participants, tournaments, settings, export, and import.
- [ ] Screen-reader walkthrough covers landmarks, headings, dialogs, live result announcements, form errors, and canvas fallback content.
- [ ] Focus is visible and trapped correctly in dialogs; Escape and close controls behave consistently.
- [ ] Firefox, Safari/WebKit, Edge/Chromium, mobile Chrome, and mobile Safari/WebKit have been checked.
- [ ] Print output is readable in at least two browsers and does not include unwanted controls.
- [ ] A long spin can be canceled or completed without stale state, duplicate results, or a stuck control.
- [ ] Reduced-motion mode remains understandable and usable.
- [ ] Bright user colors remain readable after contrast normalization.
- [ ] Duplicate entries, malformed CSV rows, empty input, extreme weights, and very long labels are handled visibly.
- [ ] Result actions are clear: close, spin again, copy, keep, discard, and category/entry retention behavior.
- [ ] Tournament correction, undo, byes, forfeits, withdrawals, dependent matches, host mode, audience mode, export, and print have been exercised.

## Data, Recovery, and Limits

- [ ] Local export succeeds on a representative workspace.
- [ ] Local export restores into a clean browser profile with expected counts and relationships.
- [ ] Corrupt or incompatible local data recovers without silently destroying valid data.
- [ ] Clear-history behavior preserves in-progress chain sessions as documented.
- [ ] Large-workspace performance and browser quota behavior have been measured.
- [ ] Quota-exceeded behavior gives the user a recoverable error and export guidance.
- [ ] Cloud backup restores into a disposable account and observed data counts are recorded.
- [ ] Backup retention and deletion policy is documented.
- [ ] Recovery drill date, operator, inputs, results, and any data loss: `________________`

## Monitoring and Operations

- [ ] Client error tracking is configured and tested with a non-user-facing test event.
- [ ] Uptime monitoring checks the deployed origin and a representative deep link.
- [ ] Repository variable `DEPLOYMENT_URL` is configured and the scheduled deployment monitor has produced a passing run.
- [ ] Deployment failure and outage notifications have an owner.
- [ ] Production logs can be reviewed without exposing backup payloads or secrets.
- [ ] Incident owner and escalation path are documented.
- [ ] Rollback has been rehearsed or the exact rollback command/path is documented.
- [ ] [Operations runbook](operations-runbook.md) owners and escalation path are filled in.
- [ ] Previous known-good deployment and commit are recorded.
- [ ] Production database migration and rollback policy is reviewed.

## Decision

- [ ] Privacy/data notice, legal contact, retention policy, and required terms are reviewed for the target launch jurisdiction.
- [ ] **Approved for production**
- [ ] **Approved for controlled beta only**
- [ ] **Blocked pending remediation**

Decision notes and accepted limitations:

```text
______________________________________________________________________________
______________________________________________________________________________
______________________________________________________________________________
```

The current repository baseline is a local-beta baseline. Until the external deployment, real Supabase, manual QA, recovery, and operations sections are checked, this document must not be marked “Approved for production.”
