# Architecture

WheelForge is a local-first React and TypeScript application. The root Vite app is the deployable product; the legacy `frontend`, `backend`, `worker`, and `infrastructure` directories are not part of the WheelForge build and must not be deployed accidentally.

## Application Layers

- `src/pages`: route-level workflows for wheels, generators, templates, participants, tournaments, and settings.
- `src/components`: reusable layout, wheel, result, tournament, and common UI components.
- `src/hooks`: reactive selectors and persistence subscriptions used by pages and editors.
- `src/services`: stateful application operations such as wheel edits, spins, chains, templates, template packs, participants, tournaments, storage, and optional cloud backup.
- `src/utils`: deterministic domain logic, validation, CSV parsing, bracket generation, export formatting, and randomness helpers.
- `src/types`: persisted data contracts for wheels, options, spin history, chains, participants, tournaments, templates, settings, and workspace storage.
- `src/data`: built-in demo content, default settings, template wheels, generator chains, and template packs.

## Persistence Boundaries

The default workspace is stored under the versioned `wheelforge_data_v1` localStorage key. All imported and loaded values pass through schema validation and normalization. Writes use a workspace revision compare-and-swap guard, and stale editors preserve their drafts rather than silently overwriting newer data. This is optimistic protection, not a multi-record transaction; IndexedDB and record-level conflict resolution remain future work for large or collaborative workspaces.

Optional Supabase integration is deliberately manual: authentication and one private JSON workspace backup per account are provided when configured. It is not automatic synchronization or collaboration. The client uses only the publishable key; service-role operations are restricted to trusted staging verification and the account-deletion Edge Function.

## Tournament Boundary

Tournament logic keeps randomization separate from human outcomes. Wheels may draw seeds, maps, rules, or other conditions. Hosts record the actual match winner or score separately. Bracket generation and progression are pure domain operations covered by unit tests, while services persist reviewed schedules and append activity events.

## Verification Boundary

The root package scripts are the release gate: lint, coverage-gated unit tests, dependency audit, TypeScript/Vite build, static deployment configuration validation, Chromium workflows, and mocked cloud flows. Firefox/WebKit smoke coverage is configured in CI. Live hosting, Supabase isolation, monitoring, recovery drills, and manual accessibility testing remain deployment-operator responsibilities and are documented in `docs/deployment-runbook.md`.

