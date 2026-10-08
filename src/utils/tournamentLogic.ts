import type {
  Tournament,
  TournamentEvent,
  TournamentEventType,
  TournamentConditionDraw,
  TournamentFormat,
  TournamentParticipantAttendance,
  TournamentParticipant,
  TournamentRound,
  RoundRobinScoring,
  RoundRobinTiebreaker,
  TournamentSeeding,
  TournamentByePolicy,
  TournamentWithdrawalPolicy,
  TournamentWinnerDraw,
} from "../types";
import { createId } from "./ids";
import { randomInteger } from "./random";
import { defaultRoundRobinScoring } from "../data/tournamentDefaults";

export const MAX_TOURNAMENT_PARTICIPANTS = 256;

type TournamentOptions = {
  id?: string;
  seeding?: TournamentSeeding;
  byePolicy?: TournamentByePolicy;
  withdrawalPolicy?: TournamentWithdrawalPolicy;
  roundRobinTiebreaker?: RoundRobinTiebreaker;
  scoring?: RoundRobinScoring;
  createdAt?: string;
  idFactory?: (prefix: string) => string;
  random?: () => number;
};

type PreparedTournament = {
  title: string;
  participants: TournamentParticipant[];
  options: TournamentOptions;
  makeId: (prefix: string) => string;
  createdAt: string;
};

export type TournamentStanding = {
  rank: number;
  participant: TournamentParticipant;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  headToHeadPoints: number;
};

export function isValidRoundRobinScoring(value: unknown): value is RoundRobinScoring {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const scoring = value as Record<string, unknown>;
  const points = [scoring.winPoints, scoring.drawPoints, scoring.lossPoints];
  return points.every((point) => typeof point === "number" && Number.isInteger(point) && point >= 0 && point <= 10000) &&
    Number(scoring.winPoints) > Number(scoring.drawPoints) && Number(scoring.drawPoints) >= Number(scoring.lossPoints);
}

function assertValidRoundRobinScoring(value: RoundRobinScoring): void {
  if (!isValidRoundRobinScoring(value)) {
    throw new Error("Scoring must use whole nonnegative points up to 10,000, with wins above draws and draws at least equal to losses.");
  }
}

function prepareTournament(
  title: string,
  entrants: Array<Pick<TournamentParticipant, "id" | "name">>,
  options: TournamentOptions,
): PreparedTournament {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Give this tournament a name.");
  if (entrants.length < 2) throw new Error("Add at least two participants.");
  if (entrants.length > MAX_TOURNAMENT_PARTICIPANTS) {
    throw new Error(`A tournament can have up to ${MAX_TOURNAMENT_PARTICIPANTS} participants.`);
  }
  if (entrants.some((entrant) => !entrant.name.trim() || !entrant.id)) {
    throw new Error("Every participant needs a name and a unique ID.");
  }
  if (new Set(entrants.map((entrant) => entrant.id)).size !== entrants.length) {
    throw new Error("Participant IDs must be unique.");
  }

  const seeding = options.seeding ?? "entry-order";
  const orderedEntrants = seeding === "random"
    ? shuffleParticipants(entrants, options.random)
    : [...entrants];
  return {
    title: normalizedTitle,
    participants: orderedEntrants.map((entrant, index) => ({
      ...entrant,
      name: entrant.name.trim(),
      seed: index + 1,
      attendanceStatus: "expected",
    })),
    options,
    makeId: options.idFactory ?? createId,
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
}

function createTournamentBase(
  prepared: PreparedTournament,
  format: TournamentFormat,
  rounds: TournamentRound[],
): Tournament {
  return {
    id: prepared.options.id ?? prepared.makeId("tournament"),
    title: prepared.title,
    format,
    roundRobinTiebreaker: format === "round-robin" ? prepared.options.roundRobinTiebreaker ?? "seed" : "seed",
    scoring: { ...(prepared.options.scoring ?? defaultRoundRobinScoring) },
    seeding: prepared.options.seeding ?? "entry-order",
    byePolicy: prepared.options.byePolicy ?? "automatic",
    withdrawalPolicy: prepared.options.withdrawalPolicy ?? "advance-opponent",
    status: "in_progress",
    participants: prepared.participants,
    rounds,
    nextResultSequence: 1,
    events: [],
    nextEventSequence: 1,
    createdAt: prepared.createdAt,
    updatedAt: prepared.createdAt,
  };
}

type TournamentEventInput = Omit<TournamentEvent, "id" | "sequence">;

function appendTournamentEvent(tournament: Tournament, event: TournamentEventInput): Pick<Tournament, "events" | "nextEventSequence"> {
  return {
    events: [...tournament.events, {
      ...event,
      id: createId("tournament_event"),
      sequence: tournament.nextEventSequence,
    }],
    nextEventSequence: tournament.nextEventSequence + 1,
  };
}

export function setTournamentParticipantAttendance(
  tournament: Tournament,
  participantId: string,
  attendanceStatus: TournamentParticipantAttendance,
  createdAt = new Date().toISOString(),
): Tournament {
  if (!["expected", "checked-in", "not-present"].includes(attendanceStatus)) {
    throw new Error("Choose a valid attendance status.");
  }
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("Attendance timestamp is invalid.");
  const participant = tournament.participants.find((item) => item.id === participantId);
  if (!participant) throw new Error("Participant not found.");
  const previousAttendanceStatus = participant.attendanceStatus ?? "expected";
  if (previousAttendanceStatus === attendanceStatus) return tournament;

  const participants = tournament.participants.map((item) => item.id === participantId
    ? { ...item, attendanceStatus }
    : item);
  const eventUpdate = appendTournamentEvent(tournament, {
    type: "participant-attendance-changed",
    participantId,
    previousAttendanceStatus,
    attendanceStatus,
    createdAt,
  });
  return { ...tournament, participants, ...eventUpdate, updatedAt: createdAt };
}

function createResultEvent(
  type: TournamentEventType,
  round: TournamentRound,
  match: TournamentRound["matches"][number],
  createdAt: string,
  extra: Pick<TournamentEvent, "winnerId" | "previousWinnerId" | "invalidatedMatches" | "scoreA" | "scoreB" | "previousScoreA" | "previousScoreB" | "resultMethod" | "previousResultMethod" | "forfeitingParticipantId" | "previousForfeitingParticipantId"> = {},
): TournamentEventInput {
  return {
    type,
    matchId: match.id,
    roundNumber: round.roundNumber,
    matchNumber: match.matchNumber,
    createdAt,
    ...extra,
  };
}

export function recordTournamentCondition(
  tournament: Tournament,
  matchId: string,
  conditionDraw: TournamentConditionDraw,
): Tournament {
  if (tournament.status === "completed") throw new Error("This tournament is already complete.");
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  const roundIndex = rounds.findIndex((round) => round.matches.some((match) => match.id === matchId));
  const match = rounds[roundIndex]?.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "pending") throw new Error("Conditions can only be drawn for a pending match.");
  if (!match.participantAId || !match.participantBId) throw new Error("Both participants must be decided before drawing a condition.");
  if (!conditionDraw.wheelId.trim() || !conditionDraw.optionId.trim() || !conditionDraw.optionLabel.trim() ||
    !Number.isFinite(conditionDraw.optionWeight) || conditionDraw.optionWeight <= 0 ||
    !Number.isFinite(conditionDraw.optionChance) || conditionDraw.optionChance <= 0 || conditionDraw.optionChance > 1 ||
    Number.isNaN(Date.parse(conditionDraw.createdAt))) throw new Error("The match condition draw is invalid.");

  match.conditionDraw = conditionDraw;
  const eventUpdate = appendTournamentEvent(tournament, {
    type: "condition-drawn",
    matchId: match.id,
    roundNumber: rounds[roundIndex].roundNumber,
    matchNumber: match.matchNumber,
    createdAt: conditionDraw.createdAt,
    conditionDraw,
  });
  return { ...tournament, rounds, ...eventUpdate, updatedAt: conditionDraw.createdAt };
}

export function drawTournamentWinners(
  tournament: Tournament,
  entrants: Array<{ participantId: string; tickets: number }>,
  winnerCount: number,
  createdAt = new Date().toISOString(),
  pickIndex: (maxExclusive: number) => number = randomInteger,
): Tournament {
  if (entrants.length < 2) throw new Error("Select at least two eligible participants.");
  if (new Set(entrants.map((entrant) => entrant.participantId)).size !== entrants.length) {
    throw new Error("Each participant can only appear once in the eligible pool.");
  }
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > entrants.length) {
    throw new Error(`Choose between 1 and ${entrants.length} winners.`);
  }
  const participantById = new Map(tournament.participants.map((participant) => [participant.id, participant]));
  const remaining = entrants.map((entrant) => {
    const participant = participantById.get(entrant.participantId);
    if (!participant) throw new Error("An eligible participant is not in this tournament.");
    if (!Number.isInteger(entrant.tickets) || entrant.tickets < 1 || entrant.tickets > 10000) {
      throw new Error("Each participant must have between 1 and 10,000 tickets.");
    }
    return { participant, tickets: entrant.tickets };
  });
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("The draw timestamp is invalid.");

  const totalTickets = remaining.reduce((total, entrant) => total + entrant.tickets, 0);
  const winnerDraw: TournamentWinnerDraw = {
    entrants: remaining.map(({ participant, tickets }) => ({
      participantId: participant.id,
      participantName: participant.name,
      tickets,
      chance: tickets / totalTickets,
    })),
    winnerIds: [],
    winnerChances: [],
    withoutReplacement: true,
  };

  for (let index = 0; index < winnerCount; index += 1) {
    const currentTotal = remaining.reduce((total, entrant) => total + entrant.tickets, 0);
    const draw = pickIndex(currentTotal);
    if (!Number.isInteger(draw) || draw < 0 || draw >= currentTotal) {
      throw new Error("The random source returned an invalid draw index.");
    }
    let cursor = draw;
    const selectedIndex = remaining.findIndex(({ tickets }) => {
      cursor -= tickets;
      return cursor < 0;
    });
    const [selected] = remaining.splice(selectedIndex, 1);
    winnerDraw.winnerIds.push(selected.participant.id);
    winnerDraw.winnerChances.push(selected.tickets / currentTotal);
  }

  const eventUpdate = appendTournamentEvent(tournament, {
    type: "winner-drawn",
    createdAt,
    winnerDraw,
  });
  return { ...tournament, ...eventUpdate, updatedAt: createdAt };
}

export function undoTournamentWinnerDraw(
  tournament: Tournament,
  updatedAt = new Date().toISOString(),
): Tournament {
  const latestEvent = tournament.events.at(-1);
  if (latestEvent?.type !== "winner-drawn") {
    throw new Error("Only the latest tournament action can be undone as a winner draw.");
  }
  if (Number.isNaN(Date.parse(updatedAt))) throw new Error("The undo timestamp is invalid.");
  const eventUpdate = appendTournamentEvent(tournament, {
    type: "winner-draw-undone",
    createdAt: updatedAt,
    relatedEventId: latestEvent.id,
  });
  return { ...tournament, ...eventUpdate, updatedAt };
}

export function getSeedOrder(bracketSize: number): number[] {
  if (!Number.isInteger(bracketSize) || bracketSize < 2 || (bracketSize & (bracketSize - 1)) !== 0) {
    throw new Error("Bracket size must be a power of two greater than one.");
  }
  if (bracketSize === 2) return [1, 2];

  const previous = getSeedOrder(bracketSize / 2);
  return previous.flatMap((seed) => [seed, bracketSize + 1 - seed]);
}

export function shuffleParticipants<T>(items: T[], random?: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const destination = random ? Math.floor(random() * (index + 1)) : randomInteger(index + 1);
    [shuffled[index], shuffled[destination]] = [shuffled[destination], shuffled[index]];
  }
  return shuffled;
}

function advanceByeWinner(rounds: TournamentRound[], roundIndex: number, matchIndex: number, winnerId: string): void {
  const nextRound = rounds[roundIndex + 1];
  if (!nextRound) return;
  const destination = nextRound.matches[Math.floor(matchIndex / 2)];
  if (matchIndex % 2 === 0) destination.participantAId = winnerId;
  else destination.participantBId = winnerId;
}

export function createSingleEliminationTournament(
  title: string,
  entrants: Array<Pick<TournamentParticipant, "id" | "name">>,
  options: TournamentOptions = {},
): Tournament {
  const prepared = prepareTournament(title, entrants, options);
  const participants = prepared.participants;
  const bracketSize = 2 ** Math.ceil(Math.log2(participants.length));
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = getSeedOrder(bracketSize);
  const participantBySeed = new Map(participants.map((participant) => [participant.seed, participant]));
  const rounds: TournamentRound[] = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const matchCount = bracketSize / (2 ** (roundIndex + 1));
    rounds.push({
      roundNumber: roundIndex + 1,
      matches: Array.from({ length: matchCount }, (_, matchIndex) => ({
        id: prepared.makeId("match"),
        matchNumber: matchIndex + 1,
        status: "pending",
        ...(roundIndex === 0 ? {
          participantAId: participantBySeed.get(seedOrder[matchIndex * 2])?.id,
          participantBId: participantBySeed.get(seedOrder[matchIndex * 2 + 1])?.id,
        } : {}),
      })),
    });
  }

  for (const [matchIndex, match] of rounds[0].matches.entries()) {
    const hasA = Boolean(match.participantAId);
    const hasB = Boolean(match.participantBId);
    if (hasA === hasB) continue;
    const winnerId = match.participantAId ?? match.participantBId;
    if (!winnerId) continue;
    if ((prepared.options.byePolicy ?? "automatic") === "automatic") {
      match.status = "bye";
      match.winnerId = winnerId;
      advanceByeWinner(rounds, 0, matchIndex, winnerId);
    }
  }

  return createTournamentBase(prepared, "single-elimination", rounds);
}

export function createRoundRobinTournament(
  title: string,
  entrants: Array<Pick<TournamentParticipant, "id" | "name">>,
  options: TournamentOptions = {},
): Tournament {
  if (entrants.length > MAX_ROUND_ROBIN_PARTICIPANTS) {
    throw new Error(`Round robin supports up to ${MAX_ROUND_ROBIN_PARTICIPANTS} participants.`);
  }
  const prepared = prepareTournament(title, entrants, options);
  assertValidRoundRobinScoring(prepared.options.scoring ?? defaultRoundRobinScoring);
  const makeId = prepared.makeId;
  const rotation: Array<TournamentParticipant | null> = [...prepared.participants];
  if (rotation.length % 2 !== 0) rotation.push(null);

  const rounds = Array.from({ length: rotation.length - 1 }, (_, roundIndex): TournamentRound => {
    const matches: TournamentRound["matches"] = [];
    const pairCount = rotation.length / 2;
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      const first = rotation[pairIndex];
      const second = rotation[rotation.length - 1 - pairIndex];
      const matchNumber = pairIndex + 1;
      if (!first || !second) {
        const participant = first ?? second;
        if (participant) matches.push({
          id: makeId("match"),
          matchNumber,
          status: prepared.options.byePolicy === "manual" ? "pending" : "bye",
          participantAId: participant.id,
          ...(prepared.options.byePolicy === "manual" ? {} : { winnerId: participant.id }),
        });
      } else {
        matches.push({
          id: makeId("match"),
          matchNumber,
          status: "pending",
          participantAId: first.id,
          participantBId: second.id,
        });
      }
    }

    const last = rotation.pop() ?? null;
    rotation.splice(1, 0, last);
    return { roundNumber: roundIndex + 1, matches };
  });

  return createTournamentBase(prepared, "round-robin", rounds);
}

export function canEditTournamentSetup(tournament: Tournament): boolean {
  const hasRecordedResult = tournament.rounds.some((round) =>
    round.matches.some((match) => match.status === "complete" || match.resultSequence !== undefined),
  );
  return tournament.events.length === 0 && !hasRecordedResult;
}

export function updateTournamentSetup(
  tournament: Tournament,
  title: string,
  names: string[],
  seeding: TournamentSeeding,
  format: TournamentFormat = tournament.format,
  options: Pick<TournamentOptions, "idFactory" | "random"> = {},
  roundRobinTiebreaker: RoundRobinTiebreaker = tournament.roundRobinTiebreaker ?? "seed",
  scoring: RoundRobinScoring = tournament.scoring ?? defaultRoundRobinScoring,
  byePolicy: TournamentByePolicy = tournament.byePolicy ?? "automatic",
  withdrawalPolicy: TournamentWithdrawalPolicy = tournament.withdrawalPolicy ?? "advance-opponent",
): Tournament {
  if (!canEditTournamentSetup(tournament)) {
    throw new Error("Tournament setup is locked after event activity has been recorded.");
  }
  const seenNames = new Set<string>();
  const normalizedNames = names.map((name) => name.trim());
  for (const name of normalizedNames) {
    const key = name.toLocaleLowerCase();
    if (!key) throw new Error("Every participant needs a name.");
    if (seenNames.has(key)) throw new Error("Participant names must be unique.");
    seenNames.add(key);
  }

  const participantByName = new Map(tournament.participants.map((participant) => [participant.name.toLocaleLowerCase(), participant]));
  const orderedNames = seeding === "manual"
    ? [...normalizedNames].sort((first, second) => (participantByName.get(first.toLocaleLowerCase())?.seat ?? 0) - (participantByName.get(second.toLocaleLowerCase())?.seat ?? 0))
    : normalizedNames;
  if (seeding === "manual") {
    const seats = orderedNames.map((name) => participantByName.get(name.toLocaleLowerCase())?.seat);
    if (seats.some((seat) => seat === undefined || !Number.isInteger(seat) || seat < 1) || new Set(seats).size !== seats.length) {
      throw new Error("Manual seeding requires a unique positive seat number for every participant.");
    }
  }
  const entrants = orderedNames.map((name) => {
    const existing = participantByName.get(name.toLocaleLowerCase());
    return {
      id: existing?.id ?? createId("participant"),
      name,
      ...(existing?.group ? { group: existing.group } : {}),
      ...(existing?.role ? { role: existing.role } : {}),
      ...(existing?.seat ? { seat: existing.seat } : {}),
    };
  });
  const createOptions = {
    ...options,
    id: tournament.id,
    seeding,
    roundRobinTiebreaker,
    scoring,
    byePolicy,
    withdrawalPolicy,
    createdAt: tournament.createdAt,
  };
  const updated = format === "round-robin"
    ? createRoundRobinTournament(title, entrants, createOptions)
    : createSingleEliminationTournament(title, entrants, createOptions);
  return {
    ...updated,
    updatedAt: new Date().toISOString(),
    nextEventSequence: tournament.nextEventSequence,
  };
}

export const MAX_ROUND_ROBIN_PARTICIPANTS = 32;

export function recordTournamentWinner(
  tournament: Tournament,
  matchId: string,
  winnerId: string,
  completedAt = new Date().toISOString(),
): Tournament {
  if (tournament.status === "completed") throw new Error("This tournament is already complete.");
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  const roundIndex = rounds.findIndex((round) => round.matches.some((match) => match.id === matchId));
  const match = rounds[roundIndex]?.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "pending") throw new Error("This match is not ready for a result.");
  if (!match.participantAId || !match.participantBId) throw new Error("Both participants must be decided before recording a winner.");
  if (winnerId !== match.participantAId && winnerId !== match.participantBId) {
    throw new Error("The winner must be one of the participants in this match.");
  }

  match.status = "complete";
  match.winnerId = winnerId;
  match.resultMethod = "played";
  match.completedAt = completedAt;
  match.resultSequence = tournament.nextResultSequence;
  const eventUpdate = appendTournamentEvent(tournament, createResultEvent(
    "result-recorded",
    rounds[roundIndex],
    match,
    completedAt,
    { winnerId, resultMethod: "played" },
  ));

  if (tournament.format === "round-robin") {
    const isComplete = rounds.every((round) => round.matches.every((roundMatch) => roundMatch.status !== "pending"));
    return {
      ...tournament,
      rounds,
      ...eventUpdate,
      status: isComplete ? "completed" : "in_progress",
      nextResultSequence: tournament.nextResultSequence + 1,
      updatedAt: completedAt,
      ...(isComplete ? { completedAt } : { completedAt: undefined }),
    };
  }

  const nextRound = rounds[roundIndex + 1];
  if (nextRound) {
    const matchIndex = match.matchNumber - 1;
    const destination = nextRound.matches[Math.floor(matchIndex / 2)];
    if (matchIndex % 2 === 0) destination.participantAId = winnerId;
    else destination.participantBId = winnerId;
  }

  const isFinal = roundIndex === rounds.length - 1;
  return {
    ...tournament,
    rounds,
    ...eventUpdate,
    status: isFinal ? "completed" : "in_progress",
    nextResultSequence: tournament.nextResultSequence + 1,
    updatedAt: completedAt,
    ...(isFinal ? { completedAt } : { completedAt: undefined }),
  };
}

export function recordTournamentForfeit(
  tournament: Tournament,
  matchId: string,
  forfeitingParticipantId: string,
  completedAt = new Date().toISOString(),
): Tournament {
  const match = tournament.rounds.flatMap((round) => round.matches).find((item) => item.id === matchId);
  if (!match || match.status !== "pending") throw new Error("This match is not ready for a forfeit.");
  if (!match.participantAId || !match.participantBId) throw new Error("Both participants must be decided before recording a forfeit.");
  if (forfeitingParticipantId !== match.participantAId && forfeitingParticipantId !== match.participantBId) {
    throw new Error("The forfeiting participant must be in this match.");
  }

  const winnerId = forfeitingParticipantId === match.participantAId ? match.participantBId : match.participantAId;
  const recorded = recordTournamentWinner(tournament, matchId, winnerId, completedAt);
  const rounds = recorded.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((item) => item.id === matchId
      ? { ...item, resultMethod: "forfeit" as const, forfeitingParticipantId }
      : item),
  }));
  const events = recorded.events.map((event, index) => index === recorded.events.length - 1
    ? { ...event, resultMethod: "forfeit" as const, forfeitingParticipantId }
    : event);
  return { ...recorded, rounds, events };
}

export function recordTournamentBye(
  tournament: Tournament,
  matchId: string,
  completedAt = new Date().toISOString(),
): Tournament {
  if (tournament.status === "completed") throw new Error("This tournament is already complete.");
  const rounds = tournament.rounds.map((round) => ({ ...round, matches: round.matches.map((match) => ({ ...match })) }));
  const roundIndex = rounds.findIndex((round) => round.matches.some((match) => match.id === matchId));
  const matchIndex = rounds[roundIndex]?.matches.findIndex((item) => item.id === matchId) ?? -1;
  const match = rounds[roundIndex]?.matches[matchIndex];
  if (!match || match.status !== "pending") throw new Error("This match is not waiting for bye confirmation.");
  const participants = [match.participantAId, match.participantBId].filter((id): id is string => Boolean(id));
  if (participants.length !== 1) throw new Error("A bye can only be confirmed when exactly one participant is present.");
  const winnerId = participants[0];
  match.status = "bye";
  match.winnerId = winnerId;
  match.completedAt = completedAt;
  match.resultSequence = tournament.nextResultSequence;
  if (tournament.format !== "round-robin") advanceByeWinner(rounds, roundIndex, matchIndex, winnerId);
  const eventUpdate = appendTournamentEvent(tournament, createResultEvent("bye-confirmed", rounds[roundIndex], match, completedAt, { winnerId }));
  const isComplete = rounds.every((round) => round.matches.every((roundMatch) => roundMatch.status !== "pending"));
  return { ...tournament, rounds, ...eventUpdate, status: isComplete ? "completed" : "in_progress", nextResultSequence: tournament.nextResultSequence + 1, updatedAt: completedAt, ...(isComplete ? { completedAt } : { completedAt: undefined }) };
}

export function withdrawTournamentParticipant(
  tournament: Tournament,
  participantId: string,
  withdrawnAt = new Date().toISOString(),
): Tournament {
  if (tournament.status === "completed") throw new Error("This tournament is already complete.");
  const participant = tournament.participants.find((item) => item.id === participantId);
  if (!participant) throw new Error("Participant not found.");
  if (participant.withdrawnAt) throw new Error("This participant has already withdrawn.");
  if (Number.isNaN(Date.parse(withdrawnAt))) throw new Error("Withdrawal timestamp is invalid.");

  const participants = tournament.participants.map((item) => item.id === participantId
    ? { ...item, withdrawnAt, attendanceStatus: "not-present" as const }
    : item);
  const rounds = tournament.rounds.map((round) => ({ ...round, matches: round.matches.map((match) => ({ ...match })) }));
  if ((tournament.withdrawalPolicy ?? "advance-opponent") === "advance-opponent") {
    rounds.forEach((round, roundIndex) => round.matches.forEach((match, matchIndex) => {
      if (match.status !== "pending" || (match.participantAId !== participantId && match.participantBId !== participantId)) return;
      const opponentId = match.participantAId === participantId ? match.participantBId : match.participantAId;
      if (!opponentId) {
        if (match.participantAId === participantId) delete match.participantAId;
        if (match.participantBId === participantId) delete match.participantBId;
        return;
      }
      match.status = "bye";
      match.winnerId = opponentId;
      if (match.participantAId === participantId) delete match.participantAId;
      if (match.participantBId === participantId) delete match.participantBId;
      match.completedAt = withdrawnAt;
      if (tournament.format !== "round-robin") advanceByeWinner(rounds, roundIndex, matchIndex, opponentId);
    }));
  }
  const eventUpdate = appendTournamentEvent(tournament, {
    type: "participant-withdrawn",
    participantId,
    createdAt: withdrawnAt,
  });
  const isComplete = rounds.every((round) => round.matches.every((match) => match.status !== "pending"));
  return { ...tournament, participants, rounds, ...eventUpdate, status: isComplete ? "completed" : "in_progress", updatedAt: withdrawnAt, ...(isComplete ? { completedAt: withdrawnAt } : { completedAt: undefined }) };
}

function validateMatchScore(score: number): void {
  if (!Number.isInteger(score) || score < 0 || score > 1000000) {
    throw new Error("Scores must be whole numbers from 0 to 1,000,000.");
  }
}

export function recordTournamentScore(
  tournament: Tournament,
  matchId: string,
  scoreA: number,
  scoreB: number,
  completedAt = new Date().toISOString(),
): Tournament {
  if (tournament.format !== "round-robin") throw new Error("Scores are currently available for round-robin matches only.");
  if (tournament.status === "completed") throw new Error("This tournament is already complete.");
  validateMatchScore(scoreA);
  validateMatchScore(scoreB);
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  const roundIndex = rounds.findIndex((round) => round.matches.some((match) => match.id === matchId));
  const match = rounds[roundIndex]?.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "pending") throw new Error("This match is not ready for a result.");
  if (!match.participantAId || !match.participantBId) throw new Error("Both participants must be decided before recording a score.");

  const winnerId = scoreA === scoreB ? undefined : scoreA > scoreB ? match.participantAId : match.participantBId;
  match.status = "complete";
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.resultMethod = "played";
  if (winnerId) match.winnerId = winnerId;
  match.completedAt = completedAt;
  match.resultSequence = tournament.nextResultSequence;
  const eventUpdate = appendTournamentEvent(tournament, createResultEvent(
    "result-recorded",
    rounds[roundIndex],
    match,
    completedAt,
    { scoreA, scoreB, resultMethod: "played", ...(winnerId ? { winnerId } : {}) },
  ));
  const isComplete = rounds.every((round) => round.matches.every((roundMatch) => roundMatch.status !== "pending"));
  return {
    ...tournament,
    rounds,
    ...eventUpdate,
    status: isComplete ? "completed" : "in_progress",
    nextResultSequence: tournament.nextResultSequence + 1,
    updatedAt: completedAt,
    ...(isComplete ? { completedAt } : { completedAt: undefined }),
  };
}

export function correctTournamentScore(
  tournament: Tournament,
  matchId: string,
  scoreA: number,
  scoreB: number,
  correctedAt = new Date().toISOString(),
): Tournament {
  if (tournament.format !== "round-robin") throw new Error("Scores are currently available for round-robin matches only.");
  validateMatchScore(scoreA);
  validateMatchScore(scoreB);
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  const roundIndex = rounds.findIndex((round) => round.matches.some((match) => match.id === matchId));
  const match = rounds[roundIndex]?.matches.find((item) => item.id === matchId);
  if (!match || match.status !== "complete") throw new Error("Only completed matches can have their score corrected.");
  if (!match.participantAId || !match.participantBId) throw new Error("Both participants must be decided before correcting a score.");
  if (match.scoreA === scoreA && match.scoreB === scoreB) return tournament;

  const previousScoreA = match.scoreA;
  const previousScoreB = match.scoreB;
  const previousWinnerId = match.winnerId;
  const previousResultMethod = match.resultMethod ?? "played";
  const previousForfeitingParticipantId = match.forfeitingParticipantId;
  const winnerId = scoreA === scoreB ? undefined : scoreA > scoreB ? match.participantAId : match.participantBId;
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  if (winnerId) match.winnerId = winnerId;
  else delete match.winnerId;
  match.resultMethod = "played";
  delete match.forfeitingParticipantId;
  match.completedAt = correctedAt;
  match.resultSequence = tournament.nextResultSequence;
  const eventUpdate = appendTournamentEvent(tournament, createResultEvent(
    "result-corrected",
    rounds[roundIndex],
    match,
    correctedAt,
    {
      scoreA,
      scoreB,
      previousScoreA,
      previousScoreB,
      ...(winnerId ? { winnerId } : {}),
      ...(previousWinnerId ? { previousWinnerId } : {}),
      resultMethod: "played",
      previousResultMethod,
      ...(previousForfeitingParticipantId ? { previousForfeitingParticipantId } : {}),
    },
  ));
  const isComplete = rounds.every((round) => round.matches.every((roundMatch) => roundMatch.status !== "pending"));
  return {
    ...tournament,
    rounds,
    ...eventUpdate,
    status: isComplete ? "completed" : "in_progress",
    nextResultSequence: tournament.nextResultSequence + 1,
    updatedAt: correctedAt,
    ...(isComplete ? { completedAt: correctedAt } : { completedAt: undefined }),
  };
}

function clearMatchResult(match: TournamentRound["matches"][number]): void {
  match.status = "pending";
  delete match.winnerId;
  delete match.completedAt;
  delete match.resultSequence;
  delete match.scoreA;
  delete match.scoreB;
  delete match.resultMethod;
  delete match.forfeitingParticipantId;
}

function removeAdvancedWinner(
  rounds: TournamentRound[],
  roundIndex: number,
  matchIndex: number,
  winnerId: string,
): void {
  const nextRound = rounds[roundIndex + 1];
  if (!nextRound) return;
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const nextMatch = nextRound.matches[nextMatchIndex];
  if (!nextMatch) return;
  const participantKey = matchIndex % 2 === 0 ? "participantAId" : "participantBId";
  if (nextMatch[participantKey] !== winnerId) return;
  delete nextMatch[participantKey];

  if (nextMatch.status === "complete" && nextMatch.winnerId) {
    invalidateCompletedMatch(rounds, roundIndex + 1, nextMatchIndex);
  }
}

function invalidateCompletedMatch(rounds: TournamentRound[], roundIndex: number, matchIndex: number): void {
  const match = rounds[roundIndex]?.matches[matchIndex];
  if (!match || match.status !== "complete" || !match.winnerId) return;
  const winnerId = match.winnerId;
  clearMatchResult(match);
  removeAdvancedWinner(rounds, roundIndex, matchIndex, winnerId);
}

export function getDependentCompletedMatchCount(tournament: Tournament, matchId: string): number {
  const roundIndex = tournament.rounds.findIndex((round) => round.matches.some((match) => match.id === matchId));
  const matchIndex = tournament.rounds[roundIndex]?.matches.findIndex((match) => match.id === matchId) ?? -1;
  if (roundIndex < 0 || matchIndex < 0 || tournament.format === "round-robin") return 0;

  let count = 0;
  let currentRoundIndex = roundIndex;
  let currentMatchIndex = matchIndex;
  while (currentRoundIndex + 1 < tournament.rounds.length) {
    currentMatchIndex = Math.floor(currentMatchIndex / 2);
    currentRoundIndex += 1;
    const dependent = tournament.rounds[currentRoundIndex].matches[currentMatchIndex];
    if (dependent.status !== "complete") break;
    count += 1;
  }
  return count;
}

export function correctTournamentWinner(
  tournament: Tournament,
  matchId: string,
  winnerId: string,
  correctedAt = new Date().toISOString(),
): Tournament {
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  const roundIndex = rounds.findIndex((round) => round.matches.some((match) => match.id === matchId));
  const matchIndex = rounds[roundIndex]?.matches.findIndex((item) => item.id === matchId) ?? -1;
  const match = rounds[roundIndex]?.matches[matchIndex];
  if (!match || match.status !== "complete") throw new Error("Only completed matches can be corrected.");
  if (!match.participantAId || !match.participantBId) throw new Error("Both participants must be decided before correcting a result.");
  if (winnerId !== match.participantAId && winnerId !== match.participantBId) {
    throw new Error("The winner must be one of the participants in this match.");
  }
  if (winnerId === match.winnerId) return tournament;

  const previousWinnerId = match.winnerId;
  const previousScoreA = match.scoreA;
  const previousScoreB = match.scoreB;
  const previousResultMethod = match.resultMethod ?? "played";
  const previousForfeitingParticipantId = match.forfeitingParticipantId;
  const invalidatedMatches: NonNullable<TournamentEvent["invalidatedMatches"]> = [];
  if (tournament.format !== "round-robin") {
    let dependentRoundIndex = roundIndex;
    let dependentMatchIndex = matchIndex;
    while (dependentRoundIndex + 1 < tournament.rounds.length) {
      dependentMatchIndex = Math.floor(dependentMatchIndex / 2);
      dependentRoundIndex += 1;
      const dependent = tournament.rounds[dependentRoundIndex].matches[dependentMatchIndex];
      if (dependent.status !== "complete" || !dependent.winnerId) break;
      invalidatedMatches.push({
        matchId: dependent.id,
        roundNumber: tournament.rounds[dependentRoundIndex].roundNumber,
        matchNumber: dependent.matchNumber,
        winnerId: dependent.winnerId,
      });
    }
  }

  if (tournament.format !== "round-robin") {
    const nextRound = rounds[roundIndex + 1];
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const destination = nextRound?.matches[nextMatchIndex];
    if (destination?.status === "complete") {
      invalidateCompletedMatch(rounds, roundIndex + 1, nextMatchIndex);
    }
    if (destination) {
      const participantKey = matchIndex % 2 === 0 ? "participantAId" : "participantBId";
      destination[participantKey] = winnerId;
    }
  }

  match.winnerId = winnerId;
  match.resultMethod = previousResultMethod;
  if (previousResultMethod === "forfeit") {
    match.forfeitingParticipantId = winnerId === match.participantAId ? match.participantBId : match.participantAId;
  } else {
    delete match.forfeitingParticipantId;
  }
  delete match.scoreA;
  delete match.scoreB;
  match.completedAt = correctedAt;
  match.resultSequence = tournament.nextResultSequence;
  const eventUpdate = appendTournamentEvent(tournament, createResultEvent(
    "result-corrected",
    rounds[roundIndex],
    match,
    correctedAt,
    {
      winnerId,
      previousWinnerId,
      resultMethod: match.resultMethod,
      previousResultMethod,
      ...(match.forfeitingParticipantId ? { forfeitingParticipantId: match.forfeitingParticipantId } : {}),
      ...(previousForfeitingParticipantId ? { previousForfeitingParticipantId } : {}),
      invalidatedMatches,
      ...(previousScoreA !== undefined ? { previousScoreA, previousScoreB } : {}),
    },
  ));

  if (tournament.format === "round-robin") {
    const isComplete = rounds.every((round) => round.matches.every((roundMatch) => roundMatch.status !== "pending"));
    return {
      ...tournament,
      rounds,
      ...eventUpdate,
      status: isComplete ? "completed" : "in_progress",
      nextResultSequence: tournament.nextResultSequence + 1,
      updatedAt: correctedAt,
      ...(isComplete ? { completedAt: correctedAt } : { completedAt: undefined }),
    };
  }

  const finalMatch = rounds.at(-1)?.matches[0];
  const isComplete = finalMatch?.status === "complete";
  return {
    ...tournament,
    rounds,
    ...eventUpdate,
    status: isComplete ? "completed" : "in_progress",
    nextResultSequence: tournament.nextResultSequence + 1,
    updatedAt: correctedAt,
    ...(isComplete ? { completedAt: correctedAt } : { completedAt: undefined }),
  };
}

export function undoLastTournamentResult(
  tournament: Tournament,
  updatedAt = new Date().toISOString(),
): Tournament {
  let latest: { roundIndex: number; matchIndex: number; sequence: number } | undefined;
  tournament.rounds.forEach((round, roundIndex) => round.matches.forEach((match, matchIndex) => {
    if (match.resultSequence !== undefined && (!latest || match.resultSequence > latest.sequence)) {
      latest = { roundIndex, matchIndex, sequence: match.resultSequence };
    }
  }));
  if (!latest) return tournament;

  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) => ({ ...match })),
  }));
  const match = rounds[latest.roundIndex].matches[latest.matchIndex];
  const previousWinnerId = match.winnerId;
  const previousScoreA = match.scoreA;
  const previousScoreB = match.scoreB;
  const previousResultMethod = match.resultMethod ?? "played";
  const previousForfeitingParticipantId = match.forfeitingParticipantId;
  const nextRound = rounds[latest.roundIndex + 1];
  if (tournament.format !== "round-robin" && nextRound && match.winnerId) {
    const matchIndex = match.matchNumber - 1;
    const destination = nextRound.matches[Math.floor(matchIndex / 2)];
    if (matchIndex % 2 === 0 && destination.participantAId === match.winnerId) delete destination.participantAId;
    if (matchIndex % 2 === 1 && destination.participantBId === match.winnerId) delete destination.participantBId;
  }
  match.status = "pending";
  delete match.winnerId;
  delete match.completedAt;
  delete match.resultSequence;
  delete match.scoreA;
  delete match.scoreB;
  delete match.resultMethod;
  delete match.forfeitingParticipantId;
  const eventUpdate = previousWinnerId || previousScoreA !== undefined
    ? appendTournamentEvent(tournament, createResultEvent(
      "result-undone",
      rounds[latest.roundIndex],
      match,
      updatedAt,
      {
        ...(previousWinnerId ? { previousWinnerId } : {}),
        previousResultMethod,
        ...(previousForfeitingParticipantId ? { previousForfeitingParticipantId } : {}),
        ...(previousScoreA !== undefined && previousScoreB !== undefined ? { previousScoreA, previousScoreB } : {}),
      },
    ))
    : { events: tournament.events, nextEventSequence: tournament.nextEventSequence };

  return {
    ...tournament,
    rounds,
    ...eventUpdate,
    status: "in_progress",
    nextResultSequence: latest.sequence,
    updatedAt,
    completedAt: undefined,
  };
}

export function getTournamentRoundLabel(
  roundNumber: number,
  totalRounds: number,
  format: TournamentFormat = "single-elimination",
): string {
  if (format === "round-robin") return `Round ${roundNumber}`;
  const roundsFromFinal = totalRounds - roundNumber;
  if (roundsFromFinal === 0) return "Final";
  if (roundsFromFinal === 1) return "Semifinals";
  if (roundsFromFinal === 2) return "Quarterfinals";
  return `Round ${roundNumber}`;
}

export function getTournamentStandings(tournament: Tournament): TournamentStanding[] {
  const scoring = tournament.scoring ?? defaultRoundRobinScoring;
  const matches = tournament.rounds.flatMap((round) => round.matches);
  const standings = new Map(tournament.participants.map((participant) => [participant.id, {
    rank: 0,
    participant,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    headToHeadPoints: 0,
  }]));

  for (const match of matches) {
    if (match.status !== "complete" || !match.participantAId || !match.participantBId) continue;
    const first = standings.get(match.participantAId);
    const second = standings.get(match.participantBId);
    if (!first || !second) continue;
    first.played += 1;
    second.played += 1;
    if (match.winnerId) {
      const winner = match.winnerId === match.participantAId ? first : second;
      const loser = winner === first ? second : first;
      winner.wins += 1;
      winner.points += scoring.winPoints;
      loser.losses += 1;
      loser.points += scoring.lossPoints;
    } else if (match.scoreA !== undefined && match.scoreA === match.scoreB) {
      first.draws += 1;
      second.draws += 1;
      first.points += scoring.drawPoints;
      second.points += scoring.drawPoints;
    }
  }

  const usesHeadToHead = (tournament.roundRobinTiebreaker ?? "seed") === "head-to-head";
  if (usesHeadToHead) {
    const tiedGroups = new Map<number, Set<string>>();
    for (const standing of standings.values()) {
      const group = tiedGroups.get(standing.points) ?? new Set<string>();
      group.add(standing.participant.id);
      tiedGroups.set(standing.points, group);
    }
    for (const match of matches) {
      if (match.status !== "complete" || !match.participantAId || !match.participantBId) continue;
      const first = standings.get(match.participantAId);
      const second = standings.get(match.participantBId);
      if (!first || !second || first.points !== second.points || (tiedGroups.get(first.points)?.size ?? 0) < 2) continue;
      if (match.winnerId) {
        const winner = match.winnerId === match.participantAId ? first : second;
        winner.headToHeadPoints += scoring.winPoints;
      } else if (match.scoreA !== undefined && match.scoreA === match.scoreB) {
        first.headToHeadPoints += scoring.drawPoints;
        second.headToHeadPoints += scoring.drawPoints;
      }
    }
  }

  const ordered = [...standings.values()].sort((left, right) =>
    right.points - left.points ||
    (usesHeadToHead ? right.headToHeadPoints - left.headToHeadPoints : right.wins - left.wins) ||
    left.participant.seed - right.participant.seed,
  );
  let rank = 0;
  ordered.forEach((standing, index) => {
    const previous = ordered[index - 1];
    if (!previous || standing.points !== previous.points ||
      (usesHeadToHead ? standing.headToHeadPoints !== previous.headToHeadPoints : standing.wins !== previous.wins)) rank = index + 1;
    standing.rank = rank;
  });
  return ordered;
}

export function getTournamentProgress(tournament: Tournament): { played: number; total: number; champion?: string } {
  const played = tournament.rounds.flatMap((round) => round.matches)
    .filter((match) => match.status === "complete").length;
  if (tournament.format === "round-robin") {
    const standings = getTournamentStandings(tournament);
    const top = standings[0];
    const next = standings[1];
    const champion = tournament.status === "completed" && top &&
      (!next || top.rank !== next.rank)
      ? top.participant.name
      : undefined;
    return {
      played,
      total: tournament.participants.length * (tournament.participants.length - 1) / 2,
      champion,
    };
  }
  const finalMatch = tournament.rounds.at(-1)?.matches[0];
  const champion = tournament.status === "completed"
    ? tournament.participants.find((participant) => participant.id === finalMatch?.winnerId)?.name
    : undefined;
  return { played, total: Math.max(0, tournament.participants.length - 1), champion };
}

export function hasUndoableTournamentResult(tournament: Tournament): boolean {
  return tournament.rounds.some((round) => round.matches.some((match) => match.resultSequence !== undefined));
}
