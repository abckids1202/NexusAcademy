import { describe, expect, it } from "vitest";
import { createRoundRobinTournament, recordTournamentScore, recordTournamentForfeit, drawTournamentWinners, undoTournamentWinnerDraw } from "./tournamentLogic";
import { buildTournamentCsv, getTournamentCsvPreview } from "./tournamentExport";

function league() {
  return createRoundRobinTournament("Office league", [
    { id: "a", name: "Avery" },
    { id: "b", name: "Jordan" },
    { id: "c", name: "Sam" },
  ], { id: "league", createdAt: "2026-01-01T00:00:00.000Z" });
}

describe("tournament CSV export", () => {
  it("exports matches and standings while honoring name anonymization", () => {
    const tournament = league();
    const options = { anonymizeParticipantNames: true, includeActivityHistory: false };
    const csv = buildTournamentCsv(tournament, options);
    const preview = getTournamentCsvPreview(tournament, options);

    expect(csv).toContain("\"record_type\"");
    expect(csv).toContain("\"match\"");
    expect(csv).toContain("\"standing\"");
    expect(csv).toContain("\"Participant 1\"");
    expect(csv).not.toContain("Avery");
    expect(preview).toMatchObject({ matchRows: 6, standingsRows: 3, activityRows: 0, participantNames: "anonymized", activityHistory: "excluded" });
  });

  it("includes draw entrant weights, odds, conditional pick odds, and undo history only when selected", () => {
    let tournament = league();
    tournament = drawTournamentWinners(tournament, [
      { participantId: "a", tickets: 3 },
      { participantId: "b", tickets: 1 },
      { participantId: "c", tickets: 1 },
    ], 2, "2026-01-01T01:00:00.000Z", (maximum) => maximum - 1);
    tournament = undoTournamentWinnerDraw(tournament, "2026-01-01T02:00:00.000Z");
    const options = { anonymizeParticipantNames: true, includeActivityHistory: true };
    const csv = buildTournamentCsv(tournament, options);

    expect(csv).toContain("winner-draw-entrant");
    expect(csv).toContain("Chance draw event 1; random selection, not a match result");
    expect(csv).toContain("Chance draw undone (draw event 1)");
    expect(csv).toContain("0.6");
    expect(csv).not.toContain("Avery");
    expect(getTournamentCsvPreview(tournament, options).activityRows).toBe(4);
  });

  it("quotes cells and neutralizes spreadsheet formula prefixes", () => {
    const tournament = createRoundRobinTournament("=HYPERLINK(\"x\")", [
      { id: "a", name: "=CMD()" },
      { id: "b", name: "Sam, \"Ace\"" },
    ], { id: "formula", createdAt: "2026-01-01T00:00:00.000Z" });
    const csv = buildTournamentCsv(tournament, { anonymizeParticipantNames: false, includeActivityHistory: false });

    expect(csv).toContain("'=HYPERLINK(");
    expect(csv).toContain("'=CMD()");
    expect(csv).toContain("Sam, \"\"Ace\"\"");
  });

  it("exports recorded scores and match activity without embedding participant IDs", () => {
    let tournament = league();
    const match = tournament.rounds.flatMap((round) => round.matches).find((item) => item.status === "pending" && item.participantAId && item.participantBId);
    expect(match).toBeDefined();
    tournament = recordTournamentScore(tournament, match!.id, 3, 1, "2026-01-01T01:00:00.000Z");
    const csv = buildTournamentCsv(tournament, { anonymizeParticipantNames: false, includeActivityHistory: true });

    expect(csv).toContain("\"3\",\"1\"");
    expect(csv).toContain("Avery");
    expect(csv).toContain("Match result recorded; winner: Jordan");
    expect(csv).not.toContain("\"a\"");
  });

  it("exports forfeit method and forfeiting participant, including anonymized activity history", () => {
    const initial = league();
    const match = initial.rounds.flatMap((round) => round.matches).find((item) => item.status === "pending" && item.participantAId && item.participantBId)!;
    const tournament = recordTournamentForfeit(initial, match.id, match.participantAId!, "2026-01-01T01:00:00.000Z");
    const csv = buildTournamentCsv(tournament, { anonymizeParticipantNames: true, includeActivityHistory: true });

    expect(csv).toContain("\"result_method\"");
    expect(csv).toContain("\"forfeit\"");
    expect(csv).toContain("Forfeit recorded: Participant ");
    expect(csv).toContain("forfeited; Participant ");
    expect(csv).not.toContain("Avery");
    expect(csv).not.toContain("Jordan");
  });
});
