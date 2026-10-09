# WheelForge Project Audit and Product Roadmap

**Reviewed:** October 9, 2026
**Project reviewed:** `C:\Users\charl\OneDrive\Desktop\WheelForge`

## Product Direction

WheelForge should be a local-first random decision and generator workspace: quick to use for a one-off choice, expressive enough for reusable weighted wheels and multi-step generators, and trustworthy when used for a classroom draw or casual competition. A tournament is a distinct workflow built around participants, matches, standings, and recorded outcomes; it can use wheels to randomize fixtures or match conditions without pretending that a random pick is the same as competitive performance.

The near-term product goal should be **a complete, dependable local product**. Authentication, cloud storage, public sharing, and certified randomness are meaningful upgrades, but they add security, privacy, operational, and legal obligations. They should follow a stable data model, resilient local persistence, and validated user journeys.

## Audit Snapshot

### Implemented and connected

- **Template packs and event kits:** five built-in kits (Classroom Rotation, Giveaway Night, Fantasy Story Lab, Writing Prompt Lab, and Tournament Night) now install as independent wheel/generator copies with fresh IDs and remapped references. User pack snapshots, pack favorites/recent history, rename/delete, JSON export, and tournament setup metadata are persisted in the versioned local workspace.

- Vite + React + TypeScript application with routed home, dashboard, wheel editor/spin, chain editor/runner, templates, settings, and tournament pages.
- Wheel creation and editing, configurable entries, colors, weights, equal/weighted visual layouts, spin duration, special result labels, and option import helpers.
- Wheel editors accept pasted options and CSV files with a review step. CSV supports one-column labels or label/weight columns, quoted fields, BOM, invalid-row feedback, and repeated labels as separate probability-bearing entries.
- Weighted selection is chosen before the animation; the canvas animates to the selected option rather than deriving the result from where an uncontrolled animation stops.
- Weighted picks and random tournament shuffles use the Web Crypto random source when available; tournament indices use rejection sampling and weighted calculations scale by the maximum weight to avoid overflow. This is a stronger local random source, not an independently verifiable or signed draw.
- Normal, elimination, no-repeat, and remove-winner behavior are represented in the editor and applied in the spin flow.
- Accumulation mode is available as a wheel/default setting, tags its saved results, shows per-option pick totals in the spin view, and can be reset by clearing that wheel's history; it never removes winners.
- Result effects include a short reveal, rare/special-result confetti, and opt-in synthesized sound for standalone and chain spins. In-app and operating-system reduced-motion preferences suppress movement/particles; unsupported audio stays silent without interrupting a spin.
- Per-wheel spin history and result details, including displayed chance and weight.
- Chains can refer to wheels, run in order, auto-spin with a delay, resume a partially completed session, and evaluate equals/not-equals/contains conditions with fallback wheels or optional skipped steps.
- Built-in and user-saved wheel/generator templates create independent editable copies. The gallery includes text search across names, descriptions, categories, generator steps, and wheel options; category/type filters; persistent favorites; and an eight-item most-recently-used filter stored in the versioned backup. Users can save templates from the dashboard, then use, favorite, rename, and delete them. Generator snapshots include their dependent wheels and remap step, fallback, and condition references when copied. Using a chain template records the chain rather than its component wheels as recent.
- Dashboard has saved wheels/chains, recent spin data and summary metrics, plus edit, duplicate, run/spin, and delete actions; tournament links and summary are included.
- Home is an actionable first-use launchpad with paste-to-spin validation, direct workflow templates for food, prizes, classrooms, and fantasy stories, plus custom wheel, generator, and tournament entry points.
- Settings include theme, motion/animation preferences, spin defaults, backup import/export, demo data restore, and local reset. Backup import now previews record counts and ID collisions, then explicitly offers replace or merge; merge preserves current matching IDs and settings, adds new IDs, and unions favorite/recent template markers.
- Versioned local data uses `wheelforge_data_v1`; import checks shape and retains compatibility with earlier version-one backups that predate tournament, favorite, recent-template, and user-template fields. Import review rechecks its workspace snapshot before applying and refreshes the preview when another tab changed the data.
- Input validation, participant paste-and-deduplicate import, single-elimination brackets and round-robin schedules with entry-order/random seeding, automatic byes, manually recorded match winners, progression, result undo and correction, dependent-path reopening, pre-result title/roster/seeding/format edits, persistence, standings, and text export. Round robin supports configurable win/draw/loss points, score-based draws, W-D-L records, and score correction/undo; legacy tournaments receive the default 3/1/0 scoring policy.
- Tournament activity history records result entry, correction, undo, and dependent matches reopened. It is shown in the tournament detail view and included in the text export; it is local application history, not tamper-proof or independently verified evidence.
- Reduced-motion handling, keyboard focus return and trapping in the result modal, live spin/result announcements, a named canvas text alternative, semantic option/chance list, and accessible labels exist in key flows.
- Unknown URLs show an in-shell 404 with navigation back to useful destinations. React render failures have a recoverable in-shell fallback, with a separate router-level error page for failures outside that boundary.
- Playwright now runs axe-core WCAG 2.0/2.1/2.2 A/AA checks across the home, dashboard, wheel editor/spin, chain editor/runner, tournament setup/preview/detail, templates, Settings, result dialog, and cloud recovery forms. It also verifies the main-content skip link, result-dialog focus trapping, Escape closure, and focus return. Findings for unlabeled chain fields, template preview ARIA semantics/keyboard scrolling, and tournament preview scrolling were fixed. This automated pass does not replace manual assistive-technology testing.

### Recommended next build order

1. **Protect the core paths:** browser journeys cover weighted custom-wheel creation/spin/settled pointer position, standalone elimination-spin undo, interrupted chain resume, backup export/import and malformed-file rejection, tournament preview-to-create identity, round-robin setup edits across format changes, and elimination-result correction with downstream reopening. Extend coverage to less common failure and recovery cases.
2. **First-use launchpad (implemented):** Home now provides “What do you want to do?” paths for quick spin, custom wheel, generator, classroom/giveaway templates, and tournaments, with advanced settings kept off the first screen.
3. **Finish templates as a product:** search, category/type filters, option previews, mode badges, persistent favorites, recents, and user-saved wheel/generator templates are implemented. A saved template can now replace its snapshot from a current wheel or generator while preserving the template's ID and name; projects previously created from it remain independent. Next add weight/odds badges, independent template export/versioning, and themed packs that pair wheels with useful chains.
4. **Polish tournament operations:** condition wheels, exact bracket/schedule preview, selectable round-robin seed-order or head-to-head mini-table tiebreaking, configurable points, score and best-of series entry, draws, correction, undo, privacy-reviewed CSV export, print-friendly schedule/standings, and full-screen host/audience views are connected. Host corrections warn before clearing dependent bracket results. Host check-in records attendance without changing pairings/results; explicit match-level forfeits, participant withdrawal, and configurable bye policies are recorded without silently changing unrelated fixtures.
5. **Expand formats only with testable rules:** double elimination now has a specified winners/losers map, automatic byes, reset grand final, unit coverage, and a browser creation journey. Next consider group-stage playoffs. Treat Swiss as a separate, later project: define and name the pairing algorithm, bye and withdrawal policy, repeat-opponent constraints, repeatable fixtures, tie-break ordering, and round-lock/reopen rules before coding. Do not call a simplified pairing heuristic FIDE-compliant. Add role/team tools on top of the reusable roster afterwards.
6. **Finish the cloud-backup rollout:** an optional Supabase Auth/Postgres path, per-user RLS migration, manual validated backup/restore, policy test, password-confirmed account deletion endpoint/UI, and password recovery/reset UX are now in the repository. Configure a disposable Supabase project, deploy and exercise the function, run database policy tests, and verify deployed email/redirect/environment settings before treating cloud mode as production-ready. Live sync and collaboration need a separate conflict/ownership design.

### Present but incomplete or needing a product-quality pass

- Tournament formats currently include single elimination (with optional third-place matches and best-of-1/3/5 series), round robin, and double elimination. Round robin uses a circle schedule, supports up to 32 entrants, configurable W/D/L points (default 3/1/0), score entry, draws, and seed-order or head-to-head mini-table tie-breaking; unresolved tied leaders share rank. Double elimination supports up to 64 entrants, explicit winners/losers routing, automatic byes, best-of-1/3/5 series, a reset grand final, and a locked reset fixture that activates only when required. Match scores/results and series games can be corrected or undone; double-elimination corrections currently require undoing back to the affected match to preserve dependent routing. Tournament CSV supports name anonymization and optional activity history; print mode lays out the schedule and standings. Host check-in records Expected/Checked in/Not present transitions without automatically changing fixtures. Explicit per-match forfeits advance the opponent in elimination or score as W/L using configured points in round robin (no score is invented); other fixtures are not removed. The first attendance update locks tournament setup. Participant withdrawal, configurable bye policy, and manual seed editing are implemented; Swiss, group stages, and free-for-all remain future formats. Saved-wheel condition draws are supported separately from winner recording. Setup shows the exact bracket/schedule before creation and saves reviewed random seeding unchanged. Title, roster, seeding, format, scoring, and tiebreak policy are editable before the first event action; recorded event history then locks setup.
- Built-in, user-created, and custom pack templates are searchable, reusable, renameable, removable, favoritable, and copied independently; user packs can be exported/imported, updated with independent component snapshots, diffed, and restored to prior versions. Existing user-template snapshots can be replaced from a saved wheel or generator without changing the template ID/name or existing copies. A shared community gallery and template update channel remain to be built.
- Browser localStorage remains the default and works without configuration. An optional Supabase Auth and Postgres backup path is implemented with manual upload/restore/delete, but no Supabase project or credentials are configured in this checkout. Backup-file merge is implemented with an explicit ID policy. Wheel, generator, and pre-result tournament setup editors now reject stale saved versions; they preserve the draft and offer reload or a separate copy where appropriate. Settings are patched against the latest workspace. These are optimistic stale-draft protections, not an atomic multi-tab transaction: simultaneous writes can still race because the whole workspace is a localStorage value. Automatic cloud sync, collaboration, hosted share links, and embed mode are not implemented.
- CSV-file preview is implemented for weighted wheel options and tournament participants. Wheel rows support optional weights; roster imports detect common headers, allow explicit name-column mapping, deduplicate names case-insensitively, and offer append or replace.
- The cloud path has not been exercised against a live project or local Supabase stack in this environment: Supabase CLI, Docker, and `.env.local` are absent. The app adapter has mocked unit tests, conflict-aware writes, and the migration has a committed pgTAP policy test; run that database test and deploy/test the account deletion Edge Function, conflict flow, and password recovery against a disposable project before rollout.
- Same-tab writes and cross-tab storage events feed cached `useSyncExternalStore` selectors used by the dashboard, spin view, chain-builder wheel picker, and tournament list/detail. Browser journeys prove new records appear in already-open peer tabs. Local backup review detects a changed workspace snapshot and asks for a fresh choice. Wheel/generator/tournament setup drafts compare their captured `updatedAt` with the latest saved version before overwrite; stale drafts stay visible and require reload or an explicit copy/discard. Preference changes merge as individual patches. Browser tests cover these flows. This remains optimistic version checking rather than atomic compare-and-swap; simultaneous cross-process writes and conflicts in other workflows still need a stronger storage transaction design.
- The wheel canvas now has an image role and descriptive accessible name; a semantic option/chance list provides a non-canvas representation, and a polite live region announces spin start and result odds. A fully interactive non-canvas visualization and broad screen-reader/manual assistive-technology testing remain outstanding.
- The project has focused logic tests, a coverage gate, a Playwright Chromium browser suite for high-risk end-to-end journeys, cross-browser smoke configuration, deployment configuration validation, a deployed-site smoke script, and a documented deployment runbook. Monitoring, live deployment evidence, live cloud evidence, recovery-drill evidence, and manual browser/accessibility verification remain outstanding. Passing automated checks is a useful baseline, not a production-readiness certificate.
- `product-plan.md`, `roadmap.md`, and `backend-plan.md` do not reflect the current application. This document and `docs/release-readiness.md` are the current product/release references; add deployment, recovery, and browser support evidence before external release.

### Progress since this audit was first written

- Local persistence now exposes persistent vs in-memory health, falls back to memory when browser storage is unavailable or writes fail, and displays a persistent warning in the app shell.
- Corrupt saved data is preserved during ordinary edits; only a valid backup import or explicit reset overwrites it.
- Backup imports now have a contents/collision review and explicit replace-or-merge choice. Merge keeps current records on matching IDs and current settings; the review detects changes from another tab before applying and requires the user to decide again.
- Wheel-option CSV files can be previewed with optional weights and row errors; repeated entries stay separate tickets. Tournament participant CSV preview supports first-column import, duplicate-name handling, and append/replace choices.
- Same-tab writes and cross-tab storage events publish a shared revision consumed through stable cached data selectors. Dashboard, spin, chain-builder wheel choices, and tournament views refresh across tabs; a two-tab Playwright journey checks the list and wheel-picker cases. Draft editing state is kept local to avoid overwriting unsaved user input.
- Regression tests cover write-failure continuity, stale-data recovery, corrupt-data preservation/recovery, accumulation counts, and reduced-motion gates.
- Accumulation mode is connected to standalone and chain spins, is backward-compatible with older untagged history, appears in a classroom participation template, and has import/count/removal-precedence tests.
- Confetti and sound settings now control result effects in standalone/chain spins, with browser audio initialized from the spin gesture and operating-system reduced-motion behavior tested.
- Round robin is now implemented with even/odd circle scheduling, automatic bye slots, manual result and score recording, configurable win/draw/loss points (default 3/1/0), standings, tied ranks, completion detection, correction/undo, an estimate/32-participant UI cap, and migration of older tournaments without format/scoring fields. Regression tests cover schedule pairing, scoring, draws, ties, correction, undo, and backup compatibility.
- Match correction is available for completed elimination and round-robin matches. Elimination corrections reopen only the downstream path affected by the changed winner, preserve independent matches, and ask for confirmation when later results will be cleared. Round-robin standings recalculate from the corrected result.
- Tournament result and condition-draw actions now append sequenced local activity events. Older version-one backups migrate to empty event histories without losing bracket data; import validation checks event shape and sequence ordering.
- Organizers can update tournament title, roster, seeding, and format before any match result is recorded. Pairings/byes are regenerated, unchanged participant names retain IDs, duplicate/count checks are applied, and setup is locked after result events or existing completed matches (including legacy data). Service-level coverage confirms changes persist in local storage.
- Tournament creation now generates a full bracket or round-robin schedule for review before saving. Random seed order and match IDs are kept on the exact preview object; changing any setup field clears the preview, and the confirmation saves that same draw rather than re-randomizing. The browser journey verifies odd-player byes, stale-preview invalidation, and that the created schedule retains every reviewed match ID.
- Playwright browser tests now exercise round-robin setup edits and schedule regeneration through format changes, custom weighted wheel creation and a spin whose selected segment remains under the pointer after dismissing the result, elimination-result correction with dependent-final reopening, and tournament condition draws separated from winner recording.
- Template discovery now supports searching option/step names as well as template metadata, category and type filtering, and favorites that persist across reloads and export/import through `wheelforge_data_v1`. Existing version-one backups without favorites migrate to an empty favorites list. A Playwright journey covers favoriting, reload persistence, option search, category filtering, and creating an editable wheel copy.
- Tournament matches can spin a saved wheel for a map, challenge, or rule. The condition snapshot (source wheel, option, weight, chance, color, timestamp) is stored on the match and in the sequenced local activity log; it is included in text copy/export, persists across reload and backup import, and is explicitly separate from the manually recorded winner. The condition spinner uses active options and their weights without changing standalone wheel history or options. Match-slot conditions stay attached when upstream results are corrected.
- The spin canvas now exposes descriptive fallback text, the probability preview has named list/list-item semantics with weight and effective chance, and a polite live region announces spin start and the completed result. The wheel browser journey asserts those accessibility hooks as well as the pointer landing state.
- Standalone spin history supports undoing only the latest standalone result for a wheel. The result is removed and an option removed by that spin is restored in the same persisted update; undo does not skip over a newer chain result. Spin history records whether the spin removed its option, and backup validation accepts the field as optional for backward compatibility.
- Multi-winner draws select unique labels without replacement while preserving duplicate ticket weights in each label's conditional odds. Each draw is stored as a validated batch in version-one backups, shown as a reversible winner list, and can be copied or downloaded; undo removes the complete batch and never mutates the saved wheel. Unit and Chromium browser tests cover duplicate labels, odds recalculation, backup validation, export, and batch undo.
- Backup import now parses and validates the file before asking to replace existing data. The replacement warning accounts for wheels, chains, spin history, chain sessions, tournaments, favorites, saved templates, and non-default preferences. A browser journey verifies export/import round-trip, restored preferences and data, and that malformed JSON neither prompts nor changes the workspace.
- A browser journey verifies an interrupted fantasy generator resumes at the next step after reload, retains its prior result, and continues the same persisted session.
- Users can save wheels and generators from the dashboard as reusable templates. Wheel snapshots start with removed entries restored; generator snapshots include referenced wheels and remap wheel IDs, step IDs, condition dependencies, and fallbacks on use. Templates can be renamed/deleted from the gallery; deletion also removes its favorite/recent references. Unit and browser tests cover independent copies, preserved dependencies, persistence across navigation, and malformed imported snapshots.
- Users can replace a saved template's snapshot from a selected saved wheel or generator. This updates the content and description while preserving the template identity/name; prior copies remain unchanged. Unit and browser tests cover replacement, ID/name preservation, and copy independence.
- Round-robin tournaments can select seed-order or head-to-head mini-table tie-breaking. The policy is included in previews, setup edits, standings, champion detection, and text exports; older backups migrate to seed order. Unit, backup-migration, and browser tests cover the scoring behavior and configuration flow.
- Optional cloud backup now supports Supabase email/password auth, per-account upload/restore/delete, local fallback, payload validation, explicit overwrite confirmations, and a volatile-local-storage upload guard. Added a least-privilege private workspace migration, account-isolation pgTAP tests, environment template, setup guide, and mocked adapter tests. This checkout has not applied the migration to a real or local Supabase database.

### Not implemented

- Tournament formats beyond the shipped single elimination, round robin, and double elimination: Swiss, group stage, and free-for-all.
- Cross-tournament participant profiles/history and an independently verifiable or tamper-resistant audit record remain future work. Third-place matches, best-of-1/3/5 series, participant-wide withdrawal policy, configurable bye rules, tournament CSV, and print exports are implemented; the current event history remains local and editable through the backup file, so it must not be represented as certified evidence.
- Live Supabase project configuration, verified end-to-end account/backup/deletion/recovery behavior, automatic sync, collaboration, shareable links, embed mode, and server-side random proofs.
- Signed or independently verifiable random draws, immutable draw records, event lock/freeze, and publicly verifiable audit records.
- Image entries, drag-and-drop CSV import, captains/role automation, and independently verifiable ordering remain future work. Full-screen host/presentation mode has a ready-match queue, condition draw and separate result controls, match undo, responsive layout, read-only audience mode, and attendance tracking.

## Product Principles and Domain Rules

1. **Tell users what is random.** A weighted giveaway, a shuffled bracket, a randomly selected map, and a judged match are different procedures. Label the source of the outcome and disclose weights before a draw.
2. **Keep the quick path short.** A new user should be able to paste entries, spin once, understand the result, and start over without visiting settings or a tutorial.
3. **Make repetition safe.** Elimination/no-repeat modes must state whether state persists per wheel, per chain session, or per tournament, and provide a reversible restore/reset action.
4. **Protect work.** Autosave locally, explain import replacement, offer export before reset, and never silently overwrite a recoverable bracket or draw.
5. **Make generators readable.** A chain result should be a well-composed, copyable artifact, not merely a list of disconnected modal results.
6. **Treat accessibility as behavior.** Keyboard operation, reduced motion, focus management, announcements, text alternatives, and contrast belong to acceptance criteria for each feature.

## Recommended Delivery Plan

### Milestone 0: Stabilize the local product

**Why now:** Core local features exist; reliability, recovery, and clarity are the highest-value next investments.

- [x] Define and test stale-draft behavior for wheel, generator, and tournament setup forms: reject outdated saves, preserve the draft, and require reload or a separate copy/discard. Preference updates patch the latest workspace instead of writing a stale settings object.
- Extend the stale-write policy to other editable records and destructive actions; choose a transactional store or cooperative lock strategy before claiming atomic cross-tab writes. Do not replace active drafts from a storage event.
- Harden persistence for unavailable storage, quota errors, malformed stored data, backup size limits, and interrupted imports. Show actionable error state instead of silently presenting an empty workspace.
- [x] Preview backup record counts and ID conflicts; explicitly choose replace vs merge with documented, tested conflict behavior. Recheck the workspace before applying and require a renewed choice when another tab wrote during review.
- Atomic multi-tab read-modify-write is still unresolved. The HTML Standard advises authors to assume localStorage has no locking mechanism across multiprocess contexts; a stronger design must serialize all write paths (not only editor submits) before promising atomicity. Add a dedicated export format contract and migration tests before changing the schema version.
- Audit all settings controls and wire any remaining gaps; confetti/sound preferences and reduced-motion respect are implemented.
- Add browser-level smoke tests for create/edit/spin/eliminate/restore, create/run/resume chain, template creation, backup round trip, and both tournament formats including progression/undo.
- Add a true empty state and make the default route intentionally lead users into a useful first action (create, try a template, or explore demo data).

**Done when:** all major flows work after reload, errors are visible and recoverable, and browser tests exercise a fresh profile plus an existing-data profile.

### Milestone 1: Make wheels effortless to operate

- Add inline rename, duplicate, delete, and drag-to-reorder options; preserve keyboard reordering and stable ordering on import.
- Expand entry input into a fast multiline editor with paste, CSV import, duplicate handling, blank-line feedback, and row-level validation. Wheel CSV preview and weighted import plus roster CSV preview with append/replace are implemented; add column selection for alternate roster formats and retain single-line add for quick edits.
- Provide a focused spin mode: large wheel, result, current odds, undo/restore winner, spin again, copy/share text, and expandable history. Avoid presenting editor controls during a live host session.
- Add accessible option-list/table fallback synchronized to canvas; announce winner, chance, and whether an entry was removed.
- Add “shuffle full order” and “pick a team/role” actions on top of the now-implemented unique-label multi-winner draw.

**Done when:** a first-time user can create a 30-entry wheel by paste, reorder it, run a no-repeat draw, undo/restore, and export without confusion.

### Milestone 2: Template library and easy UI

- Add template search, category chips, popularity sorting, and feature tags; keep controls compact and mobile-friendly. A recent-use filter is implemented.
- Build deeper curated sets: food, date night, movie, chores, workout, classroom picker, giveaway, icebreakers, names, study break, daily challenge, fantasy NPC/location/plot, writing prompts, D&D encounter/loot, debate topics, and team roles.
- Each template should explain its intended use through its title/description, show actual options, indicate mode/weight behavior, and create an independent editable copy.
- Saving a wheel or chain as a template, gallery use/rename/delete, and replacing a saved snapshot from a current wheel/generator are implemented. Next allow editing template metadata, exporting templates independently, and versioning their schemas for safe upgrades.
- Add a guided “What are you deciding?” creation flow (decision, giveaway, classroom, generator, tournament) that sets sensible defaults but always allows direct wheel creation.

**Done when:** templates are discoverable, searchable, reusable, editable, and do not mutate their source or the user's existing wheel.

### Milestone 3: Generators that produce shareable artifacts

- Improve chain builder with a visible step flow, reorder, duplicate/remove, required/optional controls, condition builder that reads like plain language, and preview of the resolved path.
- In runner, reveal each result at a comfortable pace; support manual/auto progression, pause/cancel, step rerun, whole-chain rerun, and preserve prior results when rerunning one step.
- Add generated-output templates, e.g. “A [genre] story about [character] in [setting] where [conflict], with a [mood] tone.” Let creator define output format.
- Add session summary with copy, plain-text/JSON export, favorites, and accessible result announcement.
- Add test cases for dependency order, skipped optional steps, fallback wheel use, repeat state, interrupted/resumed sessions, and edited/deleted source wheels.

**Done when:** a generator is a coherent saved tool that reliably produces a usable result and is easy to replay or share locally.

### Milestone 4: Tournament wheel and tournament workspace

Keep tournament logic separate from standard `Wheel`/`SpinChain` models. The tournament owns participants, format, rounds, matches, standings, outcomes, and event history. Reuse wheel mechanics through explicit tournament actions rather than making the bracket itself a wheel.

**Setup flow:** title; paste/import participants; trim and deduplicate with a review step; optional seeds/ratings/weights/teams; format; best-of and score rules; seeding; optional challenge/map/rule wheel; review bracket; lock/start.

The current setup supports entry-order/random seeding, a schedule estimate, and title/roster/seeding/format edits before the first result. Keep a **Quick setup** path (name, pasted roster, format, create) and place manual seeds, team labels, match rules, and condition wheels in **Advanced options**. Before creation, show a read-only pairing preview and a clear estimated match count. After the first result, freeze participants/configuration by default; corrections should be explicit, timestamped, and explain which later results become invalid.

**Match modes (label prominently):**

- **Record match result:** participants compete outside WheelForge; organizer selects winner and optionally enters game score, notes, and proof/reference.
- **Spin for match conditions:** wheel picks map, challenge, side, role, or rule; organizer records the actual winner separately. Keep condition draw in the match audit log.
- **Random winner draw (implemented):** explicit chance-based mode for casual games/prize drawings only; the host reviews entrants, ticket weights, and effective odds. Multiple winners are unique and selected without replacement. The event snapshot and undo are recorded separately from match history; the feature never advances a bracket or changes standings.

**Format sequence:**

1. Polish single elimination and round robin: broaden score/undo/reopen edge-case tests; define participant-wide withdrawal handling and explicit bye policy. Tournament-local check-in and manual match forfeits, CSV/printable exports, host-side correction with dependent-match warnings, and the responsive host/audience queue are implemented. Round robin already supports configurable W/D/L scoring, score-based draws, standings/tiebreaks, correction, and undo.
2. Add double elimination only after loser-bracket routing, byes, participant loss counts, grand-final reset rules, correction invalidation, and restart/recovery paths have written scenarios and tests.
3. Consider group stage + playoffs next. Add Swiss only after selecting and documenting one pairing algorithm and defining repeat-opponent avoidance, bye allocation/rotation, rounds, withdrawals, standings, and tie-break policies. Swiss pairing is not just sorting players by score: FIDE's current 2026 rules require published/transparent pairing procedures and reproducible results for regulated use. WheelForge must name its algorithm and avoid claiming FIDE compliance unless it actually conforms to the current rules. Then consider free-for-all.

**Tournament screens:** setup/review, live event control (next match, score entry, condition spin, undo/correct), bracket/standings, participant list, match history/export. For mobile, offer a match queue/table view rather than forcing a very wide bracket.

**Done when:** tournament results are explainable, reversible, persisted, exportable, and every random decision says exactly what it decides.

### Milestone 5: Trust, sharing, and hosted production

- Add immutable event log entries for participant-list snapshot/hash, configuration snapshot, action, timestamp, actor, random mode, result, and correction link. A hash alone is not proof that the draw was unbiased; explain its limits.
- Introduce explicit fairness levels: Web Crypto-backed local randomness for casual use (implemented, with a `Math.random` fallback in restricted runtimes); reproducible seeded draw for replay/debug; server-generated result with signed third-party randomness only if a suitable provider and abuse-resistant server design are selected. Do not describe local draws as certified, auditable, or tamper-proof.
- Use private-by-default share links with read-only vs editable permissions, revocation/expiry, unguessable tokens, rate limits, and privacy-aware entrant export. Do not expose personal identifiers by default.
- Optional Supabase Auth and manual private cloud backups are implemented, with a password-confirmed account deletion UI, caller-bound Edge Function, and password recovery/reset UX. Finish local/live database policy, function, and email flow testing plus provider configuration and operational recovery before rollout; implement automatic sync and sharing only with explicit conflict, authorization, and privacy designs.
- Keep local mode fully useful if a user declines sign-in or sharing.

**Done when:** shared data has tested authorization, privacy expectations, revocation, deletion, and recoverable backups; draw claims match the actual random source.

## Correlated Feature Backlog

| Feature | Natural connection | Complexity | Recommendation |
|---|---|---:|---|
| Template wheels and template packs | Faster first success, reusable use cases | Low-medium | Milestone 2 |
| User-created templates | Repeated classroom/event workflows | Medium | Milestone 2 |
| CSV/paste/import preview | Large wheels and tournament entrants | Low-medium | Weighted wheel and first-column roster previews implemented |
| Multi-winner draw / full random order | Giveaway, seating, and event ordering | Medium | Weighted no-replacement order across every active entry, duplicate-safe history, odds, export, and batch undo implemented |
| Tournament condition wheel | Maps, challenges, sides, roles | Medium | Tournament milestone, early |
| Tournament winner wheel | Casual lottery/party game only | Medium | Ticket-weighted multi-winner draw implemented; external verification is future work |
| Team splitter | Classrooms, game nights, events | Medium | After participant list model is reusable |
| Balanced teams | Weights/ratings across teams | High | Later; explain balancing objective and limits |
| Role/seating/order assignment | Classroom and event workflows | Medium | Reuse participants and draw queue |
| Full-screen host mode | Presentations, streams, classroom projection | Medium | Shipped locally with check-in and explicit match forfeits; participant withdrawal remains |
| Share/embed | Remote audience and public templates | High | After backend authorization and privacy controls |
| Fairness history | Giveaways and public events | High | Basic local event log first; certified draws later |
| Image entries | Visual classroom/game wheels | Medium-high | After upload/storage and moderation decisions |
| Analytics | Repeat use and weighted fairness | Medium | Start locally with draws per option/expected chance |
| Multi-wheel packs | Coordinated generators and tournament kits | Medium | After user template packs exist |

### Product concepts worth validating

- **Tournament kit templates:** “Mario Kart night” or “Classroom quiz league” can bundle an entrant-list template, a format preset, optional map/challenge wheels, and match-result rules. Applying a kit creates independent editable copies; it never silently changes an active tournament.
- **Tournament wheel, three clear jobs:** (1) randomize seeds/pairings, (2) select match conditions, or (3) draw a chance-based winner. Label the action before confirmation and persist which job produced each result. Do not make “spin to decide who won” the default for competitive formats.
- **Event host mode:** show the active match, participants, condition result, score entry, next match, and undo/correction in a large readable view. A separate audience display can hide controls and private entrant data.
- **Participant tools:** CSV preview, duplicate resolution, absent/check-in status, team labels, random order, role assignment, and winner-repeat prevention all reuse one normalized roster. Balanced teams should be a later opt-in tool with an explicit objective (e.g. distribute ratings evenly), not a vague promise of fairness.
- **Useful completion artifacts:** copyable winner/standings, printable bracket or schedule, JSON/CSV backup, and a compact result image. Include only data the organizer selected for export.
- **Progressive UI:** start with a short form and presets, then reveal probability, scoring, tiebreak, and audit controls under advanced sections. Every preset should disclose the settings it applies.

## Initial Schema Direction

Do not fold every feature into a generic “wheel” record. Keep bounded domains and version backup migrations deliberately:

- `Wheel`: options, visual and probability behavior, removal policy, appearance.
- `SpinSession` / `SpinResult`: wheel snapshot or config revision, selected entry, effective odds, random mode, timestamp, removal state, undo linkage.
- `Template`: immutable built-in or user-owned definition, category, tags, version, origin.
- `SpinChain` / `ChainSession`: ordered steps, conditions, fallback, generated output format, session progress.
- `Tournament`: format/configuration, participants, seeding, current status.
- `TournamentMatch`: participants, round, score, winner, condition draw, notes, correction history.
- `TournamentEvent`: append-only actions for draw/result/config changes; current state can be derived or reconciled from events.

Use stable IDs, UTC timestamps, schema migrations, and explicit optional fields. Keep personal participant data out of public exports unless the organizer explicitly includes it.

## Research Notes

Product references show recurring demand for weighted entries, winner removal/no-repeat, saved and shareable wheels, and visible result history. Randomizer products also distinguish ordinary, elimination, and accumulation behaviors. Tournament platforms commonly support single/double elimination, round robin, Swiss, free-for-all, and staged competitions; these are separate algorithms with different standings and correction requirements, not cosmetic variations of one bracket. Professional draw products emphasize entrant validation and durable records, while signed random APIs make provenance verifiable but require server-side credential handling.

Research references reviewed September 22, 2026: [Wheel of Names FAQ](https://wheelofnames.com/faq) documents weighted probabilities and saved/shared wheels; [Picker Wheel](https://pickerwheel.com/) exposes normal, elimination, and accumulation modes; [Challonge's format guide](https://kb.challonge.com/en/article/learn-about-challonge-competition-formats-1f8j1cf/) illustrates that double elimination, Swiss, round robin, free-for-all, and staged tournaments have distinct rules. For Swiss, consult the [FIDE Basic Rules effective February 1, 2026](https://handbook.fide.com/chapter/C0401) and the [FIDE General Handling Rules effective February 1, 2026](https://handbook.fide.com/chapter/GeneralHandlingRulesForSwissTournaments202602): pairing methodology, repeat opponents, byes, score groups, transparency, and reproducibility are explicit domain requirements. [RANDOM.ORG's Third-Party Draw Service](https://www.random.org/draws/) describes reviewable records and privacy options, while its [Signed API](https://api.random.org/signatures) explains verifiable provenance; [WCAG 2.2 Animation from Interactions](https://www.w3.org/TR/WCAG22/#animation-from-interactions) supports a user setting to disable nonessential interaction-triggered motion. For cloud, current [Supabase React Auth guidance](https://supabase.com/docs/guides/auth/quickstarts/react) demonstrates the Vite/client setup, while its [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) requires per-operation policies, explicit grants, and policy tests for exposed tables. These are examples of market behavior and technical constraints, not endorsements or a claim that WheelForge currently meets equivalent fairness guarantees.

For browser verification, Playwright's [web-server configuration](https://playwright.dev/docs/test-webserver) supports starting the local Vite app as part of the test run, and its [browser setup guide](https://playwright.dev/docs/browsers) documents installing the matching Chromium binaries.

## Verification Baseline

On October 9, 2026, from the writable checkout at `C:\Users\charl\OneDrive\Desktop\WheelForge`:

- Current evidence: lint, 141 unit tests with the 70/65/75/75 coverage gate, TypeScript/Vite production build, static deployment configuration validation, 52 Chromium journeys including malformed local-data recovery, attendance isolation, explicit forfeit and undo/correction, best-of series, double-elimination reset/bye coverage, dependent-result coverage, and axe scanning, plus 2 mocked-cloud password recovery journeys. Firefox, desktop WebKit, mobile Chromium, and mobile WebKit each have three smoke journeys in the CI workflow.
- `npm audit`: 0 dependency vulnerabilities.

This verifies the local code quality gate only. It does not cover a production deployment, full accessibility conformance or manual screen-reader/browser testing, all browser journeys, backend security, or certified randomness.
