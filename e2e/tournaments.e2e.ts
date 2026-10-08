import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("participant CSV preview offers append with first-column and duplicate rules", async ({ page }) => {
  await page.goto("/tournaments");
  await page.getByLabel("Tournament name").fill("CSV roster cup");
  const participantField = page.getByLabel(/Participants/);
  await participantField.fill("Avery\nJordan");
  await page.locator(".file-button input[type=file]").setInputFiles({
    name: "participants.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Name,Email\nJordan,jordan@example.test\nSam,sam@example.test\nsam,duplicate@example.test\n,missing@example.test\n"),
  });

  const preview = page.getByRole("region", { name: "Participant CSV preview" });
  await expect(preview.getByText("2 unique participants")).toBeVisible();
  await expect(preview.getByText("1 duplicate names found in this file.")).toBeVisible();
  await expect(preview.getByText("Names are read from the selected column. Duplicate names are ignored without regard to capitalization.")).toBeVisible();
  await preview.getByRole("button", { name: "Append participants" }).click();

  await expect(participantField).toHaveValue("Avery\nJordan\nSam");
  await page.getByRole("button", { name: "Preview tournament" }).click();
  await expect(page.getByRole("region", { name: "Tournament preview" })).toContainText("3 participants");
});

test("participant CSV preview can map a name column", async ({ page }) => {
  await page.goto("/tournaments");
  await page.getByLabel("Tournament name").fill("Mapped roster cup");
  await page.locator(".file-button input[type=file]").setInputFiles({
    name: "participants.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Email,Display name,Team\na@example.test,Avery Chen,Blue\nb@example.test,Jordan Lee,Gold\n"),
  });
  const preview = page.getByRole("region", { name: "Participant CSV preview" });
  await preview.getByLabel("Name column").selectOption({ label: "Display name" });
  await expect(preview).toContainText("Avery Chen");
  await expect(preview).toContainText("Jordan Lee");
  await preview.getByRole("button", { name: "Replace participant list" }).click();
  await expect(page.getByLabel(/Participants/)).toHaveValue("Avery Chen\nJordan Lee");
});

test("chance-based tournament draw reviews ticket odds, stays out of match results, and records undo", async ({ page }) => {
  await createTournament(page, "Prize night", ["Avery", "Jordan", "Sam", "Taylor"], "single-elimination");
  await page.getByRole("button", { name: "Set up chance-based draw" }).click();
  await page.getByLabel("Tickets for Avery").fill("3");
  await page.getByLabel("Tickets for Jordan").fill("1");
  await expect(page.locator(".tournament-draw-entrant").filter({ hasText: "Avery" })).toContainText("50%");
  await expect(page.locator(".tournament-draw-entrant").filter({ hasText: "Jordan" })).toContainText("16.67%");
  await page.getByLabel("Tournament draw winner count").fill("2");
  await page.getByRole("button", { name: "Draw 2 winners" }).click();

  const result = page.getByRole("region", { name: "Latest tournament chance draw" });
  await expect(result).toContainText("Recorded as a random draw, not a match result.");
  await expect(result.locator("li")).toHaveCount(2);
  await expect(page.locator(".tournament-match").filter({ hasText: "Pending" })).toHaveCount(3);
  await expect(page.getByText(/Chance-based draw, not a match result/)).toBeVisible();

  const stored = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const tournament = data.tournaments.find((item: { title: string }) => item.title === "Prize night");
    return {
      eventTypes: tournament.events.map((event: { type: string }) => event.type),
      ids: tournament.events[0].winnerDraw.winnerIds,
      entrants: tournament.events[0].winnerDraw.entrants,
      matchStatuses: tournament.rounds.flatMap((round: { matches: Array<{ status: string }> }) => round.matches.map((match) => match.status)),
    };
  });
  expect(stored.eventTypes).toEqual(["winner-drawn"]);
  expect(new Set(stored.ids).size).toBe(2);
  expect(stored.entrants.find((entrant: { participantName: string }) => entrant.participantName === "Avery")?.tickets).toBe(3);
  expect(stored.matchStatuses.every((status: string) => status === "pending")).toBe(true);

  await result.getByRole("button", { name: "Undo this draw" }).click();
  await expect(result).toContainText("Chance draw undone");
  await expect(page.getByText(/Undid chance draw #1; the original draw remains in history/)).toBeVisible();
  await expect(page.locator(".tournament-match").filter({ hasText: "Pending" })).toHaveCount(3);
});

test("CSV export previews privacy choices and includes optional activity without raw IDs", async ({ page }) => {
  await createTournament(page, "Export league", ["Avery", "Jordan"], "round-robin");
  await page.getByRole("button", { name: "Set up chance-based draw" }).click();
  await page.getByRole("button", { name: "Draw 1 winner" }).click();
  await page.getByLabel("Avery score, match 1").fill("3");
  await page.getByLabel("Jordan score, match 1").fill("1");
  await page.getByRole("button", { name: "Record score" }).click();
  await page.getByRole("button", { name: "CSV export" }).click();

  const review = page.getByRole("region", { name: "Tournament CSV export review" });
  await expect(review).toContainText("1 match and schedule rows");
  await expect(review).toContainText("2 standings rows");
  await expect(review).toContainText("Participant names: included");
  await expect(review).toContainText("Activity history: excluded");
  await page.getByLabel("Anonymize participant names").check();
  await page.getByLabel(/Include local activity history/).check();
  await expect(review).toContainText("Participant names: anonymized");
  await expect(review).toContainText("Activity history: included (3 rows)");

  const downloadPromise = page.waitForEvent("download");
  await review.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("export-league-results.csv");
  const filePath = await download.path();
  const csv = await readFile(filePath!, "utf8");
  expect(csv).toContain("winner-draw-entrant");
  expect(csv).toContain("random selection, not a match result");
  expect(csv).toContain("Participant 1");
  expect(csv).not.toContain("Avery");
  expect(csv).not.toContain("Jordan");
  expect(csv).not.toMatch(/participant_[a-f0-9-]{8,}/i);
});

test("print action opens a print-ready schedule without app navigation or controls", async ({ page }) => {
  await createTournament(page, "Print league", ["Avery", "Jordan", "Sam"], "round-robin");
  await page.evaluate(() => { window.print = () => undefined; });
  await page.getByRole("button", { name: "Print schedule" }).click();
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".page-header-actions")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await expect(page.locator(".tournament-round")).toHaveCount(3);
});

test("host queue records elimination results and audience mode stays read-only", async ({ page }) => {
  await createTournament(page, "Host queue cup", ["Avery", "Jordan", "Sam", "Taylor"], "single-elimination");
  await page.getByRole("link", { name: "Host mode" }).click();

  await expect(page.locator(".sidebar")).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Current match" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Match queue" })).toContainText("2 ready");
  await page.locator(".host-winner-actions .host-primary-action").first().click();
  await expect(page.getByRole("status")).toContainText("recorded as winner");
  await expect(page.getByRole("region", { name: "Match queue" })).toContainText("1 ready");
  await page.getByRole("button", { name: "Undo latest result" }).click();
  await expect(page.getByRole("region", { name: "Match queue" })).toContainText("2 ready");

  await page.getByRole("button", { name: "Audience" }).click();
  await expect(page.getByRole("main", { name: "Tournament audience display" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Current match" })).toContainText("Up next");
  await expect(page.getByRole("main", { name: "Tournament audience display" }).getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Host", exact: true })).toHaveCount(0);
});

test("host check-in is logged without changing matches and stays out of audience controls", async ({ page }) => {
  await createTournament(page, "Attendance cup", ["Avery", "Jordan", "Sam", "Taylor"], "single-elimination");
  const tournamentId = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    return data.tournaments.find((item: { title: string }) => item.title === "Attendance cup").id;
  });
  const matchesBefore = await page.evaluate((id) => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const tournament = data.tournaments.find((item: { id: string }) => item.id === id);
    return tournament.rounds.map((round: { matches: Array<Record<string, unknown>> }) => round.matches.map((match) => ({
      status: match.status,
      participantAId: match.participantAId,
      participantBId: match.participantBId,
      winnerId: match.winnerId,
    })));
  }, tournamentId);

  await page.getByRole("link", { name: "Host mode" }).click();
  const checkIn = page.getByRole("region", { name: "Participant check-in" });
  await expect(checkIn).toContainText("Attendance does not change pairings or results");
  await page.getByLabel("Avery attendance").selectOption("checked-in");
  await expect(page.getByRole("status")).toContainText("Avery: Checked in");
  await expect(checkIn).toContainText("1/4 checked in");

  const persisted = await page.evaluate((id) => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const tournament = data.tournaments.find((item: { id: string }) => item.id === id);
    return {
      attendance: tournament.participants.find((participant: { name: string }) => participant.name === "Avery").attendanceStatus,
      events: tournament.events.map((event: Record<string, unknown>) => ({
        type: event.type,
        participantId: event.participantId,
        previousAttendanceStatus: event.previousAttendanceStatus,
        attendanceStatus: event.attendanceStatus,
      })),
      matches: tournament.rounds.map((round: { matches: Array<Record<string, unknown>> }) => round.matches.map((match) => ({
        status: match.status,
        participantAId: match.participantAId,
        participantBId: match.participantBId,
        winnerId: match.winnerId,
      }))),
    };
  }, tournamentId);
  expect(persisted.attendance).toBe("checked-in");
  expect(persisted.events).toEqual([{
    type: "participant-attendance-changed",
    participantId: expect.any(String),
    previousAttendanceStatus: "expected",
    attendanceStatus: "checked-in",
  }]);
  expect(persisted.matches).toEqual(matchesBefore);

  await page.goto(`/tournaments/${tournamentId}`);
  await expect(page.getByText(/Avery: attendance changed from Expected to Checked in/)).toBeVisible();
  await page.goto(`/tournaments/${tournamentId}/host?view=audience`);
  await expect(page.getByRole("main", { name: "Tournament audience display" }).getByLabel(/attendance/i)).toHaveCount(0);
});

test("host explicitly records, advances, and undoes a single-match forfeit", async ({ page }) => {
  await createTournament(page, "Forfeit cup", ["Avery", "Jordan", "Sam", "Taylor"], "single-elimination");
  await page.getByRole("link", { name: "Host mode" }).click();

  let confirmation = "";
  page.once("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Avery forfeits" }).click();
  expect(confirmation).toContain("Record Avery as forfeiting this match?");
  expect(confirmation).toContain("does not remove the participant from the tournament record");
  await expect(page.getByRole("status")).toContainText("Avery forfeited");

  const recorded = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const tournament = data.tournaments.find((item: { title: string }) => item.title === "Forfeit cup");
    const match = tournament.rounds[0].matches[0];
    return {
      match,
      nextMatch: tournament.rounds[1].matches[0],
      event: tournament.events.at(-1),
    };
  });
  expect(recorded.match).toMatchObject({ status: "complete", resultMethod: "forfeit", forfeitingParticipantId: expect.any(String) });
  expect(recorded.match.scoreA).toBeUndefined();
  expect(recorded.nextMatch.participantAId).toBe(recorded.match.winnerId);
  expect(recorded.event).toMatchObject({ type: "result-recorded", resultMethod: "forfeit", forfeitingParticipantId: recorded.match.forfeitingParticipantId });
  await expect(page.locator(".host-recent-results")).toContainText("Forfeit: Avery");

  await page.getByRole("button", { name: "Undo latest result" }).click();
  await expect(page.getByRole("region", { name: "Match queue" })).toContainText("2 ready");
  const undone = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const tournament = data.tournaments.find((item: { title: string }) => item.title === "Forfeit cup");
    return { match: tournament.rounds[0].matches[0], event: tournament.events.at(-1) };
  });
  expect(undone.match).toMatchObject({ status: "pending" });
  expect(undone.match.resultMethod).toBeUndefined();
  expect(undone.event).toMatchObject({ type: "result-undone", previousResultMethod: "forfeit" });
});

test("round-robin forfeit awards configured points without entering a score or removing other fixtures", async ({ page }) => {
  await createTournament(page, "Forfeit league", ["Avery", "Jordan", "Sam", "Taylor"], "round-robin");
  await page.getByRole("link", { name: "Host mode" }).click();
  let confirmation = "";
  page.once("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Avery forfeits" }).click();
  expect(confirmation).toContain("configured win/loss points with no score");
  expect(confirmation).toContain("does not change the participant's other fixtures");
  await expect(page.getByRole("status")).toContainText("Avery forfeited");

  const result = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem("wheelforge_data_v1") ?? "null");
    const tournament = data.tournaments.find((item: { title: string }) => item.title === "Forfeit league");
    return {
      matches: tournament.rounds.flatMap((round: { matches: Array<Record<string, unknown>> }) => round.matches.map((match) => ({
        id: match.id,
        status: match.status,
        resultMethod: match.resultMethod,
        forfeitingParticipantId: match.forfeitingParticipantId,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
      }))),
    };
  });
  const forfeited = result.matches.find((match: Record<string, unknown>) => match.resultMethod === "forfeit");
  expect(forfeited).toMatchObject({ status: "complete", forfeitingParticipantId: expect.any(String) });
  expect(forfeited?.scoreA).toBeUndefined();
  expect(forfeited?.scoreB).toBeUndefined();
  expect(result.matches.filter((match: Record<string, unknown>) => match.id !== forfeited?.id)
    .every((match: Record<string, unknown>) => match.status === "pending" || match.status === "bye" && match.resultMethod === undefined)).toBe(true);
  await expect(page.locator(".host-mini-standings")).toContainText("3 pts");
  await expect(page.locator(".host-mini-standings")).toContainText("0 pts");

  await page.getByRole("button", { name: "Audience" }).click();
  await expect(page.getByRole("region", { name: "Recent results" })).toContainText("Forfeit: Avery");
});

test("host mode records round-robin scores and audience view updates from saved state", async ({ page }) => {
  await createTournament(page, "Host league", ["Avery", "Jordan"], "round-robin");
  await page.getByRole("link", { name: "Host mode" }).click();
  await expect(page.locator(".host-score-entry")).toBeVisible();
  await page.getByLabel("Avery score").fill("4");
  await expect(page.getByLabel("Avery score")).toHaveValue("4");
  await page.getByLabel("Jordan score").fill("2");
  await expect(page.getByLabel("Jordan score")).toHaveValue("2");
  await expect(page.getByLabel("Avery score")).toHaveValue("4");
  await page.getByRole("button", { name: "Record score" }).click();
  await expect(page.getByRole("status")).toContainText("Score recorded: Avery 4, Jordan 2");

  await page.getByRole("button", { name: "Audience" }).click();
  await expect(page.getByRole("region", { name: "Current match" })).toContainText("Tournament complete");
  await expect(page.getByRole("region", { name: "Current match" })).toContainText("Avery wins");
  await expect(page.getByRole("region", { name: "Current standings" })).toContainText("Avery");
  await expect(page.getByRole("region", { name: "Recent results" })).toContainText("4-2");
});

test("host and audience views fit a narrow phone viewport without horizontal overflow", async ({ page }) => {
  await createTournament(page, "Mobile host", ["Avery", "Jordan"], "single-elimination");
  await page.getByRole("link", { name: "Host mode" }).click();
  await page.setViewportSize({ width: 390, height: 844 });

  const hostWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(hostWidth.scroll).toBeLessThanOrEqual(hostWidth.viewport);
  await expect(page.getByRole("button", { name: "Avery wins" })).toBeVisible();
  await page.getByRole("button", { name: "Audience" }).click();
  const audienceWidth = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(audienceWidth.scroll).toBeLessThanOrEqual(audienceWidth.viewport);
  await expect(page.getByRole("main", { name: "Tournament audience display" })).toBeVisible();
});

test("host correction warns and reopens a dependent elimination final", async ({ page }) => {
  await createTournament(page, "Host correction cup", ["Avery", "Jordan", "Sam", "Taylor"], "single-elimination");
  await page.getByRole("link", { name: "Host mode" }).click();
  await expect(page.locator(".host-winner-actions")).toBeVisible();
  await page.locator(".host-winner-actions .host-primary-action").first().click();
  await page.locator(".host-winner-actions .host-primary-action").first().click();
  await page.locator(".host-winner-actions .host-primary-action").first().click();

  const result = page.locator(".host-recent-result").filter({ hasText: "Semifinals · Match 1" });
  const previousWinner = await result.locator(".host-recent-result-row strong").textContent();
  await result.getByRole("button", { name: "Correct result for Semifinals match 1" }).click();
  const correctionChoices = result.locator(".host-correction-winners button");
  const choiceNames = await correctionChoices.allTextContents();
  const alternative = choiceNames.find((choice) => !choice.includes(previousWinner ?? ""))!;
  page.on("dialog", async (dialog) => {
    expect(dialog.message()).toContain("clear 1 later match result");
    await dialog.accept();
  });
  await correctionChoices.filter({ hasText: alternative }).click();

  await expect(page.getByRole("status")).toContainText("is now recorded as the winner");
  await expect(page.getByRole("region", { name: "Match queue" })).toContainText("1 ready");
  await expect(page.locator(".host-recent-result").filter({ hasText: "Final · Match 1" })).toHaveCount(0);
});

test("round-robin scoring supports custom points, draws, corrections, standings, and undo", async ({ page }) => {
  await page.goto("/tournaments");
  await page.getByLabel("Tournament name").fill("Scored round robin");
  await page.getByLabel(/Participants/).fill("Avery\nJordan");
  await page.getByLabel("Format").selectOption("round-robin");
  await page.getByLabel("Win points").fill("5");
  await page.getByLabel("Draw points").fill("2");
  await page.getByLabel("Loss points").fill("1");
  await page.getByRole("button", { name: "Preview tournament" }).click();
  await expect(page.getByRole("region", { name: "Tournament preview" })).toContainText("5/2/1 win/draw/loss points");
  await page.getByRole("button", { name: "Create this tournament" }).click();

  await page.getByRole("spinbutton", { name: "Avery score, match 1" }).fill("2");
  await page.getByRole("spinbutton", { name: "Jordan score, match 1" }).fill("2");
  await page.getByRole("button", { name: "Record score" }).click();
  await expect(page.getByText("2-2 · Draw")).toBeVisible();
  const standings = page.getByRole("table", { name: "Round-robin standings" });
  await expect(standings.getByRole("row").nth(1)).toContainText("0-1-0");
  await expect(standings.getByRole("row").nth(1)).toContainText("2");

  await page.getByRole("button", { name: "Correct score" }).click();
  await page.getByRole("spinbutton", { name: "Correct Avery score, match 1" }).fill("3");
  await page.getByRole("spinbutton", { name: "Correct Jordan score, match 1" }).fill("1");
  await page.getByRole("button", { name: "Save corrected score" }).click();
  await expect(page.getByText("3-1 · Avery won")).toBeVisible();
  await expect(standings.getByRole("row").nth(1)).toContainText("1-0-0");
  await expect(standings.getByRole("row").nth(1)).toContainText("5");
  await expect(page.getByText(/corrected 2-2 to 3-1 \(Avery won\)/)).toBeVisible();

  await page.getByRole("button", { name: "Undo latest result" }).click();
  await expect(page.locator(".tournament-match")).toContainText("Pending");
  await expect(page.getByRole("spinbutton", { name: "Avery score, match 1" })).toHaveValue("");
});

async function createTournament(
  page: Page,
  title: string,
  participants: string[],
  format: "single-elimination" | "round-robin",
) {
  await page.goto("/tournaments");
  await page.getByLabel("Tournament name").fill(title);
  await page.getByLabel(/Participants/).fill(participants.join("\n"));
  await page.getByLabel("Format").selectOption(format);
  await page.getByRole("button", { name: "Preview tournament" }).click();
  await expect(page.getByRole("region", { name: "Tournament preview" })).toBeVisible();
  await page.getByRole("button", { name: "Create this tournament" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page).toHaveURL(/\/tournaments\/tournament_/);
}

test("tournament preview shows round-robin byes and creates the exact reviewed random schedule", async ({ page }) => {
  await page.goto("/tournaments");
  await page.getByLabel("Tournament name").fill("Preview League");
  await page.getByLabel(/Participants/).fill("Avery\nJordan\nSam");
  await page.getByLabel("Format").selectOption("round-robin");
  await page.getByLabel("Standings tiebreaker").selectOption("head-to-head");
  await page.getByLabel("Seeding").selectOption("random");
  await page.getByRole("button", { name: "Preview tournament" }).click();

  const preview = page.getByRole("region", { name: "Tournament preview" });
  await expect(preview).toContainText("This shuffled seed order is fixed for this preview");
  await expect(preview.locator(".tournament-preview-round")).toHaveCount(3);
  await expect(preview.getByText(/Bye · .* does not play this round/)).toHaveCount(3);
  const previewMatchIds = await preview.locator(".tournament-preview-round").evaluateAll((rounds) =>
    rounds.map((round) => Array.from(round.querySelectorAll(".tournament-preview-match"), (match) => match.getAttribute("data-match-id"))));

  await page.getByLabel("Tournament name").fill("Updated Preview League");
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "Preview tournament" }).click();
  const refreshedPreview = page.getByRole("region", { name: "Tournament preview" });
  const reviewedMatchIds = await refreshedPreview.locator(".tournament-preview-round").evaluateAll((rounds) =>
    rounds.map((round) => Array.from(round.querySelectorAll(".tournament-preview-match"), (match) => match.getAttribute("data-match-id"))));
  await page.getByRole("button", { name: "Create this tournament" }).click();

  await expect(page.getByRole("heading", { name: "Updated Preview League" })).toBeVisible();
  await expect(page.locator(".tournament-standings")).toHaveCount(1);
  await expect(page.locator(".tournament-standing-row").first()).toContainText("H2H");
  await expect(page.locator(".tournament-round")).toHaveCount(3);
  const createdMatchIds = await page.locator(".tournament-round").evaluateAll((rounds) =>
    rounds.map((round) => Array.from(round.querySelectorAll(".tournament-match"), (match) => match.getAttribute("data-match-id"))));
  expect(createdMatchIds).toEqual(reviewedMatchIds);
  expect(reviewedMatchIds).not.toEqual(previewMatchIds);
  await expect(page.getByText("0 of 3 matches recorded")).toBeVisible();
});

test("participant withdrawal follows the reviewed policy and records the decision", async ({ page }) => {
  await createTournament(page, "Withdrawal Night", ["Alice", "Blair", "Casey", "Dana"], "single-elimination");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Withdraw" }).first().click();
  await expect(page.getByText(/Alice withdrew from the tournament/)).toBeVisible();
  await expect(page.locator(".tournament-bye")).toHaveCount(1);
  await expect(page.locator(".tournament-bye")).not.toContainText("Alice");
  await expect(page.getByRole("heading", { name: "Participant management" })).toBeVisible();
});

test("round-robin setup can be edited and the schedule is regenerated", async ({ page }) => {
  await createTournament(page, "League Night", ["Avery", "Jordan", "Sam"], "round-robin");
  await expect(page.getByText("0 of 3 matches recorded")).toBeVisible();
  await expect(page.getByText("Bye · no match played")).toHaveCount(3);

  await page.getByRole("button", { name: "Edit setup" }).click();
  await page.getByLabel("Tournament name").last().fill("Thursday League");
  await page.getByLabel(/Participants/).last().fill("Avery\nJordan\nSam\nTaylor");
  await page.getByLabel("Seeding").selectOption("random");
  await page.getByLabel("Format").last().selectOption("single-elimination");
  await page.getByRole("button", { name: "Save setup" }).click();

  await expect(page.getByRole("heading", { name: "Thursday League" })).toBeVisible();
  await expect(page.getByText("0 of 3 matches recorded")).toBeVisible();
  await expect(page.locator(".tournament-match")).toHaveCount(3);

  await page.getByRole("button", { name: "Edit setup" }).click();
  await page.getByLabel("Format").last().selectOption("round-robin");
  await page.getByLabel("Standings tiebreaker").selectOption("head-to-head");
  await page.getByRole("button", { name: "Save setup" }).click();

  await expect(page.getByText("0 of 6 matches recorded")).toBeVisible();
  await expect(page.getByText(/Head-to-head mini-table points break overall-point ties/)).toBeVisible();
  await expect(page.locator(".tournament-standing-row").first()).toContainText("H2H");
  await expect(page.locator(".tournament-match")).toHaveCount(6);
  await expect(page.getByText("Activity history")).toBeVisible();
});

test("a stale tournament setup draft is preserved and requires an explicit reload", async ({ page, context }) => {
  test.setTimeout(60_000);
  await createTournament(page, "Cross-tab Tournament", ["Avery", "Jordan", "Sam"], "round-robin");
  const detailUrl = page.url();
  await page.getByRole("button", { name: "Edit setup" }).click();
  const draftTitle = page.getByLabel("Tournament name").last();
  await draftTitle.fill("Uncommitted tournament edit");

  const writer = await context.newPage();
  await writer.goto(detailUrl);
  await expect(writer.getByRole("heading", { name: "Cross-tab Tournament" })).toBeVisible({ timeout: 15_000 });
  const writerEditButton = writer.getByRole("button", { name: "Edit setup" });
  if (await writerEditButton.isVisible()) await writerEditButton.click();
  else await expect(writer.getByRole("button", { name: "Save setup" })).toBeVisible();
  await writer.getByLabel("Tournament name").last().fill("Latest tournament version");
  await writer.getByRole("button", { name: "Save setup" }).click();

  await expect(page.getByRole("alert")).toContainText("This tournament changed in another tab");
  await expect(draftTitle).toHaveValue("Uncommitted tournament edit");
  await expect(page.getByRole("button", { name: "Save setup" })).toBeDisabled();
  await page.getByRole("button", { name: "Reload latest setup" }).click();
  await expect(draftTitle).toHaveValue("Latest tournament version");
});

test("a weighted custom wheel spins, reveals the result, and stays landed after dismissing it", async ({ page }) => {
  await page.goto("/wheels/new");
  await page.getByLabel("Title").fill("Weighted smoke wheel");
  await page.getByLabel("Weight for Option A").fill("7");
  await page.getByLabel("Weight for Option B").fill("2");
  await page.getByLabel("Weight for Option C").fill("1");
  await page.getByLabel("Spin duration").fill("1800");
  await page.getByRole("button", { name: "Save and spin" }).first().click();

  await expect(page.getByText("70%", { exact: true })).toBeVisible();
  await expect(page.getByText("20%", { exact: true })).toBeVisible();
  await expect(page.getByText("10%", { exact: true })).toBeVisible();
  const canvas = page.locator("canvas.wheel-canvas");
  await expect(canvas).toHaveAttribute("aria-label", /active options\. See the options and chances list below\./);
  await expect(page.getByRole("list", { name: "Options and chances" }).getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "Spin the wheel" }).click();

  const resultDialog = page.getByRole("dialog");
  await expect(resultDialog).toBeVisible({ timeout: 20_000 });
  const result = (await resultDialog.getByRole("heading").textContent())?.trim();
  expect(["Option A", "Option B", "Option C"]).toContain(result);
  await expect(page.getByRole("status")).toContainText(new RegExp(`Spin complete\\. ${result}, \\d+(?:\\.\\d+)?% chance\\.`));
  const landedPixel = await canvas.evaluate((element) => {
    const context = element.getContext("2d");
    if (!context) throw new Error("Wheel canvas context is unavailable.");
    const scale = element.width / 760;
    const angle = Number(document.querySelector(".wheel-pointer")?.getAttribute("data-pointer-angle") ?? -90) * Math.PI / 180;
    const radius = 210;
    const x = (380 + Math.cos(angle) * radius) * scale;
    const y = (380 + Math.sin(angle) * radius) * scale;
    return Array.from(context.getImageData(Math.round(x), Math.round(y), 1, 1).data).slice(0, 3);
  });
  expect(landedPixel).not.toEqual([15, 23, 42]);
  const landedFrame = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());

  await page.keyboard.press("Escape");
  await expect(resultDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Spin the wheel" })).toBeFocused();
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(landedFrame);
  await expect(page.locator(".history-row")).toHaveCount(1);
});

test("correcting an elimination result reopens the affected final and records the change", async ({ page }) => {
  await createTournament(page, "Bracket Test", ["Alice", "Blair", "Casey", "Dana"], "single-elimination");

  await page.getByRole("button", { name: "Record Alice as winner of round 1 match 1" }).click();
  await expect(page.getByRole("button", { name: "Edit setup" })).toHaveCount(0);
  await page.getByRole("button", { name: "Record Casey as winner of round 1 match 2" }).click();
  await page.getByRole("button", { name: "Record Alice as winner of round 2 match 1" }).click();
  await expect(page.locator(".tournament-round[aria-label='Final']")).toContainText("Complete");

  page.on("dialog", (dialog) => dialog.accept());
  const semifinals = page.locator(".tournament-round[aria-label='Semifinals']");
  await semifinals.getByRole("button", { name: "Correct result for match 1" }).click();
  await semifinals.getByRole("button", { name: "Correct result: make Dana the winner of match 1" }).click();

  const final = page.locator(".tournament-round[aria-label='Final']");
  await expect(final).toContainText("Pending");
  await expect(final).toContainText("Dana");
  await expect(final).toContainText("Casey");
  await expect(page.getByText(/corrected Alice to Dana/i)).toBeVisible();
  await expect(page.getByText(/Reopened: Round 2, match 1 \(previous winner: Alice\)/i)).toBeVisible();
});

test("a tournament condition wheel records a map separately from the match winner", async ({ page }) => {
  await createTournament(page, "Map Night", ["Alpha", "Bravo"], "single-elimination");
  const match = page.locator(".tournament-match").first();
  await match.getByRole("button", { name: "Spin for condition" }).click();
  const spinner = match.getByRole("region", { name: "Match condition wheel" });
  await spinner.getByLabel(/^Condition wheel/).selectOption({ label: "Giveaway Prize Wheel" });
  await spinner.getByRole("button", { name: "Spin the wheel" }).click();
  await expect(spinner.getByRole("status")).toContainText("Winner must be recorded separately.", { timeout: 10000 });

  const condition = match.locator(".tournament-condition-result");
  await expect(condition).toContainText("Condition:");
  const conditionText = (await condition.textContent())?.trim() ?? "";
  await expect(match.getByRole("button", { name: "Record Alpha as winner of round 1 match 1" })).toBeVisible();
  await match.getByRole("button", { name: "Record Alpha as winner of round 1 match 1" }).click();

  await expect(match).toContainText("Alpha");
  await expect(match).toContainText(conditionText);
  await expect(page.getByText(/drew .* from Giveaway Prize Wheel as the match condition/i)).toBeVisible();
  await expect(page.getByText(/recorded Alpha as the winner/i)).toBeVisible();
  await page.reload();
  await expect(page.locator(".tournament-match").first()).toContainText(conditionText);
  await expect(page.getByText(/recorded Alpha as the winner/i)).toBeVisible();
});
