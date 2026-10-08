# WheelForge Release Readiness

**Last verified:** October 8, 2026

## Verified in the current checkout

- `npm run lint` passes.
- `npm test -- --run` passes with 113 tests across 10 source test files.
- `npm run audit` passes with no high or critical advisories.
- `npm run build` passes.
- `npm run test:e2e` passes with 41 Chromium journeys.
- `npm run test:e2e:cloud` passes with 2 mocked cloud journeys.
- Vitest is scoped to `src/**/*.test.ts`; legacy repository tests cannot silently contaminate the WheelForge gate.
- GitHub Actions runs lint, unit tests, audit, build, Chromium browser tests, cloud-mock tests, and uploads Playwright artifacts on failure.
- Page routes are lazy-loaded; the main JavaScript chunk is approximately 351 kB minified instead of the previous 515 kB.
- A shared local participant directory supports profile CRUD, archive/restore, search, backup persistence, and tournament roster reuse.

## Release decision

WheelForge is suitable for a local beta release after a clean-clone check. It is not yet approved for a public production deployment because the cloud and operations controls below remain unverified.

## Required before public production

1. Create or designate a dedicated WheelForge GitHub repository; the current remote is named `NexusAcademy` and still contains unrelated legacy directories.
2. Configure a staging Supabase project and verify RLS isolation with two real accounts.
3. Verify email confirmation, password recovery, account deletion, cloud restore, and redirect URLs against staging.
4. Add a production host with HTTPS, security headers/CSP, environment-variable configuration, and a documented rollback procedure.
5. Add error monitoring, uptime monitoring, backup retention, and a restore drill.
6. Complete manual keyboard, screen-reader, mobile, Firefox, Safari, Edge, and print QA.
7. Decide the local-data policy for large workspaces and concurrent tabs; current storage remains one optimistic `localStorage` document.

## Known product scope

The current tournament engine supports single elimination and round robin. Roster column mapping, teams, participant-wide withdrawal, configurable byes, manual seed editing, double elimination, Swiss, group stages, free-for-all, best-of-N, third-place matches, public sharing, collaboration, and independently verifiable randomness remain future milestones.
