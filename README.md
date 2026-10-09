# WheelForge

WheelForge is a local-first React and TypeScript app for weighted decision wheels, multi-step generators, templates, and tournaments. Tournament hosts can spin a saved wheel to draw a match map, challenge, or rule, while recording the real match winner separately. Browser storage remains the default; an optional Supabase Auth and Postgres integration provides explicit private cloud backups when configured.

## Getting Started

```bash
npm install
npm run dev
```

## Verification

```bash
npm run lint
npm run test:coverage
npm run build
```

The end-to-end suite uses Playwright and Chromium. Install its browser once, then run the full quality gate:

```bash
npm run test:e2e:install
npm run test:e2e
npm run check
```

`npm run check` runs lint, unit tests with the coverage gate, the dependency audit, the production build, static deployment configuration validation, the generated-client secret scan, Chromium browser tests, and cloud-mock tests. The browser suite starts its own Vite server on port 5199. GitHub Actions additionally runs the Firefox/WebKit smoke suite and uploads coverage and Playwright artifacts.

After deploying to staging or production, set `DEPLOYMENT_URL` and run `npm run verify:deployment` to check the live SPA routes, HTML shell, HTTPS, and required security headers. The manual GitHub Actions workflow provides the same deployed-site check plus real Supabase staging RLS verification when its environment secrets are configured.

To run the cross-browser and mobile smoke suite locally:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e:cross-browser
```

On Windows, Playwright Firefox may fail to launch with `spawn UNKNOWN`; the CI Ubuntu runner is the authoritative Firefox check when that host limitation occurs.

## Optional Cloud Backup

Local mode works without a cloud project. To enable account-backed private backups, configure Supabase by following [docs/backend-setup.md](docs/backend-setup.md). Never put a Supabase secret or service-role key in this browser app.

## Local Data

Workspace data is saved under the versioned `wheelforge_data_v1` key in browser local storage. Use Settings to export a backup before clearing site data or moving to another browser.
