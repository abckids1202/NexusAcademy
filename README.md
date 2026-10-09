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
npm test
npm run build
```

The end-to-end suite uses Playwright and Chromium. Install its browser once, then run the full quality gate:

```bash
npm run test:e2e:install
npm run test:e2e
npm run check
```

`npm run check` runs lint, unit tests with the coverage gate, the dependency audit, the production build, static deployment configuration validation, Chromium browser tests, and cloud-mock tests. The browser suite starts its own Vite server on port 5199. GitHub Actions additionally runs the Firefox/WebKit smoke suite and uploads coverage and Playwright artifacts.

To run the cross-browser smoke suite locally:

```bash
npx playwright install chromium firefox webkit
npm run test:e2e:cross-browser
```

On Windows, Playwright Firefox may fail to launch with `spawn UNKNOWN`; the CI Ubuntu runner is the authoritative Firefox check when that host limitation occurs.

## Optional Cloud Backup

Local mode works without a cloud project. To enable account-backed private backups, configure Supabase by following [docs/backend-setup.md](docs/backend-setup.md). Never put a Supabase secret or service-role key in this browser app.

## Local Data

Workspace data is saved under the versioned `wheelforge_data_v1` key in browser local storage. Use Settings to export a backup before clearing site data or moving to another browser.
