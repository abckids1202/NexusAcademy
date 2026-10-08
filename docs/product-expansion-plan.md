# WheelForge Re-audit and Product Expansion Plan

**Reviewed:** September 23, 2026  
**Project:** WheelForge (`C:\Users\charl\OneDrive\Desktop\wheelapp`)

## Executive Read

WheelForge has grown from a wheel demo into a capable local-first choice, generator, and casual tournament workspace. The core is real and connected: weighted wheels, chains, template copies, local backup/recovery, and two tournament formats all have automated browser coverage. The strongest direction is to make WheelForge the easiest place to run a decision or small event from setup through a trustworthy, exportable result.

The biggest gaps are now not basic wheel mechanics. They are simplifying the capabilities into low-friction journeys; completing event operations and outputs; connecting templates into reusable packs; and making tournament expansion correct before broadening formats. Cloud backup exists in code, but the configured live service and operational security are not verified in this checkout.

## Re-audit

### Implemented and connected

- **Template packs milestone:** the first event-kit layer is live with built-in multi-wheel packs, atomic local installation, dependency remapping, pack metadata/versioning, and independent user snapshots. The gallery includes category/search/favorite/recent behavior and an install review confirmation.

- **Wheel core:** create/edit/save; labels, colors, weights, equal or weighted visuals, spin settings, special result handling, paste and CSV preview; weighted result chosen before animation; pointer stays at the selected result.
- **Spin behavior:** normal, elimination/no-repeat/remove-winner behaviors and accumulation reporting; result history, effective odds, undo; multi-winner unique-label draw with per-pick odds, export, and batch undo; reduced motion and opt-in sound/celebration.
- **Generators:** ordered wheel chains, conditional steps, fallbacks/skips, auto-spin, persisted resumable sessions.
- **Templates:** built-in wheel and generator templates; search, category/type filters, favorites, recents, independent editable copies; save/update user templates, including cloning dependent wheels and remapping chain references.
- **Local workspace:** versioned `wheelforge_data_v1`; persisted workspaces are schema-validated before use, supported v1 legacy fields migrate, and malformed or unsupported raw values are preserved for diagnosis. Settings can download the preserved value, replace it with a validated backup, or reset after confirmation; ordinary writes cannot overwrite it. JSON backup replace/merge review, storage fallback, reset/demo restore, and stale-draft detection/recovery are covered.
- **Tournament core:** single elimination and round robin; reviewed exact schedule/seed preview; random or entry-order seeding; automatic bracket byes; roster paste/CSV import; configurable round-robin scoring and tiebreak; winner/score recording, draws, corrections, undo, progression, standings, event history, condition-wheel draws, and text export. A separate chance-based winner draw supports ticket-weighted odds, a reviewed eligible pool, multiple unique winners without replacement, result snapshots, and append-only undo. Tournament detail now offers a privacy-reviewed CSV export with optional participant-name anonymization and activity history, plus a print stylesheet for schedules and standings.
- **Cloud foundation:** Supabase Auth, manual private backup upload/restore/delete, password recovery/reset UX, account deletion endpoint/UI, SQL migration and RLS test source exist. This is implemented code, not proof of a configured production service.
- **Verification:** `npm run check` passed October 8, 2026 with ESLint, 125 unit tests, production build, 46 Chromium journeys (including malformed local-data recovery, explicit match forfeits, correction/undo, third-place matches, custom pack lifecycle, and automated axe coverage), and 2 mocked cloud recovery journeys. `npm audit --audit-level=high` reported zero high or critical vulnerabilities. Automated axe checks are not manual accessibility certification.

### Partial, absent, or unverified

- **Tournament formats:** no double elimination, Swiss, group stage/playoffs, free-for-all, league season, or best-of series. Single elimination supports optional third-place matches, and round robin remains available.
- **Tournament operations:** a full-screen host queue records elimination winners and round-robin scores, selects match conditions, supports undo and correction (including dependent-match warnings), and exposes a separate read-only audience screen. Host attendance tracking logs Expected/Checked in/Not present changes without changing fixtures. Hosts can explicitly forfeit one ready fixture; it awards the opponent the win, gives configured W/L points without inventing a score in round robin, and leaves other fixtures untouched. Participant-wide withdrawal, configurable bye policy, and manual seed editing remain absent. CSV and print output exist, but need manual print-preview checks across browsers and participant-facing export feedback.
- **Tournament wheels:** condition draws are implemented and recorded separately; randomize seeds is part of setup; chance-based ticket-weighted winner draws are now separate from match results and do not affect standings. These are local event records, not independent fairness certification.
- **Templates:** built-in multi-wheel/generator kits and tournament presets exist. Custom packs support JSON export/import, independent component snapshots, version diffs, and restoration; there is no shared community gallery or template update channel.
- **Participant toolkit:** reusable participant profiles, roster reuse, CSV name-column mapping, team labels, roles, seating, balanced team assignment, attendance, and reviewed withdrawal policies are implemented. Public sharing and richer participant-facing exports remain absent.
- **Import/export:** individual pack JSON export/import and roster column mapping are implemented. Public draw verification/export remains absent; tournament CSV still offers name anonymization and optional activity inclusion.
- **Storage concurrency:** stale editors notice newer versions and protect drafts, but the workspace is one localStorage object. That is not a transaction or conflict-free merge; simultaneous mutations can race.
- **Cloud readiness:** `.env.local` is absent and `.env.example` has blank credentials. SQL migration/tests and an Edge Function are present, but live RLS isolation, deletion, real email recovery, backup restore, and two-account checks have not been verified in a real Supabase project. No production deployment, monitoring, or recovery evidence was found in this checkout.
- **Draw assurance:** local Web Crypto is suitable for casual picks, not independent proof that a public prize draw was untampered. No signed provider record, immutable hosted audit log, or public draw verification exists.
- **Accessibility/browser coverage:** automated Chromium/axe checks pass; manual keyboard/screen-reader testing and additional browser/device coverage remain.

## Product Principle

Keep three jobs legible and separate:

1. **Choose:** a wheel decides among options, perhaps with weights or no-repeat behavior.
2. **Generate:** a chain combines results into a prompt, story, or structured output.
3. **Run an event:** a roster, ruleset, schedule, recorded human match results, and exports form the competition workflow. Wheels may randomize seeds or conditions, but do not decide who won a played match.

Randomness is a tool inside an event, not the event's rules engine.

## Phased Build Plan

### Phase 1: Make the everyday path effortless

**Goal:** a first-time user completes a useful decision in under a minute; advanced settings remain available without dominating the page.

- Put primary intents first: Quick pick, Create a wheel, Giveaway, Classroom, Generator, Tournament.
- Quick pick accepts pasted lines, previews entry count and duplicates, then spins immediately; offer “save as wheel” after success instead of requiring setup first.
- Make entries the editor's primary surface. Place weights, removal, accumulation, sound, duration, and appearance in named advanced sections with concise explanations and safe defaults.
- Before spin, summarize mode, active entries, removal/no-repeat rule, and winner count.
- Improve empty states with working template actions; preserve back-navigation and drafts.
- Add local-only analytics: session spins, recent results, option totals, and expected-vs-observed weights, with a note that small samples naturally vary.

**Acceptance:** journeys cover quick pick, save-after-pick, create/edit, template launch, back/refresh draft survival, keyboard operation, and reduced motion. No user needs to learn weights before they need them.

### Phase 2: Tournament Operations Pack

**Goal:** run a small in-person competition without leaving the app for roster handling, match flow, or final results.

1. **Shared roster:** participant ID and display name first; optional handle/team/seed/check-in/active status later. Warn on duplicate names and let the host distinguish real people rather than silently merging them. Keep private identifiers out of default exports.
2. **Attendance and match forfeits (implemented):** host can mark Expected, Checked in, or Not present; status changes enter activity history and do not silently alter fixtures/results. The first attendance update locks setup. Forfeit is an explicit per-fixture action: the selected participant forfeits, the opponent is the winner, and it does not withdraw the participant from later fixtures. In round robin it records W/L and configured points without a score; in elimination it advances through the existing bracket. Next define pre-start scratch and participant-wide post-start withdrawal behavior, including how any remaining fixtures are handled.
3. **Tournament wheel actions:** distinct commands for Randomize seeds (before start), Draw a match condition (map/rule/side), and Draw a chance-based winner (casual game/prize only). The chance draw now previews eligible participants and ticket odds, supports multiple winners without replacement, persists the entrant/weight snapshot and conditional odds, and records undo without erasing the original event. Continue to state that this is random selection, not a played match result.
4. **Live host queue:** large current-match view with next match, participants, condition draw, score/winner inputs, undo/correct, and read-only audience display. Mobile defaults to a queue/list, not a squeezed bracket.
5. **Outputs:** CSV standings/results, printable bracket or schedule, copyable summary, and configurable inclusion of names, emails/handles, notes, and draw history. Exclude contact details by default.

**Acceptance:** test roster import/check-in, condition draw vs result separation, chance draw odds/confirmation/log, withdrawal, correction/undo, mobile host queue, privacy-safe export, and full tournament backup round trip.

### Phase 3: Template ecosystem and event kits

**Goal:** reduce repeated setup without cloning stale or coupled data.

- Define versioned **packs** as manifests: pack metadata plus wheel templates, optional chains, tournament preset, and explanatory labels. Examples: Classroom Rotation, Giveaway Night, Party Game Night, Fantasy Story Lab, Mario Kart Cup.
- Applying a pack creates independent copies and remaps internal references. Preview exactly what will be created; allow component selection.
- Keep **template** (one wheel/generator), **pack** (related components), and **tournament preset** (format/scoring/roster behavior) separate. Do not store all as one generic wheel.
- Add pack search/tags, favorites/recents, update-from-pack with a diff, and export/import with schema versioning. Never silently overwrite an edited copy when a pack changes.
- Starter packs can include roles, maps, challenges, icebreakers, random order, team names, classroom jobs, and prize tiers.

**Acceptance:** pack application is atomic; import previews collisions; edits survive pack updates; migrations and malformed manifests have tests.

### Phase 4: Tournament format expansion

Add one rules engine at a time, with written rules and reference fixtures.

1. **Double elimination:** specify winners/losers routing, loss counts, byes, reset final if the losers-bracket finalist wins the first grand final, correction invalidation, and undo. Test entrant counts around powers of two and every transition before UI polish.
2. **Group stage into playoffs:** define group assignment/seeding, round-robin scoring, number advanced, tie policy, and transition snapshot; reuse the tested round-robin engine.
3. **Swiss:** select and name a pairing method; specify rounds, score-group pairing, repeat-opponent avoidance, bye rotation, withdrawals, tie-break order, and round locking/reopening before coding. Provide reproducible pairings and explain each. Do not claim FIDE compliance unless checked against current FIDE rules.
4. **Free-for-all/leaderboard:** after participant ordering and multi-winner semantics stabilize; define players per heat, advancement, placement scoring, and ties.
5. **League season/best-of:** use series-level records, not ad-hoc bracket matches; define schedule, home/away, aggregate, draws, and ties.

**Acceptance:** pure logic tests include invariants, seeded fixtures, correction/undo round trips, and import/export compatibility. The UI explains supported rules before creation.

### Phase 5: Teams, roles, and seating

- Random team split: choose team count/sizes; shuffle once; make result reversible and exportable.
- Balanced team split: optional ratings, explicit objective (e.g. minimize team total difference), constraints for known partners, deterministic tie policy, and clear warning that balance is approximate.
- Role/seating assignment: roles/slots, eligibility constraints, no-repeat history, unfilled-slot handling, lock action.
- Reuse random order for presentations, chores, classroom turns, race heats, and tournament seeds.

**Acceptance:** preview shows constraints and odds; undo restores the roster; exports omit personal fields by default.

### Phase 6: Trust, sharing, and release

- Validate live Supabase with two accounts: read/write isolation, RLS grants/policies, account deletion, email recovery, backup overwrite/restore, and outage behavior. Add repeatable test commands and an operational runbook.
- Keep manual whole-workspace backup distinct from live sync.
- For multi-device sync, design record-level revisions/conflict UI first. A single localStorage snapshot cannot safely merge simultaneous edits.
- Start sharing with read-only, revocable snapshots and privacy preview; editable collaboration is later. Require expiry/revocation, unguessable tokens, and authorization tests.
- Describe assurance accurately: local casual randomness; optional external verifiable service only after provider, cost, privacy, retries, and immutable result record are designed. A local hash alone does not prove fairness.
- Add deployment, error monitoring, backup/restore drills, browser/device testing, and manual keyboard/screen-reader review before public release.

## Correlated Feature Map

| Feature | Reuses | Value | Priority |
|---|---|---|---|
| Tournament condition wheel | Wheel + active match | Random map, side, rule, challenge | Shipped; expand through event kits |
| Chance winner draw | Roster + weighted multi-winner draw + event log | Raffles and casual outcomes | Shipped locally; consider externally verifiable records only for an advanced tier |
| Randomized seeds/order | Roster + secure shuffle + preview | Fair opening order | Setup shipped; add manual review/export |
| Multi-wheel template packs | Template cloning and ID remapping | One-click workflows | High |
| Tournament kits | Pack + tournament preset + wheels | Reusable event/classroom setup | High after pack primitives |
| Team splitter | Roster + shuffle + constraints | Classroom/game-night grouping | Medium-high |
| Balanced teams | Ratings + assignment optimizer | Competitive fairness | Later; objective must be explicit |
| Roles/seating/turn assignment | Roster + slots + no-repeat history | Events and classrooms | Medium |
| Host/audience mode | Tournament queue + result presentation | Projection and event operation | Shipped locally with check-in and per-match forfeits; participant withdrawal remains |
| Tournament CSV/print export | Schedule + standings + privacy selector | Publish/archive results | Shipped locally; manual cross-browser print QA remains |
| Public template gallery | Versioned packs + moderation | Discovery and reuse | Later; backend and abuse controls needed |
| Share/embed | Auth + revocation + privacy | Remote audience/reuse | Later, after live security checks |
| Image/audio-rich entries | Wheel media + asset pipeline | Expressive classroom/event use | Later; storage, licensing, accessibility |
| Draw verification records | Event snapshot + random provenance | Higher-trust prize draws | Optional advanced tier |

## Recommended Next Build

Continue tournament operations and template reuse in small releases, not another format immediately:

1. Check-in and per-match forfeit behavior are implemented and explicitly logged. Define pre-start scratch, participant-wide withdrawal and how it affects remaining fixtures, plus configurable bye policy; retain the mobile queue/audience split and make every roster-state change explicit in tournament history.
2. Define the pack schema and build multi-wheel/generator kits, including a tournament kit; then implement double elimination. Swiss comes only after its pairing rules are specified and tested as a standalone engine.
3. Manually test print output, keyboard workflows, and screen-reader announcements; complete browser/device coverage before a public event rollout.

## Research Summary

- Wheel products make weighted entries, persistence/sharing, and multi-wheel workflows familiar expectations. Wheel of Names' FAQ describes weighted probabilities, local/cloud persistence, and snapshot-style sharing.
- Tournament platforms distinguish single/double elimination, round robin, Swiss, free-for-all, and staged formats because progression rules differ. Challonge's guide is comparative product research, not a standard WheelForge must copy wholesale.
- FIDE Swiss rules effective February 1, 2026 state that rounds are declared in advance, repeat pairings are generally prohibited, byes have eligibility rules, pairings are generally among players with equal scores, and pairing methods must be transparent. A casual Swiss mode can use a simpler named algorithm, but must document what it does and must not imply FIDE compliance.
- Professional draw workflows emphasize validating entrants, confirming the final pool and winner count, and retaining a result record. Public prize draws need stronger assurance than a local log; local Web Crypto and hashes should not be described as independent certification.

Research checked September 22, 2026 against Wheel of Names' FAQ, Challonge's competition formats guide, the current FIDE Swiss basic/handling rules, and RANDOM.ORG's Third-Party Draw Service description/API documentation.

## Verification Record

- `npm run check`: passed September 23, 2026 in the staged writable copy; ESLint, 106 unit tests, production build, 39 Chromium journeys including parseable-invalid local data preservation/recovery, check-in isolation, explicit forfeit and undo/correction, dependent-result reopening, audience view, phone-width and axe coverage, and 2 mocked-cloud journeys.
- `npm audit --audit-level=low`: zero vulnerabilities.
- Not verified: live Supabase, real email delivery, deployed account-deletion function, two-account RLS isolation, production deployment/monitoring, manual screen-reader testing, or browser coverage beyond configured Chromium.
