import type { RoundRobinScoring, RoundRobinTiebreaker, Tournament, TournamentByePolicy, TournamentConditionDraw, TournamentFormat, TournamentParticipantAttendance, TournamentSeeding, TournamentWithdrawalPolicy } from "../types";
import { createId } from "../utils/ids";
import {
  createSingleEliminationTournament,
  createRoundRobinTournament,
  correctTournamentWinner,
  recordTournamentWinner,
  recordTournamentBye,
  withdrawTournamentParticipant,
  recordTournamentForfeit,
  recordTournamentScore,
  correctTournamentScore,
  recordTournamentCondition as recordCondition,
  drawTournamentWinners as drawWinners,
  undoTournamentWinnerDraw as undoWinnerDraw,
  undoLastTournamentResult,
  updateTournamentSetup as rebuildTournamentSetup,
  setTournamentParticipantAttendance as setParticipantAttendance,
} from "../utils/tournamentLogic";
import { defaultRoundRobinScoring } from "../data/tournamentDefaults";
import { loadData, saveData, StaleEditError } from "./storageService";

export type TournamentRosterMetadata = {
  group?: string;
  role?: string;
  seat?: number;
};

export function getTournaments(): Tournament[] {
  return loadData().tournaments;
}

export function getTournament(tournamentId: string): Tournament | undefined {
  return getTournaments().find((tournament) => tournament.id === tournamentId);
}

export function saveTournament(tournament: Tournament): Tournament {
  const data = loadData();
  const updatedTournament = { ...tournament, updatedAt: new Date().toISOString() };
  const exists = data.tournaments.some((item) => item.id === tournament.id);
  const tournaments = exists
    ? data.tournaments.map((item) => item.id === tournament.id ? updatedTournament : item)
    : [updatedTournament, ...data.tournaments];
  saveData({ ...data, tournaments });
  return updatedTournament;
}

export function createTournamentPreview(
  title: string,
  names: string[],
  seeding: TournamentSeeding = "entry-order",
  format: TournamentFormat = "single-elimination",
  roundRobinTiebreaker: RoundRobinTiebreaker = "seed",
  scoring: RoundRobinScoring = defaultRoundRobinScoring,
  metadataByName: Record<string, TournamentRosterMetadata> = {},
  byePolicy?: TournamentByePolicy,
  withdrawalPolicy?: TournamentWithdrawalPolicy,
): Tournament {
  if (seeding === "manual") {
    const seats = names.map((name) => metadataByName[name.toLocaleLowerCase()]?.seat);
    if (seats.some((seat) => seat === undefined || !Number.isInteger(seat) || seat < 1) || new Set(seats).size !== names.length) {
      throw new Error("Manual seeding requires a unique positive seat number for every participant.");
    }
  }
  const orderedNames = seeding === "manual"
    ? [...names].sort((first, second) => (metadataByName[first.toLocaleLowerCase()]?.seat ?? 0) - (metadataByName[second.toLocaleLowerCase()]?.seat ?? 0))
    : names;
  const entrants = orderedNames.map((name) => ({ id: createId("participant"), name, ...(metadataByName[name.toLocaleLowerCase()] ?? {}) }));
  const tournament = format === "round-robin"
    ? createRoundRobinTournament(title, entrants, { seeding, roundRobinTiebreaker, scoring, byePolicy, withdrawalPolicy })
    : createSingleEliminationTournament(title, entrants, { seeding, byePolicy, withdrawalPolicy });
  return tournament;
}

export function createTournamentFromPreview(preview: Tournament): Tournament {
  if (preview.events.length > 0 || preview.rounds.some((round) =>
    round.matches.some((match) => match.status === "complete" || match.resultSequence !== undefined))) {
    throw new Error("Only an untouched tournament preview can be created.");
  }
  if (getTournament(preview.id)) throw new Error("This tournament preview has already been created.");
  return saveTournament(preview);
}

export function createTournament(
  title: string,
  names: string[],
  seeding: TournamentSeeding = "entry-order",
  format: TournamentFormat = "single-elimination",
  roundRobinTiebreaker: RoundRobinTiebreaker = "seed",
  scoring: RoundRobinScoring = defaultRoundRobinScoring,
  metadataByName: Record<string, TournamentRosterMetadata> = {},
  byePolicy?: TournamentByePolicy,
  withdrawalPolicy?: TournamentWithdrawalPolicy,
): Tournament {
  return createTournamentFromPreview(createTournamentPreview(title, names, seeding, format, roundRobinTiebreaker, scoring, metadataByName, byePolicy, withdrawalPolicy));
}

export function updateTournamentSetup(
  tournamentId: string,
  title: string,
  names: string[],
  seeding: TournamentSeeding,
  format: TournamentFormat,
  roundRobinTiebreaker: RoundRobinTiebreaker = "seed",
  scoring: RoundRobinScoring = defaultRoundRobinScoring,
  expectedUpdatedAt?: string,
  byePolicy?: TournamentByePolicy,
  withdrawalPolicy?: TournamentWithdrawalPolicy,
): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (expectedUpdatedAt !== undefined && tournament.updatedAt !== expectedUpdatedAt) {
    throw new StaleEditError("tournament");
  }
  return saveTournament(rebuildTournamentSetup(tournament, title, names, seeding, format, undefined, roundRobinTiebreaker, scoring, byePolicy ?? tournament.byePolicy ?? "automatic", withdrawalPolicy ?? tournament.withdrawalPolicy ?? "advance-opponent"));
}

export function recordTournamentMatchBye(tournamentId: string, matchId: string): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(recordTournamentBye(tournament, matchId));
}

export function withdrawTournamentParticipantFromMatch(tournamentId: string, participantId: string): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(withdrawTournamentParticipant(tournament, participantId));
}

export function recordTournamentMatchWinner(
  tournamentId: string,
  matchId: string,
  winnerId: string,
): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(recordTournamentWinner(tournament, matchId, winnerId));
}

export function recordTournamentMatchForfeit(tournamentId: string, matchId: string, forfeitingParticipantId: string): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(recordTournamentForfeit(tournament, matchId, forfeitingParticipantId));
}

export function recordTournamentMatchScore(tournamentId: string, matchId: string, scoreA: number, scoreB: number): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(recordTournamentScore(tournament, matchId, scoreA, scoreB));
}

export function correctTournamentMatchScore(tournamentId: string, matchId: string, scoreA: number, scoreB: number): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(correctTournamentScore(tournament, matchId, scoreA, scoreB));
}

export function recordTournamentMatchCondition(
  tournamentId: string,
  matchId: string,
  conditionDraw: TournamentConditionDraw,
): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(recordCondition(tournament, matchId, conditionDraw));
}

export function drawTournamentWinner(
  tournamentId: string,
  entrants: Array<{ participantId: string; tickets: number }>,
  winnerCount: number,
): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(drawWinners(tournament, entrants, winnerCount));
}

export function undoTournamentWinnerDraw(tournamentId: string): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(undoWinnerDraw(tournament));
}

export function updateTournamentParticipantAttendance(
  tournamentId: string,
  participantId: string,
  attendanceStatus: TournamentParticipantAttendance,
): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(setParticipantAttendance(tournament, participantId, attendanceStatus));
}

export function correctTournamentMatchWinner(
  tournamentId: string,
  matchId: string,
  winnerId: string,
): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(correctTournamentWinner(tournament, matchId, winnerId));
}

export function undoTournamentResult(tournamentId: string): Tournament {
  const tournament = getTournament(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  return saveTournament(undoLastTournamentResult(tournament));
}

export function deleteTournament(tournamentId: string): void {
  const data = loadData();
  saveData({
    ...data,
    tournaments: data.tournaments.filter((tournament) => tournament.id !== tournamentId),
  });
}
