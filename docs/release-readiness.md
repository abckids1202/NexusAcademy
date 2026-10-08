# WheelForge Release Readiness

**Last verified:** October 8, 2026

## Verified in the current checkout

- `npm run lint` passes.
- `npm test -- --run` passes with 125 tests across 11 source test files.
- `npm run audit` passes with no high or critical advisories.
- `npm run build` passes.
- `npm run test:e2e` passes with 46 Chromium journeys.
- `npm run test:e2e:cloud` passes with 2 mocked cloud journeys.
- Vitest is scoped to `src/**/*.test.ts`; legacy repository tests cannot silently contaminate the WheelForge gate.
- GitHub Actions runs lint, unit tests, audit, build, Chromium browser tests, cloud-mock tests, and uploads Playwright artifacts on failure.
- Page routes are lazy-loaded; the main JavaScript chunk is approximately 351 kB minified instead of the previous 515 kB.
- A shared local participant directory supports profile CRUD, archive/restore, search, backup persistence, tournament roster reuse, and group metadata carried into reviewed brackets.
- Tournament setup supports per-participant group/team labels, roles, seat numbers, random seat assignment, manual seed ordering, and metadata-preserving setup edits.
- Roster preparation can distribute participants across a chosen number of balanced, randomized team labels while preserving the reviewed assignment.
- Workspace writes carry a monotonic revision and compare-and-swap guard, so a stale tab write fails instead of silently replacing a newer workspace. Record-level conflict resolution and IndexedDB migration remain future work.
- Template-pack validation now checks wheel settings/options, duplicate IDs, chain steps, wheel/fallback references, metadata, and import boundaries before persistence or installation.
- Custom template packs can be assembled from saved wheels/generators, exported/imported, updated with independent snapshots, diffed by component, and restored to an earlier version without changing installed copies.
- Tournament setup supports automatic or host-confirmed bye policies; manual byes remain pending, are confirmed from host/detail views, advance the bracket, and are recorded in activity history.
- Tournament participant withdrawal supports an explicit reviewed policy: advance opponents through affected pending fixtures or preserve pending fixtures. Withdrawals persist, update attendance, and appear in activity history.
- Tournament CSV imports detect common headers and support explicit participant-name column mapping, with legacy first-column files still supported.
- Single-elimination setup can add a third-place match; semifinal winners route to the championship and semifinal losers route to the placement match, with correction and undo support.

## Release decision

WheelForge is suitable for a local beta release after a clean-clone check. It is not yet approved for a public production deployment because the cloud and operations controls below remain unverified.

## Required before public production

1. Create or designate a dedicated WheelForge GitHub repository; the current remote is named `NexusAcademy` and still contains unrelated legacy directories.
2. Configure a staging Supabase project and verify RLS isolation with two real accounts.
3. Verify email confirmation, password recovery, account deletion, cloud restore, and redirect URLs against staging.
4. Deploy through the documented host configuration in `vercel.json` and verify HTTPS, security headers/CSP, environment variables, and rollback using `docs/deployment-runbook.md`.
5. Add error monitoring, uptime monitoring, backup retention, and a restore drill.
6. Complete manual keyboard, screen-reader, mobile, Firefox, Safari, Edge, and print QA.
7. Decide the local-data policy for large workspaces; current storage remains one `localStorage` document, with workspace revision compare-and-swap protection for concurrent writes but no record-level conflict UI.

## Known product scope

The current tournament engine supports single elimination, optional third-place matches, and round robin. Team-level match scoring and advanced team balancing, double elimination, Swiss, group stages, free-for-all, best-of-N, public sharing, collaboration, and independently verifiable randomness remain future milestones.
