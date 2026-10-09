# WheelForge Manual Release QA

Use this matrix against the exact staging release candidate. Record the browser, device, date, tester, and a link to any screenshot, video, or exported artifact. A passing automated suite does not replace these checks.

## Test Record

- Release commit: `________________`
- Staging URL: `________________`
- Tester: `________________`
- Test date: `________________`
- Browser/device: `________________`
- Result: `PASS / FAIL / BLOCKED`
- Evidence link: `________________`

## Browser Matrix

Run the smoke flow on each supported target:

| Target | Required checks | Result |
| --- | --- | --- |
| Chrome desktop | load `/`, deep-link `/spin`, create wheel, spin, export | `____` |
| Edge desktop | load `/`, navigate, create wheel, result actions | `____` |
| Firefox desktop | load `/`, templates, tournament preview, settings | `____` |
| Safari desktop or WebKit | load `/`, spin, reduced motion, print preview | `____` |
| Chrome Android or mobile Chromium | responsive navigation, wheel controls, tournament host queue | `____` |
| Safari iOS or mobile WebKit | responsive navigation, dialogs, result actions, print/share behavior | `____` |

## Keyboard and Assistive Technology

1. From `/`, press `Tab` and confirm the skip link receives focus.
2. Activate the skip link and confirm focus moves to the main content.
3. Create and edit a wheel without using a pointer.
4. Open the result dialog, confirm focus is trapped, close with `Escape`, and confirm focus returns to the spin control.
5. Navigate templates, chains, participants, tournaments, and settings using only keyboard controls.
6. Confirm every icon-only control has an accessible name and every form error is announced.
7. With a screen reader, verify page title, landmark, heading order, dialog label, live result announcement, progress status, and canvas fallback content.
8. Enable reduced motion and confirm the result remains understandable without relying on animation.

## Core Product Journeys

### Wheel

- Create a weighted wheel with duplicate labels and confirm the displayed odds are understandable.
- Import malformed CSV input and confirm the invalid rows are identified without losing valid rows.
- Spin, close the result, copy the result, keep it, discard it, and spin again.
- Test elimination, no-repeat, accumulation, and random-order modes.
- Start an automatic spin queue, cancel it, and confirm no extra result is added after cancellation.
- Confirm the settled pointer remains at the selected segment and does not snap back to the center.

### Generator

- Run a built-in generator from start to finish.
- Exercise a conditional branch and a fallback wheel.
- Close the browser during an in-progress session, reopen it, and confirm resume behavior.
- Copy and export the final generated output.

### Templates and packs

- Create a custom wheel and generator template.
- Export and import an individual template.
- Create a pack, install selected components, and confirm IDs are remapped.
- Update a pack, review the diff, and confirm installed customizations are not overwritten.
- Restore an earlier pack version.

### Participants and tournaments

- Import a roster with mapped CSV columns, duplicate rows, and malformed rows.
- Assign teams, roles, groups, seats, attendance, and withdrawal status.
- Preview a single-elimination tournament with manual and automatic seeding.
- Exercise byes, forfeits, best-of-3, third-place match, correction, and undo.
- Exercise round robin scoring and tiebreaks.
- Exercise double elimination through the reset final.
- Confirm host and audience views expose only the intended controls and participant data.
- Export and print a tournament with anonymization enabled.

## Data and Recovery

- Export a representative workspace and import it into a clean browser profile.
- Confirm wheels, chains, results, participants, templates, packs, and tournaments retain their relationships.
- Import the same backup twice and confirm duplicate IDs are handled as documented.
- Load intentionally corrupt local data and confirm recovery preserves the raw payload.
- Clear saved history and confirm in-progress chain sessions remain.
- Fill storage or simulate a quota error and confirm the warning provides export/recovery guidance.
- Open two tabs, edit the same entity, and confirm the stale edit is rejected instead of silently overwriting newer data.

## Cloud Staging

Run only against disposable staging accounts:

- Sign up and complete email confirmation.
- Sign in and sign out.
- Request password recovery and set a new password from the redirect.
- Upload a local workspace, restore it, and compare entity counts.
- Confirm account A cannot read, update, or delete account B's backup.
- Trigger a stale cloud write and confirm the conflict is visible.
- Delete the cloud backup, then delete the account and confirm local data remains local.

## Release Evidence

For every failure, record the exact route, browser/device, reproduction steps, expected behavior, actual behavior, severity, and whether the issue blocks release. Do not mark a section complete from a single automated pass if its manual cases were not exercised.

