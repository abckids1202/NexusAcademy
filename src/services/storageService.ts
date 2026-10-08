import { createDemoData } from "../data/demoData";
import { defaultSettings } from "../data/settingsDefaults";
import type { WheelForgeData } from "../types";
import type { UserSettings } from "../types";
import { defaultRoundRobinScoring } from "../data/tournamentDefaults";
import { isValidRoundRobinScoring } from "../utils/tournamentLogic";

export const STORAGE_KEY = "wheelforge_data_v1";

export class StaleEditError extends Error {
  constructor(entity: string) {
    super(`This ${entity} changed in another tab. Reload the latest version before saving.`);
    this.name = "StaleEditError";
  }
}

export type StorageHealth =
  | { mode: "persistent" }
  | { mode: "memory"; reason: "unavailable" | "write-failed" | "corrupt" };

let storageHealth: StorageHealth = { mode: "persistent" };
let memoryData: WheelForgeData | undefined;
let preservedCorruptData: string | undefined;
let lastWarnedCorruptData: string | null = null;
let dataRevision = 0;
const dataListeners = new Set<() => void>();
let isListeningForStorage = false;

function notifyDataChanged(): void {
  dataRevision += 1;
  dataListeners.forEach((listener) => listener());
}

export function subscribeToData(listener: () => void): () => void {
  dataListeners.add(listener);
  if (!isListeningForStorage) {
    window.addEventListener("storage", handleStorageChange);
    isListeningForStorage = true;
    dataRevision += 1;
  }
  return () => {
    dataListeners.delete(listener);
    if (dataListeners.size === 0 && isListeningForStorage) {
      window.removeEventListener("storage", handleStorageChange);
      isListeningForStorage = false;
    }
  };
}

function handleStorageChange(event: StorageEvent): void {
  if (event.key === STORAGE_KEY || event.key === null) notifyDataChanged();
}

export function getDataRevision(): number {
  return dataRevision;
}

export function getStorageHealth(): StorageHealth {
  return storageHealth;
}

export function getPreservedCorruptData(): string | undefined {
  return preservedCorruptData;
}

export function createEmptyData(): WheelForgeData {
  return {
    version: 1,
    wheels: [],
    chains: [],
    spinResults: [],
    chainSessions: [],
    tournaments: [],
    participants: [],
    favoriteTemplateIds: [],
    recentTemplateIds: [],
    userTemplates: [],
    userTemplatePacks: [],
    favoritePackIds: [],
    recentPackIds: [],
    settings: { ...defaultSettings },
  };
}

function getLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeData(value: unknown): WheelForgeData {
  if (!value || typeof value !== "object") {
    return createEmptyData();
  }

  const data = value as Partial<WheelForgeData>;

  return {
    version: 1,
    wheels: Array.isArray(data.wheels) ? data.wheels : [],
    chains: Array.isArray(data.chains) ? data.chains : [],
    spinResults: Array.isArray(data.spinResults) ? data.spinResults : [],
    chainSessions: Array.isArray(data.chainSessions) ? data.chainSessions : [],
    tournaments: Array.isArray(data.tournaments)
      ? data.tournaments.map((value) => {
          if (!isRecord(value)) return value as WheelForgeData["tournaments"][number];
          const events = Array.isArray(value.events) ? value.events : [];
          const lastEventSequence = events.reduce((highest, event) =>
            isRecord(event) && typeof event.sequence === "number" ? Math.max(highest, event.sequence) : highest, 0);
          const nextEventSequence = typeof value.nextEventSequence === "number" && value.nextEventSequence > lastEventSequence
            ? value.nextEventSequence
            : lastEventSequence + 1;
          return {
            ...value,
            format: value.format ?? "single-elimination",
            roundRobinTiebreaker: value.roundRobinTiebreaker ?? "seed",
            byePolicy: value.byePolicy ?? "automatic",
            withdrawalPolicy: value.withdrawalPolicy ?? "advance-opponent",
            scoring: value.scoring ?? { ...defaultRoundRobinScoring },
            events,
            nextEventSequence,
          } as WheelForgeData["tournaments"][number];
        })
      : [],
    participants: Array.isArray(data.participants) ? data.participants : [],
    favoriteTemplateIds: Array.isArray(data.favoriteTemplateIds)
      ? data.favoriteTemplateIds.filter((id): id is string => typeof id === "string")
      : [],
    recentTemplateIds: Array.isArray(data.recentTemplateIds)
      ? data.recentTemplateIds.filter((id): id is string => typeof id === "string").slice(0, 8)
      : [],
    userTemplates: Array.isArray(data.userTemplates) ? data.userTemplates : [],
    userTemplatePacks: Array.isArray(data.userTemplatePacks) ? data.userTemplatePacks : [],
    favoritePackIds: Array.isArray(data.favoritePackIds)
      ? data.favoritePackIds.filter((id): id is string => typeof id === "string")
      : [],
    recentPackIds: Array.isArray(data.recentPackIds)
      ? data.recentPackIds.filter((id): id is string => typeof id === "string").slice(0, 8)
      : [],
    settings: {
      ...defaultSettings,
      ...(data.settings ?? {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOptionalString(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || typeof record[key] === "string";
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

const specialTypes = ["normal", "uncommon", "rare", "legendary", "jackpot", "danger", "mystery", "bonus"] as const;

function isValidSpinResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasDrawFields = "drawId" in value || "drawPosition" in value || "drawSize" in value;
  const validDrawFields = !hasDrawFields ||
    (typeof value.drawId === "string" && value.drawId.length > 0 &&
      typeof value.drawPosition === "number" && Number.isInteger(value.drawPosition) && value.drawPosition >= 1 &&
      typeof value.drawSize === "number" && Number.isInteger(value.drawSize) && value.drawSize >= value.drawPosition);
  return validDrawFields &&
    typeof value.id === "string" && typeof value.wheelId === "string" &&
    typeof value.wheelTitle === "string" && typeof value.optionId === "string" &&
    typeof value.resultLabel === "string" && typeof value.resultColor === "string" &&
    typeof value.resultWeight === "number" && Number.isFinite(value.resultWeight) &&
    typeof value.resultChance === "number" && Number.isFinite(value.resultChance) &&
    isOneOf(value.specialType, specialTypes) && typeof value.createdAt === "string" &&
    typeof value.spinIndex === "number" && Number.isFinite(value.spinIndex) &&
    (value.spinMode === undefined || isOneOf(value.spinMode, ["normal", "elimination", "no-repeat", "accumulation"] as const)) &&
    (value.removedOptionAfterSpin === undefined || typeof value.removedOptionAfterSpin === "boolean") &&
    hasOptionalString(value, "chainId") && hasOptionalString(value, "chainStepId");
}

function isValidWinnerDrawGroups(results: unknown[]): boolean {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const value of results) {
    if (!isRecord(value) || typeof value.drawId !== "string") continue;
    groups.set(value.drawId, [...(groups.get(value.drawId) ?? []), value]);
  }
  return [...groups.values()].every((group) => {
    const first = group[0];
    if (!first || typeof first.drawSize !== "number" || group.length !== first.drawSize) return false;
    const positions = new Set<number>();
    const labels = new Set<string>();
    for (const result of group) {
      if (result.drawSize !== first.drawSize || result.wheelId !== first.wheelId ||
        typeof result.drawPosition !== "number" || positions.has(result.drawPosition)) return false;
      positions.add(result.drawPosition);
      const label = typeof result.resultLabel === "string" ? result.resultLabel.trim().toLowerCase() : "";
      if (!label || labels.has(label)) return false;
      labels.add(label);
    }
    return positions.size === first.drawSize &&
      Array.from({ length: first.drawSize }, (_, index) => positions.has(index + 1)).every(Boolean);
  });
}

function isValidWheel(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" ||
    typeof value.description !== "string" || !Array.isArray(value.options) ||
    !isOneOf(value.visualMode, ["equal", "weighted"] as const) ||
    !isOneOf(value.spinMode, ["normal", "elimination", "no-repeat", "accumulation"] as const) ||
    typeof value.removeWinnerAfterSpin !== "boolean" ||
    typeof value.spinDurationMs !== "number" || !Number.isFinite(value.spinDurationMs) ||
    value.spinDurationMs <= 0 || typeof value.theme !== "string" ||
    typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return false;

  return value.options.every((option) => isRecord(option) &&
    typeof option.id === "string" && typeof option.label === "string" &&
    typeof option.color === "string" && typeof option.textColor === "string" &&
    typeof option.weight === "number" && Number.isFinite(option.weight) && option.weight > 0 &&
    typeof option.isActive === "boolean" &&
    (option.isRemoved === undefined || typeof option.isRemoved === "boolean") &&
    (option.isSpecial === undefined || typeof option.isSpecial === "boolean") &&
    isOneOf(option.specialType, specialTypes) &&
    typeof option.sortOrder === "number" && Number.isFinite(option.sortOrder));
}

function isValidChainStep(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.chainId !== "string" ||
    typeof value.title !== "string" || typeof value.wheelId !== "string" ||
    typeof value.order !== "number" || !Number.isFinite(value.order) ||
    typeof value.isRequired !== "boolean" || typeof value.autoSpinAfterPrevious !== "boolean" ||
    typeof value.delayBeforeSpinMs !== "number" || !Number.isFinite(value.delayBeforeSpinMs) ||
    value.delayBeforeSpinMs < 0 || !hasOptionalString(value, "dependsOnStepId") ||
    !hasOptionalString(value, "dependsOnResultValue") || !hasOptionalString(value, "fallbackWheelId")) return false;

  return value.conditionType === undefined || isOneOf(value.conditionType, ["always", "equals", "notEquals", "contains"] as const);
}

function isValidChain(value: unknown): boolean {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string" &&
    typeof value.description === "string" && typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" && Array.isArray(value.steps) &&
    value.steps.every(isValidChainStep);
}

function isValidUserTemplate(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim() ||
    typeof value.title !== "string" || !value.title.trim() ||
    typeof value.description !== "string" ||
    typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt)) ||
    typeof value.updatedAt !== "string" || Number.isNaN(Date.parse(value.updatedAt))) return false;

  if (value.kind === "wheel") return isValidWheel(value.wheel);
  if (value.kind !== "chain" || !isValidChain(value.chain) || !Array.isArray(value.wheels) ||
    !value.wheels.every(isValidWheel)) return false;

  const wheelIds = new Set(value.wheels.map((wheel) => (wheel as { id: string }).id));
  return (value.chain as { steps: Array<{ wheelId: string; fallbackWheelId?: string }> }).steps.every((step) =>
    wheelIds.has(step.wheelId) && (!step.fallbackWheelId || wheelIds.has(step.fallbackWheelId)));
}

function isValidChainSession(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.chainId !== "string" ||
    typeof value.chainTitle !== "string" || typeof value.startedAt !== "string" ||
    !hasOptionalString(value, "completedAt") || !Array.isArray(value.results)) return false;

  const validStatus = value.status === undefined || isOneOf(value.status, ["in_progress", "completed", "abandoned"] as const);
  return validStatus && value.results.every((item) => isRecord(item) &&
    typeof item.stepId === "string" && typeof item.stepTitle === "string" &&
    typeof item.wheelId === "string" && typeof item.wheelTitle === "string" &&
    isValidSpinResult(item.result));
}

function isValidTournamentEventMatch(value: unknown): boolean {
  return isRecord(value) && typeof value.matchId === "string" &&
    typeof value.roundNumber === "number" && Number.isInteger(value.roundNumber) &&
    typeof value.matchNumber === "number" && Number.isInteger(value.matchNumber) &&
    typeof value.winnerId === "string";
}

function hasValidOptionalScorePair(record: Record<string, unknown>, first: string, second: string): boolean {
  const hasFirst = first in record;
  const hasSecond = second in record;
  if (hasFirst !== hasSecond) return false;
  if (!hasFirst) return true;
  return [record[first], record[second]].every((score) =>
    typeof score === "number" && Number.isInteger(score) && score >= 0 && score <= 1000000);
}

function hasScorePair(record: Record<string, unknown>, first: string, second: string): boolean {
  return typeof record[first] === "number" && typeof record[second] === "number";
}

function isValidTournamentConditionDraw(value: unknown): boolean {
  return isRecord(value) && typeof value.wheelId === "string" && value.wheelId.trim().length > 0 &&
    typeof value.wheelTitle === "string" && value.wheelTitle.trim().length > 0 &&
    typeof value.optionId === "string" && value.optionId.trim().length > 0 &&
    typeof value.optionLabel === "string" && value.optionLabel.trim().length > 0 &&
    typeof value.optionColor === "string" &&
    typeof value.optionWeight === "number" && Number.isFinite(value.optionWeight) && value.optionWeight > 0 &&
    typeof value.optionChance === "number" && Number.isFinite(value.optionChance) && value.optionChance > 0 && value.optionChance <= 1 &&
    typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt));
}

function isValidTournamentWinnerDraw(value: unknown): boolean {
  if (!isRecord(value) || value.withoutReplacement !== true || !Array.isArray(value.entrants) ||
    !Array.isArray(value.winnerIds) || !Array.isArray(value.winnerChances) || value.entrants.length < 2 ||
    value.winnerIds.length < 1 || value.winnerIds.length > value.entrants.length ||
    value.winnerIds.length !== value.winnerChances.length) return false;

  const ids = new Set<string>();
  let remainingTickets = 0;
  for (const entrant of value.entrants) {
    if (!isRecord(entrant) || typeof entrant.participantId !== "string" || !entrant.participantId.trim() ||
      ids.has(entrant.participantId) || typeof entrant.participantName !== "string" || !entrant.participantName.trim() ||
      typeof entrant.tickets !== "number" || !Number.isInteger(entrant.tickets) || entrant.tickets < 1 || entrant.tickets > 10000 ||
      typeof entrant.chance !== "number" || !Number.isFinite(entrant.chance) || entrant.chance <= 0 || entrant.chance > 1) return false;
    ids.add(entrant.participantId);
    remainingTickets += entrant.tickets;
  }
  if (remainingTickets > 256 * 10000) return false;
  const initialTotal = remainingTickets;
  for (const entrant of value.entrants as Array<Record<string, unknown>>) {
    if (Math.abs(Number(entrant.chance) - Number(entrant.tickets) / initialTotal) > 1e-10) return false;
  }

  const remainingIds = new Set(ids);
  for (let index = 0; index < value.winnerIds.length; index += 1) {
    const winnerId = value.winnerIds[index];
    const entrant = (value.entrants as Array<Record<string, unknown>>).find((item) => item.participantId === winnerId);
    const chance = value.winnerChances[index];
    if (typeof winnerId !== "string" || !remainingIds.has(winnerId) || !entrant ||
      typeof chance !== "number" || !Number.isFinite(chance) || chance <= 0 || chance > 1 ||
      Math.abs(chance - Number(entrant.tickets) / remainingTickets) > 1e-10) return false;
    remainingIds.delete(winnerId);
    remainingTickets -= Number(entrant.tickets);
  }
  return true;
}

function isValidTournamentEvent(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" ||
    typeof value.sequence !== "number" || !Number.isInteger(value.sequence) || value.sequence < 1 ||
    !isOneOf(value.type, ["result-recorded", "result-corrected", "result-undone", "bye-confirmed", "condition-drawn", "winner-drawn", "winner-draw-undone", "participant-attendance-changed", "participant-withdrawn"] as const) ||
    typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt)) ||
    !hasOptionalString(value, "matchId") || !hasOptionalString(value, "relatedEventId") ||
    (value.roundNumber !== undefined && (typeof value.roundNumber !== "number" || !Number.isInteger(value.roundNumber))) ||
    (value.matchNumber !== undefined && (typeof value.matchNumber !== "number" || !Number.isInteger(value.matchNumber))) ||
    !hasOptionalString(value, "winnerId") || !hasOptionalString(value, "previousWinnerId") ||
    !hasOptionalString(value, "participantId") ||
    !hasOptionalString(value, "forfeitingParticipantId") || !hasOptionalString(value, "previousForfeitingParticipantId") ||
    (value.resultMethod !== undefined && !isOneOf(value.resultMethod, ["played", "forfeit"] as const)) ||
    (value.previousResultMethod !== undefined && !isOneOf(value.previousResultMethod, ["played", "forfeit"] as const)) ||
    !hasValidOptionalScorePair(value, "scoreA", "scoreB") ||
    !hasValidOptionalScorePair(value, "previousScoreA", "previousScoreB") ||
    (value.conditionDraw !== undefined && !isValidTournamentConditionDraw(value.conditionDraw)) ||
    (value.winnerDraw !== undefined && !isValidTournamentWinnerDraw(value.winnerDraw)) ||
    (value.invalidatedMatches !== undefined &&
      (!Array.isArray(value.invalidatedMatches) || !value.invalidatedMatches.every(isValidTournamentEventMatch)))) return false;

  const matchEvent = value.type === "result-recorded" || value.type === "result-corrected" ||
    value.type === "result-undone" || value.type === "bye-confirmed" || value.type === "condition-drawn";
  if (matchEvent && (typeof value.matchId !== "string" || !value.matchId.trim() ||
    typeof value.roundNumber !== "number" || value.roundNumber < 1 ||
    typeof value.matchNumber !== "number" || value.matchNumber < 1)) return false;
  if (!matchEvent && (value.matchId !== undefined || value.roundNumber !== undefined || value.matchNumber !== undefined)) return false;

  if (value.type === "result-recorded" && typeof value.winnerId !== "string" &&
    !(hasScorePair(value, "scoreA", "scoreB") && value.scoreA === value.scoreB)) return false;
  if (value.type === "result-corrected") {
    const validCurrent = typeof value.winnerId === "string" ||
      (hasScorePair(value, "scoreA", "scoreB") && value.scoreA === value.scoreB);
    const validPrevious = typeof value.previousWinnerId === "string" ||
      (hasScorePair(value, "previousScoreA", "previousScoreB") && value.previousScoreA === value.previousScoreB);
    if (!validCurrent || !validPrevious) return false;
  }
  if (value.type === "result-undone" && typeof value.previousWinnerId !== "string" && !hasScorePair(value, "previousScoreA", "previousScoreB")) return false;
  if (value.type === "bye-confirmed" && (typeof value.winnerId !== "string" || value.previousWinnerId !== undefined || value.resultMethod !== undefined || value.previousResultMethod !== undefined || value.conditionDraw !== undefined || value.winnerDraw !== undefined || value.invalidatedMatches !== undefined || hasScorePair(value, "scoreA", "scoreB"))) return false;
  const resultEvent = value.type === "result-recorded" || value.type === "result-corrected" || value.type === "result-undone";
  const currentForfeit = value.resultMethod === "forfeit";
  const previousForfeit = value.previousResultMethod === "forfeit";
  if (currentForfeit !== (typeof value.forfeitingParticipantId === "string") ||
    previousForfeit !== (typeof value.previousForfeitingParticipantId === "string")) return false;
  if (currentForfeit && (typeof value.winnerId !== "string" || hasScorePair(value, "scoreA", "scoreB"))) return false;
  if (!resultEvent && (value.resultMethod !== undefined || value.previousResultMethod !== undefined ||
    value.forfeitingParticipantId !== undefined || value.previousForfeitingParticipantId !== undefined)) return false;
  if (value.type === "result-recorded" && (value.previousResultMethod !== undefined || value.previousForfeitingParticipantId !== undefined)) return false;
  if (value.type === "result-undone" && (value.resultMethod !== undefined || value.forfeitingParticipantId !== undefined)) return false;
  if (value.type === "condition-drawn" && (!isValidTournamentConditionDraw(value.conditionDraw) ||
    value.winnerId !== undefined || value.previousWinnerId !== undefined || hasScorePair(value, "scoreA", "scoreB") ||
    value.winnerDraw !== undefined || value.relatedEventId !== undefined)) return false;
  if (value.type === "winner-drawn" && !isValidTournamentWinnerDraw(value.winnerDraw)) return false;
  if (value.type === "winner-draw-undone" && (typeof value.relatedEventId !== "string" || !value.relatedEventId.trim())) return false;
  if (value.type === "participant-attendance-changed" && (
    typeof value.participantId !== "string" || !value.participantId.trim() ||
    !isOneOf(value.previousAttendanceStatus, ["expected", "checked-in", "not-present"] as const) ||
    !isOneOf(value.attendanceStatus, ["expected", "checked-in", "not-present"] as const) ||
    value.previousAttendanceStatus === value.attendanceStatus
  )) return false;
  if (value.type === "participant-withdrawn" && (typeof value.participantId !== "string" || !value.participantId.trim())) return false;
  if (value.type !== "participant-attendance-changed" && value.type !== "participant-withdrawn" && (
    value.participantId !== undefined || value.previousAttendanceStatus !== undefined || value.attendanceStatus !== undefined
  )) return false;
  if ((value.type === "winner-drawn" || value.type === "winner-draw-undone") &&
    (value.winnerId !== undefined || value.previousWinnerId !== undefined || value.conditionDraw !== undefined ||
      hasScorePair(value, "scoreA", "scoreB") || hasScorePair(value, "previousScoreA", "previousScoreB") ||
      value.invalidatedMatches !== undefined)) return false;
  if (value.type !== "winner-drawn" && value.winnerDraw !== undefined) return false;
  if (value.type !== "winner-draw-undone" && value.relatedEventId !== undefined) return false;
  return true;
}

function isValidTournament(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" ||
    (value.format !== undefined && !isOneOf(value.format, ["single-elimination", "round-robin"] as const)) ||
    (value.roundRobinTiebreaker !== undefined && !isOneOf(value.roundRobinTiebreaker, ["seed", "head-to-head"] as const)) ||
    (value.byePolicy !== undefined && !isOneOf(value.byePolicy, ["automatic", "manual"] as const)) ||
    (value.withdrawalPolicy !== undefined && !isOneOf(value.withdrawalPolicy, ["advance-opponent", "preserve-fixtures"] as const)) ||
    (value.scoring !== undefined && !isValidRoundRobinScoring(value.scoring)) ||
    !isOneOf(value.seeding, ["entry-order", "random", "manual"] as const) ||
    !isOneOf(value.status, ["in_progress", "completed"] as const) ||
    typeof value.nextResultSequence !== "number" || !Number.isFinite(value.nextResultSequence) ||
    typeof value.createdAt !== "string" || typeof value.updatedAt !== "string" ||
    !hasOptionalString(value, "completedAt") ||
    (value.nextEventSequence !== undefined && (typeof value.nextEventSequence !== "number" || !Number.isInteger(value.nextEventSequence) || value.nextEventSequence < 1)) ||
    (value.events !== undefined && !Array.isArray(value.events)) || !Array.isArray(value.participants) ||
    !Array.isArray(value.rounds)) return false;

  const events = Array.isArray(value.events) ? value.events : [];
  if (!events.every(isValidTournamentEvent)) return false;
  if (events.some((event, index) => isRecord(event) && event.type === "winner-draw-undone" &&
    (!isRecord(events[index - 1]) || events[index - 1].type !== "winner-drawn" || events[index - 1].id !== event.relatedEventId))) return false;
  const tournamentFormat = value.format ?? "single-elimination";
  if (tournamentFormat !== "round-robin" && events.some((event) => isRecord(event) &&
    ((hasScorePair(event, "scoreA", "scoreB") && event.scoreA === event.scoreB && typeof event.winnerId !== "string") ||
      (hasScorePair(event, "previousScoreA", "previousScoreB") && event.previousScoreA === event.previousScoreB && typeof event.previousWinnerId !== "string")))) return false;
  const eventSequences = events.map((event) => (event as { sequence: number }).sequence);
  if (new Set(eventSequences).size !== eventSequences.length) return false;
  if (eventSequences.some((sequence, index) => index > 0 && sequence <= eventSequences[index - 1])) return false;
  if (eventSequences.length > 0 && typeof value.nextEventSequence === "number" &&
    value.nextEventSequence <= Math.max(...eventSequences)) return false;

  const validParticipants = value.participants.every((participant) => isRecord(participant) &&
    typeof participant.id === "string" && typeof participant.name === "string" &&
    typeof participant.seed === "number" && Number.isInteger(participant.seed) &&
    hasOptionalString(participant, "group") && hasOptionalString(participant, "role") && hasOptionalString(participant, "withdrawnAt") &&
    (participant.seat === undefined || (typeof participant.seat === "number" && Number.isInteger(participant.seat) && participant.seat > 0)) &&
    (participant.attendanceStatus === undefined || isOneOf(participant.attendanceStatus, ["expected", "checked-in", "not-present"] as const)));
  const participantIds = new Set(value.participants.filter(isRecord).map((participant) => participant.id));
  if (events.some((event) => isRecord(event) && (event.type === "participant-attendance-changed" || event.type === "participant-withdrawn") &&
    (typeof event.participantId !== "string" || !participantIds.has(event.participantId)))) return false;
  if (events.some((event) => isRecord(event) &&
    ((typeof event.forfeitingParticipantId === "string" && !participantIds.has(event.forfeitingParticipantId)) ||
      (typeof event.previousForfeitingParticipantId === "string" && !participantIds.has(event.previousForfeitingParticipantId))))) return false;
  const validRounds = value.rounds.every((round) => isRecord(round) &&
    typeof round.roundNumber === "number" && Number.isInteger(round.roundNumber) &&
    Array.isArray(round.matches) && round.matches.every((match) => {
      if (!isRecord(match) || typeof match.id !== "string" ||
        typeof match.matchNumber !== "number" || !Number.isInteger(match.matchNumber) ||
        !isOneOf(match.status, ["pending", "complete", "bye"] as const) ||
        !hasOptionalString(match, "participantAId") || !hasOptionalString(match, "participantBId") ||
        !hasOptionalString(match, "winnerId") || !hasOptionalString(match, "completedAt") ||
        !hasOptionalString(match, "forfeitingParticipantId") ||
        (match.resultMethod !== undefined && !isOneOf(match.resultMethod, ["played", "forfeit"] as const)) ||
        !hasValidOptionalScorePair(match, "scoreA", "scoreB") ||
        (match.conditionDraw !== undefined && !isValidTournamentConditionDraw(match.conditionDraw))) return false;
      const validSequence = match.resultSequence === undefined ||
        (typeof match.resultSequence === "number" && Number.isInteger(match.resultSequence));
      const hasWinner = typeof match.winnerId === "string";
      const hasScores = hasScorePair(match, "scoreA", "scoreB");
      const participants = [match.participantAId, match.participantBId].filter((id) => typeof id === "string");
      const isForfeit = match.resultMethod === "forfeit";
      const validForfeit = isForfeit
        ? typeof match.forfeitingParticipantId === "string" && participants.includes(match.forfeitingParticipantId) &&
          match.forfeitingParticipantId !== match.winnerId && hasWinner && !hasScores
        : match.forfeitingParticipantId === undefined;
      return validSequence && (
        match.status === "pending" ? !hasWinner && !hasScores && match.resultMethod === undefined && match.forfeitingParticipantId === undefined
          : match.status === "bye" ? hasWinner && !hasScores && match.resultMethod === undefined && match.forfeitingParticipantId === undefined && participants.length === 1 && participants[0] === match.winnerId
            : validForfeit && participants.length === 2 && (hasWinner
              ? participants.includes(match.winnerId as string) && (!hasScores ||
                (match.winnerId === match.participantAId ? Number(match.scoreA) > Number(match.scoreB) : Number(match.scoreB) > Number(match.scoreA)))
              : tournamentFormat === "round-robin" && hasScores && match.scoreA === match.scoreB)
      );
    }));

  return validParticipants && validRounds;
}

function isValidParticipantProfile(value: unknown): boolean {
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0 &&
    typeof value.name === "string" && value.name.trim().length > 0 &&
    hasOptionalString(value, "email") && hasOptionalString(value, "group") && hasOptionalString(value, "notes") &&
    isOneOf(value.status, ["active", "archived"] as const) &&
    typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

function isValidSettings(value: Record<string, unknown>): boolean {
  const validTheme = value.theme === undefined || isOneOf(value.theme, ["dark", "light", "system"] as const);
  const validVisualMode = value.defaultVisualMode === undefined || isOneOf(value.defaultVisualMode, ["equal", "weighted"] as const);
  const validSpinMode = value.defaultSpinMode === undefined || isOneOf(value.defaultSpinMode, ["normal", "elimination", "no-repeat", "accumulation"] as const);
  const validDuration = value.defaultSpinDurationMs === undefined ||
    (typeof value.defaultSpinDurationMs === "number" && Number.isFinite(value.defaultSpinDurationMs) && value.defaultSpinDurationMs > 0);
  const booleanKeys = ["reducedMotion", "animationsEnabled", "confettiEnabled", "soundsEnabled"];

  return validTheme && validVisualMode && validSpinMode && validDuration &&
    booleanKeys.every((key) => value[key] === undefined || typeof value[key] === "boolean");
}

function isValidTemplatePack(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" ||
    typeof value.description !== "string" || !isOneOf(value.category, ["classroom", "giveaway", "creative", "game", "tournament"] as const) ||
    !Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string") ||
    typeof value.version !== "number" || value.source !== "user" || typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" || !Array.isArray(value.wheels) || !Array.isArray(value.chains)) return false;
  const validWheelTemplate = (item: unknown) => isRecord(item) && typeof item.id === "string" &&
    typeof item.title === "string" && typeof item.description === "string" && isRecord(item.wheel) &&
    Array.isArray(item.wheel.options) && item.wheel.options.length >= 2;
  const validChainTemplate = (item: unknown) => isRecord(item) && typeof item.id === "string" &&
    typeof item.title === "string" && typeof item.description === "string" && Array.isArray(item.steps) &&
    item.steps.every((step) => isRecord(step) && typeof step.title === "string" && typeof step.wheelTemplateId === "string");
  return value.wheels.every(validWheelTemplate) && value.chains.every(validChainTemplate);
}

function isValidImport(value: unknown): value is WheelForgeData {
  if (!isRecord(value) || value.version !== 1) return false;
  if (!Array.isArray(value.wheels) || !Array.isArray(value.chains) ||
    !Array.isArray(value.spinResults) || !Array.isArray(value.chainSessions) ||
    (value.tournaments !== undefined && !Array.isArray(value.tournaments)) ||
    (value.participants !== undefined && (!Array.isArray(value.participants) || !value.participants.every(isValidParticipantProfile))) ||
    (value.favoriteTemplateIds !== undefined && (!Array.isArray(value.favoriteTemplateIds) ||
      !value.favoriteTemplateIds.every((id) => typeof id === "string"))) ||
    (value.recentTemplateIds !== undefined && (!Array.isArray(value.recentTemplateIds) ||
      !value.recentTemplateIds.every((id) => typeof id === "string"))) ||
    (value.userTemplates !== undefined && (!Array.isArray(value.userTemplates) ||
      !value.userTemplates.every(isValidUserTemplate))) ||
    (value.userTemplatePacks !== undefined && (!Array.isArray(value.userTemplatePacks) ||
      !value.userTemplatePacks.every(isValidTemplatePack))) ||
    (value.favoritePackIds !== undefined && (!Array.isArray(value.favoritePackIds) ||
      !value.favoritePackIds.every((id) => typeof id === "string"))) ||
    (value.recentPackIds !== undefined && (!Array.isArray(value.recentPackIds) ||
      !value.recentPackIds.every((id) => typeof id === "string"))) ||
    !isRecord(value.settings)) return false;

  return value.wheels.every(isValidWheel) && value.chains.every(isValidChain) &&
    value.spinResults.every(isValidSpinResult) && isValidWinnerDrawGroups(value.spinResults) &&
    value.chainSessions.every(isValidChainSession) &&
    (value.tournaments === undefined || value.tournaments.every(isValidTournament)) &&
    (value.participants === undefined || value.participants.every(isValidParticipantProfile)) &&
    isValidSettings(value.settings);
}

export function loadData(): WheelForgeData {
  const storage = getLocalStorage();
  if (!storage) {
    storageHealth = { mode: "memory", reason: "unavailable" };
    return memoryData ?? (memoryData = createDemoData());
  }

  if (storageHealth.mode === "memory" && storageHealth.reason === "write-failed" && memoryData) {
    return memoryData;
  }

  let rawData: string | null;
  try {
    rawData = storage.getItem(STORAGE_KEY);
  } catch {
    storageHealth = { mode: "memory", reason: "unavailable" };
    return memoryData ?? (memoryData = createDemoData());
  }

  if (rawData === null) {
    preservedCorruptData = undefined;
    lastWarnedCorruptData = null;
    storageHealth = { mode: "persistent" };
    const seededData = createDemoData();
    saveData(seededData);
    return seededData;
  }

  try {
    const parsed: unknown = JSON.parse(rawData);
    if (!isValidImport(parsed)) throw new Error("Stored workspace does not match a supported WheelForge schema.");
    const normalized = normalizeData(parsed);
    if (!isValidImport(normalized)) throw new Error("Stored workspace migration produced an invalid WheelForge schema.");
    memoryData = normalized;
    storageHealth = { mode: "persistent" };
    preservedCorruptData = undefined;
    lastWarnedCorruptData = null;
    return memoryData;
  } catch (error) {
    preservedCorruptData = rawData;
    if (lastWarnedCorruptData !== rawData) {
      console.warn("WheelForge storage could not be validated. Preserving the saved workspace for recovery.", error);
      lastWarnedCorruptData = rawData;
    }
    storageHealth = { mode: "memory", reason: "corrupt" };
    return memoryData ?? (memoryData = createEmptyData());
  }
}

function persistData(data: WheelForgeData, overwriteCorruptData = false): WheelForgeData {
  const normalizedData = normalizeData(data);
  memoryData = normalizedData;
  const storage = getLocalStorage();

  if (!storage) {
    storageHealth = { mode: "memory", reason: "unavailable" };
  } else if (preservedCorruptData !== undefined && !overwriteCorruptData) {
    // Preserve the unreadable backup until the user imports or explicitly resets data.
  } else {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizedData));
      storageHealth = { mode: "persistent" };
      if (overwriteCorruptData) preservedCorruptData = undefined;
    } catch {
      storageHealth = { mode: "memory", reason: "write-failed" };
    }
  }

  notifyDataChanged();
  return normalizedData;
}

export function saveData(data: WheelForgeData): WheelForgeData {
  return persistData(data);
}

export function saveSettingsPatch(updates: Partial<UserSettings>): UserSettings {
  const data = loadData();
  const settings = { ...data.settings, ...updates };
  persistData({ ...data, settings });
  return settings;
}

export function resetData(): WheelForgeData {
  const emptyData = createEmptyData();
  return persistData(emptyData, true);
}

export function exportData(): string {
  return JSON.stringify(loadData(), null, 2);
}

export function parseImportData(json: string): WheelForgeData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error("Invalid or unsupported WheelForge backup.");
  }
  if (!isValidImport(parsed)) {
    throw new Error("Invalid or unsupported WheelForge backup.");
  }
  return normalizeData(parsed);
}

export type ImportReviewSummary = {
  counts: Record<"wheels" | "chains" | "spinResults" | "chainSessions" | "tournaments" | "participants" | "userTemplates" | "userTemplatePacks", { current: number; incoming: number; new: number }>;
  idConflicts: number;
};

export function getImportReviewSummary(current: WheelForgeData, input: string | WheelForgeData): ImportReviewSummary {
  const incoming = typeof input === "string" ? parseImportData(input) : parseImportData(JSON.stringify(input));
  const keys = ["wheels", "chains", "spinResults", "chainSessions", "tournaments", "participants", "userTemplates", "userTemplatePacks"] as const;
  const counts = Object.fromEntries(keys.map((key) => {
    const currentIds = new Set(current[key].map((item) => item.id));
    const incomingIds = new Set(incoming[key].map((item) => item.id));
    const overlapping = [...incomingIds].filter((id) => currentIds.has(id)).length;
    return [key, { current: current[key].length, incoming: incoming[key].length, new: incomingIds.size - overlapping }];
  })) as ImportReviewSummary["counts"];
  return {
    counts,
    idConflicts: keys.reduce((total, key) => total + [...new Set(incoming[key].map((item) => item.id))]
      .filter((id) => current[key].some((item) => item.id === id)).length, 0),
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const existingIds = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => {
    if (existingIds.has(item.id)) return false;
    existingIds.add(item.id);
    return true;
  })];
}

export function mergeImportData(current: WheelForgeData, input: string | WheelForgeData): WheelForgeData {
  const incoming = typeof input === "string" ? parseImportData(input) : parseImportData(JSON.stringify(input));
  const normalizedCurrent = normalizeData(current);
  return normalizeData({
    ...normalizedCurrent,
    wheels: mergeById(normalizedCurrent.wheels, incoming.wheels),
    chains: mergeById(normalizedCurrent.chains, incoming.chains),
    spinResults: mergeById(normalizedCurrent.spinResults, incoming.spinResults),
    chainSessions: mergeById(normalizedCurrent.chainSessions, incoming.chainSessions),
    tournaments: mergeById(normalizedCurrent.tournaments, incoming.tournaments),
    participants: mergeById(normalizedCurrent.participants, incoming.participants),
    userTemplates: mergeById(normalizedCurrent.userTemplates, incoming.userTemplates),
    userTemplatePacks: mergeById(normalizedCurrent.userTemplatePacks, incoming.userTemplatePacks),
    favoriteTemplateIds: [...new Set([...normalizedCurrent.favoriteTemplateIds, ...incoming.favoriteTemplateIds])],
    recentTemplateIds: [...new Set([...incoming.recentTemplateIds, ...normalizedCurrent.recentTemplateIds])].slice(0, 8),
    favoritePackIds: [...new Set([...normalizedCurrent.favoritePackIds, ...incoming.favoritePackIds])],
    recentPackIds: [...new Set([...incoming.recentPackIds, ...normalizedCurrent.recentPackIds])].slice(0, 8),
    settings: normalizedCurrent.settings,
  });
}

export function importData(input: string | WheelForgeData): WheelForgeData {
  const data = typeof input === "string" ? parseImportData(input) : input;
  if (!isValidImport(data)) {
    throw new Error("Invalid or unsupported WheelForge backup.");
  }
  return persistData(normalizeData(data), true);
}

export function seedDemoData(): WheelForgeData {
  const demoData = createDemoData();

  return persistData(demoData);
}
