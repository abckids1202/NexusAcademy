# WheelForge Release Readiness

**Last verified:** October 9, 2026

**Verified commit:** `ed78000 add deployment health endpoint`

## Verified in the current checkout

- `npm run lint` passes.
- `npm run test:coverage` passes with 142 tests across 13 source test files and the global coverage gate (70% statements, 65% branches, 75% functions, 75% lines).
- `npm run audit` passes with no high or critical advisories.
- `npm run build` passes.
- `npm run test:e2e` passes with 54 Chromium journeys.
- `npm run test:e2e:cloud` passes with 2 mocked cloud journeys.
- `npm run verify:deployment:config` passes with the SPA fallback and six required security headers.
- `npm run check` passes on the verified commit, including 54 Chromium journeys and 2 mocked cloud journeys.
- `npm run test:e2e:cross-browser` provides 3 Firefox, 3 desktop WebKit, 3 mobile Chromium, and 3 mobile WebKit smoke journeys in CI for routing, the shell, templates, and tournament setup; full feature coverage remains Chromium-based.
- Local Windows verification currently passes WebKit smoke tests; Playwright Firefox cannot launch in this environment (`spawn UNKNOWN`), so Firefox evidence must come from the Ubuntu CI runner or a manual Firefox session.
- Vitest is scoped to `src/**/*.test.ts`; legacy repository tests cannot silently contaminate the WheelForge gate.
- GitHub Actions runs lint, unit tests with the coverage gate, audit, build, Chromium browser tests, cross-browser smoke tests, cloud-mock tests, and uploads coverage and Playwright artifacts.
- Page routes are lazy-loaded; the main JavaScript chunk is approximately 371 kB minified.
- A shared local participant directory supports profile CRUD, archive/restore, search, backup persistence, tournament roster reuse, and group metadata carried into reviewed brackets.
- Tournament setup supports per-participant group/team labels, roles, seat numbers, random seat assignment, manual seed ordering, and metadata-preserving setup edits.
- Roster preparation can distribute participants across a chosen number of balanced, randomized team labels while preserving the reviewed assignment.
- Workspace writes carry a monotonic revision and compare-and-swap guard, so a stale tab write fails instead of silently replacing a newer workspace. Record-level conflict resolution and IndexedDB migration remain future work.
- Template-pack validation now checks wheel settings/options, duplicate IDs, chain steps, wheel/fallback references, metadata, and import boundaries before persistence or installation.
- Custom template packs can be assembled from saved wheels/generators, exported/imported, updated with independent snapshots, diffed by component, and restored to an earlier version without changing installed copies.
- Spin workflows can generate a full weighted random order across every active entry, including duplicate labels, with saved order, conditional odds, export, and batch undo.
- Tournament setup supports automatic or host-confirmed bye policies; manual byes remain pending, are confirmed from host/detail views, advance the bracket, and are recorded in activity history.
- Tournament participant withdrawal supports an explicit reviewed policy: advance opponents through affected pending fixtures or preserve pending fixtures. Withdrawals persist, update attendance, and appear in activity history.
- Tournament CSV imports detect common headers and support explicit participant-name column mapping, with legacy first-column files still supported.
- Single-elimination setup can add a third-place match; semifinal winners route to the championship and semifinal losers route to the placement match, with correction and undo support.
- Single-elimination setup supports best-of-1, best-of-3, and best-of-5 series. Each game is recorded independently, series scores remain pending until the win target is reached, whole-series forfeits are supported before play, and the latest game can be undone.
- Double-elimination setup supports up to 64 participants with explicit winners/losers routing, automatic byes, best-of-1/3/5 series, a reset grand final, and a locked reset fixture. Its creation and full reset-final lifecycle have unit and browser coverage; dependent corrections currently require undoing back to the affected match.
- Local persistence classifies quota exhaustion separately from generic write failures and surfaces recovery guidance to export a backup and clear unused data.
- Cloud backup writes re-read the current revision and use an `updated_at` compare-and-swap for existing records, rejecting stale browser uploads instead of silently overwriting a newer backup.
- A repeatable `npm run verify:supabase:staging` script exercises two temporary authenticated users against a configured staging project, verifies own-row CRUD and cross-account read/update/delete isolation, and cleans up the test users with the service role.
- Spin and auto-spin workflows expose an accessible percentage progress bar during long animations, announce collected results, stop the queue only after the current spin, and lock wheel selection while a queue is active.

## Release decision

WheelForge is suitable for a local beta release after a clean-clone check. It is not yet approved for a public production deployment because the cloud and operations controls below remain unverified.

## Required before public production

1. Create or designate a dedicated WheelForge GitHub repository, or formally document the current `NexusAcademy` remote as a monorepo and isolate the root WheelForge deployment from legacy directories.
2. Configure a staging Supabase project and verify RLS isolation with two real accounts.
3. Verify email confirmation, password recovery, account deletion, cloud restore, conflict handling, and redirect URLs against staging.
4. Deploy through the documented host configuration in `vercel.json` and verify HTTPS, security headers/CSP, environment variables, and rollback using `docs/deployment-runbook.md`.
5. Add error monitoring, uptime monitoring, backup retention, and a restore drill.
6. Complete manual keyboard, screen-reader, mobile, Firefox, Safari, Edge, and print QA.
7. Decide the local-data policy for large workspaces; current storage remains one `localStorage` document, with workspace revision compare-and-swap protection for concurrent writes but no record-level conflict UI. Quota exhaustion is detected and surfaced, but IndexedDB migration is still required for large production workspaces.

## Known product scope

The current tournament engine supports single elimination, optional third-place matches, best-of-1/3/5 series, round robin, and double elimination with winners/losers routing and a reset final. Team-level match scoring, Swiss, group stages, free-for-all, public sharing, collaboration, and independently verifiable randomness remain future milestones.
