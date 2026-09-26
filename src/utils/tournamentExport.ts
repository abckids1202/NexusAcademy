import type { Tournament, TournamentEvent } from "../types";
import { getTournamentRoundLabel, getTournamentStandings } from "./tournamentLogic";

export type TournamentCsvOptions = {
  anonymizeParticipantNames: boolean;
  includeActivityHistory: boolean;
};

export type TournamentCsvPreview = {
  matchRows: number;
  standingsRows: number;
  activityRows: number;
  participantNames: "included" | "anonymized";
  activityHistory: "included" | "excluded";
};

type CsvRow = Record<string, string | number | boolean | undefined>;

const columns = [
  "record_type", "tournament", "format", "round", "match", "participant_a", "participant_b", "status",
  "score_a", "score_b", "previous_score_a", "previous_score_b", "winner", "previous_winner", "result_method", "forfeiting_participant", "previous_result_method", "previous_forfeiter", "condition", "condition_chance", "rank", "played", "wins", "draws",
  "losses", "points", "head_to_head_points", "entrant", "tickets", "initial_chance", "selected",
  "pick_number", "pick_chance", "activity",
];

function csvCell(value: CsvRow[string]): string {
  if (value === undefined || value === null) return "\"\"";
  let text = String(value);
  if (typeof value === "string" && /^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function getNameMap(tournament: Tournament, anonymize: boolean): Map<string, string> {
  const names = new Map(tournament.participants.map((participant) => [
    participant.id,
    anonymize ? `Participant ${participant.seed}` : participant.name,
  ]));
  if (!anonymize) return names;
  let nextNumber = tournament.participants.length + 1;
  for (const event of tournament.events) {
    for (const entrant of event.winnerDraw?.entrants ?? []) {
      if (!names.has(entrant.participantId)) names.set(entrant.participantId, `Entrant ${nextNumber++}`);
    }
  }
  return names;
}

function eventActivity(event: TournamentEvent, name: (participantId?: string) => string, events: TournamentEvent[]): string {
  if (event.type === "participant-attendance-changed") {
    const labels = { expected: "Expected", "checked-in": "Checked in", "not-present": "Not present" };
    return `Participant attendance changed: ${name(event.participantId)} (${labels[event.previousAttendanceStatus ?? "expected"]} to ${labels[event.attendanceStatus ?? "expected"]}); no pairing or result changed`;
  }
  if (event.type === "condition-drawn" && event.conditionDraw) {
    return `Match condition drawn: ${event.conditionDraw.optionLabel} (${event.conditionDraw.wheelTitle})`;
  }
  if (event.type === "winner-draw-undone") {
    const drawSequence = events.find((item) => item.id === event.relatedEventId)?.sequence;
    return `Chance draw undone (draw event ${drawSequence ?? "unknown"})`;
  }
  if (event.type === "result-recorded" && event.resultMethod === "forfeit") return `Forfeit recorded: ${name(event.forfeitingParticipantId)} forfeited; ${name(event.winnerId)} awarded the win`;
  if (event.type === "result-recorded") return `Match result recorded${event.winnerId ? `; winner: ${name(event.winnerId)}` : "; draw"}`;
  if (event.type === "result-corrected") return `Match result corrected${event.previousResultMethod === "forfeit" ? `; previous forfeit: ${name(event.previousForfeitingParticipantId)}` : ""}${event.resultMethod === "forfeit" ? `; forfeiter: ${name(event.forfeitingParticipantId)}` : ""}${event.winnerId ? `; winner: ${name(event.winnerId)}` : "; draw"}`;
  if (event.type === "result-undone") return event.previousResultMethod === "forfeit"
    ? `Forfeit undone; ${name(event.previousForfeitingParticipantId)} had forfeited`
    : `Match result undone${event.previousWinnerId ? `; previous winner: ${name(event.previousWinnerId)}` : ""}`;
  return "Chance-based winner draw";
}

function buildRows(tournament: Tournament, options: TournamentCsvOptions): CsvRow[] {
  const names = getNameMap(tournament, options.anonymizeParticipantNames);
  const name = (id?: string) => id ? names.get(id) ?? "Participant" : "";
  const common = { tournament: tournament.title, format: tournament.format };
  const rows: CsvRow[] = [];

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      const winner = match.winnerId ? name(match.winnerId) : "";
      rows.push({
        record_type: "match",
        ...common,
        round: getTournamentRoundLabel(round.roundNumber, tournament.rounds.length, tournament.format),
        match: match.matchNumber,
        participant_a: name(match.participantAId),
        participant_b: name(match.participantBId),
        status: match.status,
        score_a: match.scoreA,
        score_b: match.scoreB,
        winner,
        result_method: match.status === "complete" ? match.resultMethod ?? "played" : undefined,
        forfeiting_participant: name(match.forfeitingParticipantId),
        condition: match.conditionDraw?.optionLabel,
        condition_chance: match.conditionDraw?.optionChance,
      });
    }
  }

  if (tournament.format === "round-robin") {
    for (const standing of getTournamentStandings(tournament)) {
      rows.push({
        record_type: "standing",
        ...common,
        participant_a: name(standing.participant.id),
        rank: standing.rank,
        played: standing.played,
        wins: standing.wins,
        draws: standing.draws,
        losses: standing.losses,
        points: standing.points,
        head_to_head_points: tournament.roundRobinTiebreaker === "head-to-head" ? standing.headToHeadPoints : undefined,
      });
    }
  }

  if (options.includeActivityHistory) {
    for (const event of tournament.events) {
      if (event.type === "winner-drawn" && event.winnerDraw) {
        const winnerPositions = new Map(event.winnerDraw.winnerIds.map((id, index) => [id, index]));
        event.winnerDraw.entrants.forEach((entrant) => {
          const pickIndex = winnerPositions.get(entrant.participantId);
          rows.push({
            record_type: "winner-draw-entrant",
            ...common,
            entrant: options.anonymizeParticipantNames
              ? name(entrant.participantId) || `Entrant ${event.winnerDraw!.entrants.indexOf(entrant) + 1}`
              : names.get(entrant.participantId) ?? entrant.participantName,
            tickets: entrant.tickets,
            initial_chance: entrant.chance,
            selected: pickIndex !== undefined,
            pick_number: pickIndex === undefined ? undefined : pickIndex + 1,
            pick_chance: pickIndex === undefined ? undefined : event.winnerDraw!.winnerChances[pickIndex],
            activity: `Chance draw event ${event.sequence}; random selection, not a match result`,
          });
        });
      } else {
        rows.push({
          record_type: "activity",
          ...common,
          round: event.roundNumber === undefined ? undefined : getTournamentRoundLabel(event.roundNumber, tournament.rounds.length, tournament.format),
          match: event.matchNumber,
          score_a: event.scoreA,
          score_b: event.scoreB,
          previous_score_a: event.previousScoreA,
          previous_score_b: event.previousScoreB,
          winner: name(event.winnerId),
          previous_winner: name(event.previousWinnerId),
          result_method: event.resultMethod,
          forfeiting_participant: name(event.forfeitingParticipantId),
          previous_result_method: event.previousResultMethod,
          previous_forfeiter: name(event.previousForfeitingParticipantId),
          condition: event.conditionDraw?.optionLabel,
          condition_chance: event.conditionDraw?.optionChance,
          activity: `Event ${event.sequence}: ${eventActivity(event, name, tournament.events)}`,
        });
      }
    }
  }

  return rows;
}

export function getTournamentCsvPreview(tournament: Tournament, options: TournamentCsvOptions): TournamentCsvPreview {
  const matchRows = tournament.rounds.reduce((total, round) => total + round.matches.length, 0);
  const standingsRows = tournament.format === "round-robin" ? tournament.participants.length : 0;
  const activityRows = options.includeActivityHistory
    ? tournament.events.reduce((total, event) => total + (event.type === "winner-drawn" ? event.winnerDraw?.entrants.length ?? 0 : 1), 0)
    : 0;
  return {
    matchRows,
    standingsRows,
    activityRows,
    participantNames: options.anonymizeParticipantNames ? "anonymized" : "included",
    activityHistory: options.includeActivityHistory ? "included" : "excluded",
  };
}

export function buildTournamentCsv(tournament: Tournament, options: TournamentCsvOptions): string {
  const rows = buildRows(tournament, options);
  const csv = [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");
  return `\uFEFF${csv}\r\n`;
}
