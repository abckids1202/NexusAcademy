import { describe, expect, it } from "vitest";
import type { TournamentParticipant } from "../types";
import {
  createSingleEliminationTournament,
  getSeedOrder,
  getTournamentProgress,
  getTournamentRoundLabel,
  getTournamentStandings,
  hasUndoableTournamentResult,
  createRoundRobinTournament,
  correctTournamentWinner,
  getDependentCompletedMatchCount,
  recordTournamentWinner,
  recordTournamentScore,
  correctTournamentScore,
  recordTournamentCondition,
  drawTournamentWinners,
  shuffleParticipants,
  canEditTournamentSetup,
  updateTournamentSetup,
  undoLastTournamentResult,
  undoTournamentWinnerDraw,
  setTournamentParticipantAttendance,
  recordTournamentForfeit,
} from "./tournamentLogic";

function entrants(count: number): Array<Pick<TournamentParticipant, "id" | "name">> {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}` }));
}

function bracket(count: number) {
  let id = 0;
  return createSingleEliminationTournament("Test Cup", entrants(count), {
    id: "tournament-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    idFactory: (prefix) => `${prefix}-${++id}`,
  });
}

describe("tournament participant attendance", () => {
  it("records changes without changing pairings, scores, or results", () => {
    const initial = bracket(4);
    const changed = setTournamentParticipantAttendance(initial, "p1", "checked-in", "2026-01-01T01:00:00.000Z");

    expect(changed.participants[0]).toMatchObject({ id: "p1", attendanceStatus: "checked-in" });
    expect(changed.events).toHaveLength(1);
    expect(changed.events[0]).toMatchObject({
      type: "participant-attendance-changed",
      participantId: "p1",
      previousAttendanceStatus: "expected",
      attendanceStatus: "checked-in",
      sequence: 1,
    });
    expect(changed.rounds).toEqual(initial.rounds);
    expect(changed.nextResultSequence).toBe(initial.nextResultSequence);
    expect(initial.participants[0].attendanceStatus).toBe("expected");
    expect(canEditTournamentSetup(changed)).toBe(false);
  });

  it("does not create duplicate events for unchanged status and rejects invalid updates", () => {
    const initial = bracket(4);
    expect(setTournamentParticipantAttendance(initial, "p1", "expected")).toBe(initial);
    expect(() => setTournamentParticipantAttendance(initial, "unknown", "checked-in")).toThrow("Participant not found");
    expect(() => setTournamentParticipantAttendance(initial, "p1", "checked-in", "not-a-date")).toThrow("timestamp");
    expect(() => setTournamentParticipantAttendance(initial, "p1", "late" as "expected")).toThrow("valid attendance");
  });

  it("logs a status correction as a new event", () => {
    const checkedIn = setTournamentParticipantAttendance(bracket(4), "p2", "not-present", "2026-01-01T01:00:00.000Z");
    const corrected = setTournamentParticipantAttendance(checkedIn, "p2", "checked-in", "2026-01-01T02:00:00.000Z");
    expect(corrected.events.map((event) => [event.previousAttendanceStatus, event.attendanceStatus])).toEqual([
      ["expected", "not-present"],
      ["not-present", "checked-in"],
    ]);
    expect(corrected.nextEventSequence).toBe(3);
  });
});

describe("match forfeits", () => {
  it("advances the opponent in elimination and undo reopens the match and bracket slot", () => {
    const initial = bracket(4);
    const firstMatch = initial.rounds[0].matches[0];
    const forfeitingId = firstMatch.participantAId!;
    const winnerId = firstMatch.participantBId!;
    const forfeited = recordTournamentForfeit(initial, firstMatch.id, forfeitingId, "2026-01-01T01:00:00.000Z");

    expect(forfeited.rounds[0].matches[0]).toMatchObject({
      status: "complete",
      winnerId,
      resultMethod: "forfeit",
      forfeitingParticipantId: forfeitingId,
    });
    expect(forfeited.rounds[0].matches[0].scoreA).toBeUndefined();
    expect(forfeited.rounds[1].matches[0].participantAId).toBe(winnerId);
    expect(forfeited.events.at(-1)).toMatchObject({ type: "result-recorded", resultMethod: "forfeit", forfeitingParticipantId: forfeitingId });

    const corrected = correctTournamentWinner(forfeited, firstMatch.id, forfeitingId, "2026-01-01T01:30:00.000Z");
    expect(corrected.rounds[0].matches[0]).toMatchObject({ winnerId: forfeitingId, resultMethod: "forfeit", forfeitingParticipantId: winnerId });
    expect(corrected.rounds[1].matches[0].participantAId).toBe(forfeitingId);
    expect(corrected.events.at(-1)).toMatchObject({
      type: "result-corrected",
      previousResultMethod: "forfeit",
      previousForfeitingParticipantId: forfeitingId,
      resultMethod: "forfeit",
      forfeitingParticipantId: winnerId,
    });

    const undone = undoLastTournamentResult(forfeited, "2026-01-01T02:00:00.000Z");
    expect(undone.rounds[0].matches[0].status).toBe("pending");
    expect(undone.rounds[1].matches[0].participantAId).toBeUndefined();
    expect(undone.events.at(-1)).toMatchObject({ type: "result-undone", previousResultMethod: "forfeit", previousForfeitingParticipantId: forfeitingId });
  });

  it("awards configured round-robin win/loss points without fabricating a score or changing other fixtures", () => {
    const initial = createRoundRobinTournament("Forfeit league", entrants(3), { createdAt: "2026-01-01T00:00:00.000Z" });
    const firstMatch = initial.rounds[0].matches.find((match) => match.status === "pending")!;
    const otherRounds = initial.rounds.slice(1);
    const forfeitingId = firstMatch.participantAId!;
    const winnerId = firstMatch.participantBId!;
    const forfeited = recordTournamentForfeit(initial, firstMatch.id, forfeitingId, "2026-01-01T01:00:00.000Z");
    const standings = getTournamentStandings(forfeited);

    expect(forfeited.rounds.slice(1)).toEqual(otherRounds);
    expect(forfeited.rounds[0].matches.find((match) => match.id === firstMatch.id)).toMatchObject({ status: "complete", winnerId, resultMethod: "forfeit" });
    expect(forfeited.rounds[0].matches.find((match) => match.id === firstMatch.id)?.scoreA).toBeUndefined();
    expect(standings.find((standing) => standing.participant.id === winnerId)).toMatchObject({ played: 1, wins: 1, points: 3 });
    expect(standings.find((standing) => standing.participant.id === forfeitingId)).toMatchObject({ played: 1, losses: 1, points: 0 });

    const scoreCorrected = correctTournamentScore(forfeited, firstMatch.id, 2, 1, "2026-01-01T02:00:00.000Z");
    expect(scoreCorrected.rounds[0].matches.find((match) => match.id === firstMatch.id)).toMatchObject({ resultMethod: "played", scoreA: 2, scoreB: 1 });
    expect(scoreCorrected.rounds[0].matches.find((match) => match.id === firstMatch.id)?.forfeitingParticipantId).toBeUndefined();
    expect(scoreCorrected.events.at(-1)).toMatchObject({ type: "result-corrected", previousResultMethod: "forfeit", previousForfeitingParticipantId: forfeitingId, resultMethod: "played" });
  });

  it("rejects a nonparticipant and a match that already has a result", () => {
    const initial = bracket(4);
    const match = initial.rounds[0].matches[0];
    expect(() => recordTournamentForfeit(initial, match.id, "not-a-player")).toThrow("must be in this match");
    const result = recordTournamentForfeit(initial, match.id, match.participantAId!);
    expect(() => recordTournamentForfeit(result, match.id, match.participantAId!)).toThrow("not ready for a forfeit");
  });
});

describe("tournament chance winner draws", () => {
  it("records a weighted no-replacement draw without changing match progression", () => {
    const initial = bracket(3);
    const drawn = drawTournamentWinners(initial, [
      { participantId: "p1", tickets: 1 },
      { participantId: "p2", tickets: 3 },
      { participantId: "p3", tickets: 1 },
    ], 2, "2026-01-01T01:00:00.000Z", (maximum) => maximum - 1);

    expect(drawn.events.at(-1)).toMatchObject({
      type: "winner-drawn",
      winnerDraw: {
        entrants: [
          { participantId: "p1", tickets: 1, chance: 0.2 },
          { participantId: "p2", tickets: 3, chance: 0.6 },
          { participantId: "p3", tickets: 1, chance: 0.2 },
        ],
        winnerIds: ["p3", "p2"],
        winnerChances: [0.2, 0.75],
        withoutReplacement: true,
      },
    });
    expect(drawn.rounds).toEqual(initial.rounds);
    expect(drawn.nextResultSequence).toBe(initial.nextResultSequence);
    expect(new Set(drawn.events.at(-1)?.winnerDraw?.winnerIds).size).toBe(2);
  });

  it("validates the entrant pool and leaves an undo record instead of deleting the draw", () => {
    const initial = bracket(3);
    expect(() => drawTournamentWinners(initial, [{ participantId: "p1", tickets: 1 }], 1)).toThrow("at least two");
    expect(() => drawTournamentWinners(initial, [
      { participantId: "p1", tickets: 1 }, { participantId: "p1", tickets: 2 },
    ], 1)).toThrow("once");
    expect(() => drawTournamentWinners(initial, [
      { participantId: "p1", tickets: 0 }, { participantId: "p2", tickets: 1 },
    ], 1)).toThrow("1 and 10,000");

    const drawn = drawTournamentWinners(initial, [
      { participantId: "p1", tickets: 1 }, { participantId: "p2", tickets: 1 },
    ], 1, "2026-01-01T01:00:00.000Z", () => 0);
    const undone = undoTournamentWinnerDraw(drawn, "2026-01-01T02:00:00.000Z");
    expect(undone.events.map((event) => event.type)).toEqual(["winner-drawn", "winner-draw-undone"]);
    expect(undone.events.at(-1)?.relatedEventId).toBe(drawn.events[0].id);
    expect(undone.rounds).toEqual(initial.rounds);
    expect(() => undoTournamentWinnerDraw(undone)).toThrow("latest tournament action");
  });
});

describe("single-elimination bracket generation", () => {
  it("produces standard seed placement for an eight-slot bracket", () => {
    expect(getSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("gives byes to the highest seeds and advances them into the correct next-round slots", () => {
    const tournament = bracket(6);
    const opening = tournament.rounds[0].matches;

    expect(opening[0]).toMatchObject({ status: "bye", participantAId: "p1", winnerId: "p1" });
    expect(opening[1]).toMatchObject({ status: "pending", participantAId: "p4", participantBId: "p5" });
    expect(opening[2]).toMatchObject({ status: "bye", participantAId: "p2", winnerId: "p2" });
    expect(opening[3]).toMatchObject({ status: "pending", participantAId: "p3", participantBId: "p6" });
    expect(tournament.rounds[1].matches[0].participantAId).toBe("p1");
    expect(tournament.rounds[1].matches[1].participantAId).toBe("p2");
  });

  it("shuffles before assigning seeds when random seeding is selected", () => {
    const tournament = createSingleEliminationTournament("Random Cup", entrants(4), {
      seeding: "random",
      random: () => 0,
      idFactory: (prefix) => `${prefix}-id`,
    });

    expect(tournament.participants.map((participant) => participant.id)).toEqual(["p2", "p3", "p4", "p1"]);
    expect(tournament.participants.map((participant) => participant.seed)).toEqual([1, 2, 3, 4]);
  });

  it("rejects invalid entrant counts and duplicate participant IDs", () => {
    expect(() => createSingleEliminationTournament("Small", entrants(1))).toThrow("at least two");
    expect(() => createSingleEliminationTournament("Duplicate", [
      { id: "same", name: "A" },
      { id: "same", name: "B" },
    ])).toThrow("unique");
  });

  it("rebuilds the bracket from an editable roster and preserves IDs for unchanged names", () => {
    const initial = bracket(4);
    let id = 0;
    const updated = updateTournamentSetup(initial, "  New Cup  ", ["Player 3", "Nova", "PLAYER 1"], "entry-order", "single-elimination", {
      idFactory: (prefix) => `${prefix}-updated-${++id}`,
    });

    expect(canEditTournamentSetup(initial)).toBe(true);
    expect(updated.id).toBe(initial.id);
    expect(updated.title).toBe("New Cup");
    expect(updated.format).toBe("single-elimination");
    expect(updated.participants.map((participant) => participant.name)).toEqual(["Player 3", "Nova", "PLAYER 1"]);
    expect(updated.participants[0].id).toBe("p3");
    expect(updated.participants[2].id).toBe("p1");
    expect(updated.participants.map((participant) => participant.seed)).toEqual([1, 2, 3]);
    expect(updated.rounds[0].matches).toHaveLength(2);
    expect(updated.events).toEqual([]);
  });

  it("preserves roster metadata when pairings are regenerated", () => {
    const initial = bracket(2);
    initial.participants[0] = { ...initial.participants[0], group: "Blue", role: "Captain", seat: 4 };
    const updated = updateTournamentSetup(initial, "Metadata Cup", [initial.participants[0].name, initial.participants[1].name], "entry-order");
    expect(updated.participants[0]).toMatchObject({ group: "Blue", role: "Captain", seat: 4 });
  });

  it("rejects roster edits after a result or any result history exists", () => {
    const initial = bracket(4);
    const first = initial.rounds[0].matches[0];
    const recorded = recordTournamentWinner(initial, first.id, first.participantAId!);
    const undone = undoLastTournamentResult(recorded);

    expect(canEditTournamentSetup(recorded)).toBe(false);
    expect(canEditTournamentSetup(undone)).toBe(false);
    expect(() => updateTournamentSetup(recorded, "Cup", ["One", "Two"], "entry-order")).toThrow("locked");
    expect(() => updateTournamentSetup(undone, "Cup", ["One", "Two"], "entry-order")).toThrow("locked");
  });

  it("validates names and keeps round-robin format when rebuilding its schedule", () => {
    let id = 0;
    const initial = createRoundRobinTournament("League", entrants(4), { idFactory: (prefix) => `${prefix}-${++id}` });
    expect(() => updateTournamentSetup(initial, "League", ["Alex", " alex "], "entry-order")).toThrow("unique");

    const updated = updateTournamentSetup(initial, "League 2", ["A", "B", "C"], "random", "round-robin", {
      idFactory: (prefix) => `${prefix}-updated-${++id}`,
      random: () => 0,
    });
    expect(updated.format).toBe("round-robin");
    expect(updated.seeding).toBe("random");
    expect(updated.rounds).toHaveLength(3);
    expect(updated.rounds.flatMap((round) => round.matches).filter((match) => match.status === "pending")).toHaveLength(3);
  });

  it("switches supported tournament formats before results and enforces the new limit", () => {
    const initial = bracket(4);
    let id = 0;
    const league = updateTournamentSetup(
      initial,
      initial.title,
      initial.participants.map((participant) => participant.name),
      "entry-order",
      "round-robin",
      { idFactory: (prefix) => `${prefix}-league-${++id}` },
    );
    expect(league.format).toBe("round-robin");
    expect(league.rounds).toHaveLength(3);
    expect(league.rounds.flatMap((round) => round.matches)).toHaveLength(6);

    const bracketAgain = updateTournamentSetup(
      league,
      league.title,
      league.participants.map((participant) => participant.name),
      "entry-order",
      "single-elimination",
      { idFactory: (prefix) => `${prefix}-bracket-${++id}` },
    );
    expect(bracketAgain.format).toBe("single-elimination");
    expect(bracketAgain.rounds).toHaveLength(2);
    expect(() => updateTournamentSetup(
      initial,
      initial.title,
      entrants(33).map((participant) => participant.name),
      "entry-order",
      "round-robin",
    )).toThrow("up to 32");
  });
});

describe("round-robin scheduling and standings", () => {
  function roundRobin(count: number) {
    let id = 0;
    return createRoundRobinTournament("League Night", entrants(count), {
      id: "league-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      idFactory: (prefix) => `${prefix}-${++id}`,
    });
  }

  it("schedules every pair exactly once for an even roster", () => {
    const tournament = roundRobin(4);
    const pairings = tournament.rounds.flatMap((round) => round.matches.map((match) =>
      [match.participantAId, match.participantBId].sort().join("/"),
    ));

    expect(tournament.format).toBe("round-robin");
    expect(tournament.rounds).toHaveLength(3);
    expect(pairings).toHaveLength(6);
    expect(new Set(pairings).size).toBe(6);
    expect(tournament.rounds.flatMap((round) => round.matches).every((match) => match.status === "pending")).toBe(true);
  });

  it("rotates exactly one bye per participant and schedules all odd-roster pairs", () => {
    const tournament = roundRobin(5);
    const matches = tournament.rounds.flatMap((round) => round.matches);
    const byes = matches.filter((match) => match.status === "bye");
    const playedPairings = matches.filter((match) => match.status === "pending")
      .map((match) => [match.participantAId, match.participantBId].sort().join("/"));

    expect(tournament.rounds).toHaveLength(5);
    expect(byes).toHaveLength(5);
    expect(new Set(byes.map((match) => match.winnerId)).size).toBe(5);
    expect(playedPairings).toHaveLength(10);
    expect(new Set(playedPairings).size).toBe(10);
    expect(getTournamentProgress(tournament)).toMatchObject({ played: 0, total: 10 });
  });

  it("calculates 3-point standings, completes all matches, and derives a unique champion", () => {
    let tournament = roundRobin(3);
    const matches = tournament.rounds.flatMap((round) => round.matches).filter((match) => match.status === "pending");
    const winners = ["p2", "p1", "p1"];
    matches.forEach((match, index) => {
      tournament = recordTournamentWinner(tournament, match.id, winners[index], `2026-01-01T00:0${index}:00.000Z`);
    });

    expect(tournament.status).toBe("completed");
    expect(tournament.events.map((event) => event.type)).toEqual(["result-recorded", "result-recorded", "result-recorded"]);
    expect(getTournamentStandings(tournament).map(({ participant, wins, losses, points }) => ({
      id: participant.id,
      wins,
      losses,
      points,
    }))).toEqual([
      { id: "p1", wins: 2, losses: 0, points: 6 },
      { id: "p2", wins: 1, losses: 1, points: 3 },
      { id: "p3", wins: 0, losses: 2, points: 0 },
    ]);
    expect(getTournamentProgress(tournament)).toEqual({ played: 3, total: 3, champion: "Player 1" });
  });

  it("records draws, applies configurable W-D-L points, recalculates the tied mini-table, and undoes score corrections", () => {
    const initial = createRoundRobinTournament("Scored league", entrants(3), {
      id: "scored-league",
      roundRobinTiebreaker: "head-to-head",
      scoring: { winPoints: 5, drawPoints: 2, lossPoints: 1 },
    });
    const matchBetween = (firstId: string, secondId: string) => initial.rounds.flatMap((round) => round.matches)
      .find((match) => [match.participantAId, match.participantBId].includes(firstId) &&
        [match.participantAId, match.participantBId].includes(secondId));
    const p1p2 = matchBetween("p1", "p2");
    const p1p3 = matchBetween("p1", "p3");
    const p2p3 = matchBetween("p2", "p3");
    if (!p1p2 || !p1p3 || !p2p3) throw new Error("Expected a full round-robin schedule.");

    let tournament = recordTournamentScore(initial, p1p2.id, 1, 1, "2026-01-01T00:00:00.000Z");
    expect(tournament.rounds.flatMap((round) => round.matches).find((match) => match.id === p1p2.id))
      .toMatchObject({ status: "complete", scoreA: 1, scoreB: 1 });
    expect(tournament.rounds.flatMap((round) => round.matches).find((match) => match.id === p1p2.id)?.winnerId).toBeUndefined();
    tournament = recordTournamentScore(tournament, p1p3.id,
      p1p3.participantAId === "p1" ? 3 : 1, p1p3.participantAId === "p1" ? 1 : 3, "2026-01-01T00:01:00.000Z");
    tournament = recordTournamentScore(tournament, p2p3.id,
      p2p3.participantAId === "p2" ? 2 : 0, p2p3.participantAId === "p2" ? 0 : 2, "2026-01-01T00:02:00.000Z");

    expect(tournament.status).toBe("completed");
    expect(getTournamentStandings(tournament).map(({ participant, wins, draws, losses, points, headToHeadPoints, rank }) => ({
      id: participant.id, wins, draws, losses, points, headToHeadPoints, rank,
    }))).toEqual([
      { id: "p1", wins: 1, draws: 1, losses: 0, points: 7, headToHeadPoints: 2, rank: 1 },
      { id: "p2", wins: 1, draws: 1, losses: 0, points: 7, headToHeadPoints: 2, rank: 1 },
      { id: "p3", wins: 0, draws: 0, losses: 2, points: 2, headToHeadPoints: 0, rank: 3 },
    ]);
    expect(getTournamentProgress(tournament).champion).toBeUndefined();

    tournament = correctTournamentScore(tournament, p1p2.id,
      p1p2.participantAId === "p1" ? 2 : 1, p1p2.participantAId === "p1" ? 1 : 2, "2026-01-01T00:03:00.000Z");
    expect(getTournamentStandings(tournament)[0]).toMatchObject({ participant: { id: "p1" }, wins: 2, points: 10, rank: 1 });
    expect(tournament.events.at(-1)).toMatchObject({ type: "result-corrected", previousScoreA: 1, previousScoreB: 1 });

    const undone = undoLastTournamentResult(tournament, "2026-01-01T00:04:00.000Z");
    expect(undone.rounds.flatMap((round) => round.matches).find((match) => match.id === p1p2.id))
      .toMatchObject({ status: "pending" });
    expect(undone.events.at(-1)).toMatchObject({ type: "result-undone", previousScoreA: 2, previousScoreB: 1 });
    expect(getTournamentProgress(undone)).toMatchObject({ played: 2, total: 3 });
  });

  it("rejects round-robin score rules that can reward a draw as much as a win", () => {
    expect(() => createRoundRobinTournament("Invalid scoring", entrants(2), {
      scoring: { winPoints: 3, drawPoints: 3, lossPoints: 0 },
    })).toThrow("wins above draws");
  });

  it("keeps tied leaders tied and undo removes only the latest league result", () => {
    let tournament = roundRobin(3);
    const matches = tournament.rounds.flatMap((round) => round.matches).filter((match) => match.status === "pending");
    const winners = ["p2", "p3", "p1"];
    matches.forEach((match, index) => {
      tournament = recordTournamentWinner(tournament, match.id, winners[index], `2026-01-01T00:0${index}:00.000Z`);
    });
    expect(getTournamentProgress(tournament).champion).toBeUndefined();
    expect(getTournamentStandings(tournament).every((standing) => standing.rank === 1)).toBe(true);

    const undone = undoLastTournamentResult(tournament, "2026-01-01T01:00:00.000Z");
    expect(undone.status).toBe("in_progress");
    expect(undone.rounds.flatMap((round) => round.matches).filter((match) => match.status === "complete")).toHaveLength(2);
    expect(undone.rounds.flatMap((round) => round.matches).filter((match) => match.status === "pending")).toHaveLength(1);
    expect(getTournamentProgress(undone)).toMatchObject({ played: 2, total: 3 });
    expect(undone.events.at(-1)).toMatchObject({ type: "result-undone", previousWinnerId: "p1", sequence: 4 });
  });

  it("uses the tied teams' mini-table to break a points tie when configured", () => {
    const initial = createRoundRobinTournament("Head-to-head League", entrants(4), {
      id: "h2h-league",
      roundRobinTiebreaker: "head-to-head",
      idFactory: (() => { let id = 0; return (prefix: string) => `${prefix}-${++id}`; })(),
    });
    const wins = new Map([
      ["p1/p2", "p2"],
      ["p1/p3", "p1"],
      ["p1/p4", "p1"],
      ["p2/p3", "p2"],
      ["p2/p4", "p4"],
      ["p3/p4", "p3"],
    ]);
    let tournament = initial;
    for (const match of initial.rounds.flatMap((round) => round.matches).filter((item) => item.status === "pending")) {
      const pair = [match.participantAId!, match.participantBId!].sort().join("/");
      tournament = recordTournamentWinner(tournament, match.id, wins.get(pair)!);
    }

    const standings = getTournamentStandings(tournament);
    expect(standings.slice(0, 2).map(({ participant, points, headToHeadPoints, rank }) => ({
      id: participant.id,
      points,
      headToHeadPoints,
      rank,
    }))).toEqual([
      { id: "p2", points: 6, headToHeadPoints: 3, rank: 1 },
      { id: "p1", points: 6, headToHeadPoints: 0, rank: 2 },
    ]);
    expect(getTournamentProgress(tournament).champion).toBe("Player 2");
  });

  it("corrects a round-robin result and recalculates standings", () => {
    const initial = roundRobin(3);
    const firstMatch = initial.rounds[0].matches.find((match) => match.status === "pending");
    if (!firstMatch) throw new Error("Expected a scheduled match.");
    let tournament = recordTournamentWinner(initial, firstMatch.id, firstMatch.participantAId!);
    tournament = correctTournamentWinner(tournament, firstMatch.id, firstMatch.participantBId!, "2026-01-01T01:00:00.000Z");

    expect(tournament.rounds[0].matches.find((match) => match.id === firstMatch.id)).toMatchObject({
      status: "complete",
      winnerId: firstMatch.participantBId,
      resultSequence: 2,
    });
    expect(tournament.events.at(-1)).toMatchObject({
      type: "result-corrected",
      previousWinnerId: firstMatch.participantAId,
      winnerId: firstMatch.participantBId,
      sequence: 2,
    });
    expect(getTournamentStandings(tournament).find((standing) => standing.participant.id === firstMatch.participantBId)?.points).toBe(3);
    expect(getDependentCompletedMatchCount(tournament, firstMatch.id)).toBe(0);
  });
});

describe("match results and advancement", () => {
  it("records a weighted match condition separately from the actual winner", () => {
    const initial = bracket(2);
    const match = initial.rounds[0].matches[0];
    const draw = {
      wheelId: "maps",
      wheelTitle: "Map picker",
      optionId: "arena",
      optionLabel: "Arena",
      optionColor: "#123456",
      optionWeight: 2,
      optionChance: 2 / 3,
      createdAt: "2026-01-01T01:00:00.000Z",
    };
    let tournament = recordTournamentCondition(initial, match.id, draw);

    expect(tournament.rounds[0].matches[0].conditionDraw).toEqual(draw);
    expect(tournament.events.at(-1)).toMatchObject({ type: "condition-drawn", conditionDraw: draw, sequence: 1 });
    tournament = recordTournamentWinner(tournament, match.id, match.participantAId!, "2026-01-01T02:00:00.000Z");

    expect(tournament.rounds[0].matches[0]).toMatchObject({ status: "complete", winnerId: match.participantAId, conditionDraw: draw });
    expect(tournament.events.at(-1)).toMatchObject({ type: "result-recorded", winnerId: match.participantAId, sequence: 2 });
  });

  it("keeps a condition draw attached to its match slot when an upstream result is corrected", () => {
    let tournament = bracket(4);
    const first = tournament.rounds[0].matches[0];
    const second = tournament.rounds[0].matches[1];
    tournament = recordTournamentWinner(tournament, first.id, first.participantAId!);
    tournament = recordTournamentWinner(tournament, second.id, second.participantAId!);
    const final = tournament.rounds[1].matches[0];
    tournament = recordTournamentCondition(tournament, final.id, {
      wheelId: "maps", wheelTitle: "Map picker", optionId: "arena", optionLabel: "Arena",
      optionColor: "#123456", optionWeight: 1, optionChance: 0.5, createdAt: "2026-01-01T01:00:00.000Z",
    });
    tournament = recordTournamentWinner(tournament, final.id, final.participantAId!);
    tournament = correctTournamentWinner(tournament, first.id, first.participantBId!);

    expect(tournament.rounds[1].matches[0]).toMatchObject({ status: "pending" });
    expect(tournament.rounds[1].matches[0].conditionDraw?.optionLabel).toBe("Arena");
    expect(tournament.events.some((event) => event.type === "condition-drawn")).toBe(true);
  });

  it("advances winners, completes the final, and derives the champion", () => {
    const initial = bracket(4);
    const [first, second] = initial.rounds[0].matches;
    let tournament = recordTournamentWinner(initial, first.id, "p1", "2026-01-01T01:00:00.000Z");
    tournament = recordTournamentWinner(tournament, second.id, "p3", "2026-01-01T02:00:00.000Z");
    const final = tournament.rounds[1].matches[0];

    expect(final).toMatchObject({ status: "pending", participantAId: "p1", participantBId: "p3" });
    tournament = recordTournamentWinner(tournament, final.id, "p3", "2026-01-01T03:00:00.000Z");

    expect(tournament.status).toBe("completed");
    expect(getTournamentProgress(tournament)).toEqual({ played: 3, total: 3, champion: "Player 3" });
  });

  it("rejects recording a winner who is not in the match", () => {
    const tournament = bracket(4);
    const match = tournament.rounds[0].matches[0];

    expect(() => recordTournamentWinner(tournament, match.id, "p3")).toThrow("one of the participants");
  });

  it("undoes only the latest result and clears that winner from the next match", () => {
    const initial = bracket(4);
    const first = initial.rounds[0].matches[0];
    const second = initial.rounds[0].matches[1];
    let tournament = recordTournamentWinner(initial, first.id, "p1", "2026-01-01T01:00:00.000Z");
    tournament = recordTournamentWinner(tournament, second.id, "p3", "2026-01-01T02:00:00.000Z");
    const undone = undoLastTournamentResult(tournament, "2026-01-01T03:00:00.000Z");

    expect(undone.rounds[0].matches[1]).toMatchObject({ status: "pending", participantAId: "p2", participantBId: "p3" });
    expect(undone.rounds[1].matches[0].participantBId).toBeUndefined();
    expect(undone.rounds[1].matches[0].participantAId).toBe("p1");
    expect(hasUndoableTournamentResult(undone)).toBe(true);

    const undoneAgain = undoLastTournamentResult(undone, "2026-01-01T04:00:00.000Z");
    expect(undoneAgain.rounds[0].matches[0].status).toBe("pending");
    expect(hasUndoableTournamentResult(undoneAgain)).toBe(false);
  });

  it("corrects an elimination result, reopens only its dependent path, and preserves unrelated results", () => {
    const initial = bracket(4);
    const [first, second] = initial.rounds[0].matches;
    let tournament = recordTournamentWinner(initial, first.id, "p1", "2026-01-01T01:00:00.000Z");
    tournament = recordTournamentWinner(tournament, second.id, "p3", "2026-01-01T02:00:00.000Z");
    const final = tournament.rounds[1].matches[0];
    tournament = recordTournamentWinner(tournament, final.id, "p3", "2026-01-01T03:00:00.000Z");

    expect(getDependentCompletedMatchCount(tournament, first.id)).toBe(1);
    const corrected = correctTournamentWinner(tournament, first.id, "p4", "2026-01-01T04:00:00.000Z");

    expect(corrected.status).toBe("in_progress");
    expect(corrected.rounds[0].matches[0]).toMatchObject({ status: "complete", winnerId: "p4" });
    expect(corrected.rounds[0].matches[1]).toMatchObject({ status: "complete", winnerId: "p3" });
    expect(corrected.rounds[1].matches[0]).toMatchObject({ status: "pending", participantAId: "p4", participantBId: "p3" });
    expect(corrected.rounds[1].matches[0].winnerId).toBeUndefined();
    expect(corrected.events.at(-1)).toMatchObject({
      type: "result-corrected",
      previousWinnerId: "p1",
      winnerId: "p4",
      invalidatedMatches: [{ matchId: final.id, winnerId: "p3", roundNumber: 2, matchNumber: 1 }],
    });
    expect(getTournamentProgress(corrected)).toEqual({ played: 2, total: 3, champion: undefined });
    expect(() => correctTournamentWinner(corrected, first.id, "p2")).toThrow("one of the participants");
  });

  it("reopens a deeper completed path and counts every dependent result", () => {
    let tournament = bracket(8);
    for (const [index, match] of tournament.rounds[0].matches.entries()) {
      tournament = recordTournamentWinner(tournament, match.id, match.participantAId!, `2026-01-01T00:0${index}:00.000Z`);
    }
    for (const [index, match] of tournament.rounds[1].matches.entries()) {
      tournament = recordTournamentWinner(tournament, match.id, match.participantAId!, `2026-01-01T01:0${index}:00.000Z`);
    }
    const final = tournament.rounds[2].matches[0];
    tournament = recordTournamentWinner(tournament, final.id, final.participantAId!, "2026-01-01T02:00:00.000Z");

    const target = tournament.rounds[0].matches[0];
    expect(getDependentCompletedMatchCount(tournament, target.id)).toBe(2);
    const corrected = correctTournamentWinner(tournament, target.id, target.participantBId!, "2026-01-01T03:00:00.000Z");
    expect(corrected.rounds[1].matches[0].status).toBe("pending");
    expect(corrected.rounds[2].matches[0].status).toBe("pending");
    expect(corrected.rounds[1].matches[1].status).toBe("complete");
    expect(corrected.rounds[0].matches[1].status).toBe("complete");
  });

  it("formats late bracket rounds clearly and shuffles without mutating the input", () => {
    const items = [1, 2, 3, 4];
    expect(shuffleParticipants(items, () => 0)).toEqual([2, 3, 4, 1]);
    expect(items).toEqual([1, 2, 3, 4]);
    expect(getTournamentRoundLabel(3, 4)).toBe("Semifinals");
    expect(getTournamentRoundLabel(4, 4)).toBe("Final");
  });
});
