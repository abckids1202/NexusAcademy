# WheelForge Repository Boundary

WheelForge is currently maintained as the root application in the `NexusAcademy` repository. This is a deliberate monorepo decision until a dedicated WheelForge repository is created.

## WheelForge-owned paths

- `src/` and `public/`: the Vite React application and static assets
- `supabase/`: WheelForge migrations, Edge Functions, and database tests
- `scripts/`: WheelForge deployment and staging verifiers
- `e2e/`: WheelForge browser journeys
- `.github/workflows/`: WheelForge CI, database tests, staging verification, and deployment monitoring
- Root `package.json`, `vite.config.ts`, `vercel.json`, and `index.html`

## Legacy paths

The following directories are not part of the WheelForge deployment and must not be selected as the hosting project root or build source:

- `frontend/`
- `backend/`
- `worker/`
- `infrastructure/`

Those paths remain in the repository for historical or separate-project purposes. They should not be deleted or modified as part of a WheelForge release without a separate migration decision.

## Deployment invariant

The hosting provider must use the repository root with:

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js: 22 or newer

The root application is the only source covered by the WheelForge release gate. A future repository split must preserve the same tests, deployment headers, migrations, and release history before the old root is retired.
