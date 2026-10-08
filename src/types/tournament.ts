export type TournamentSeeding = "entry-order" | "random" | "manual";
export type TournamentByePolicy = "automatic" | "manual";
export type TournamentWithdrawalPolicy = "advance-opponent" | "preserve-fixtures";
export type TournamentFormat = "single-elimination" | "double-elimination" | "round-robin";
export type RoundRobinTiebreaker = "seed" | "head-to-head";
export type RoundRobinScoring = {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
};
export type TournamentStatus = "in_progress" | "completed";
export type TournamentMatchStatus = "pending" | "complete" | "bye" | "locked";
export type TournamentBracket = "winners" | "losers" | "grand-final";
export type TournamentMatchSlot = "A" | "B";
export type TournamentParticipantAttendance = "expected" | "checked-in" | "not-present";
export type TournamentResultMethod = "played" | "forfeit";
export type TournamentBestOf = 1 | 3 | 5;
export type TournamentEventType = "result-recorded" | "result-corrected" | "result-undone" | "bye-confirmed" | "condition-drawn" | "winner-drawn" | "winner-draw-undone" | "participant-attendance-changed" | "participant-withdrawn";

export type TournamentDrawEntrant = {
  participantId: string;
  participantName: string;
  tickets: number;
  chance: number;
};

export type TournamentWinnerDraw = {
  entrants: TournamentDrawEntrant[];
  winnerIds: string[];
  winnerChances: number[];
  withoutReplacement: true;
};

export type TournamentConditionDraw = {
  wheelId: string;
  wheelTitle: string;
  optionId: string;
  optionLabel: string;
  optionColor: string;
  optionWeight: number;
  optionChance: number;
  createdAt: string;
};

export type TournamentEventMatch = {
  matchId: string;
  roundNumber: number;
  matchNumber: number;
  winnerId: string;
};

export type TournamentEvent = {
  id: string;
  sequence: number;
  type: TournamentEventType;
  matchId?: string;
  roundNumber?: number;
  matchNumber?: number;
  createdAt: string;
  winnerId?: string;
  previousWinnerId?: string;
  invalidatedMatches?: TournamentEventMatch[];
  conditionDraw?: TournamentConditionDraw;
  winnerDraw?: TournamentWinnerDraw;
  relatedEventId?: string;
  scoreA?: number;
  scoreB?: number;
  previousScoreA?: number;
  previousScoreB?: number;
  resultMethod?: TournamentResultMethod;
  previousResultMethod?: TournamentResultMethod;
  forfeitingParticipantId?: string;
  bracket?: TournamentBracket;
  bracketRound?: number;
  winnerNextMatchId?: string;
  winnerNextSlot?: TournamentMatchSlot;
  loserNextMatchId?: string;
  loserNextSlot?: TournamentMatchSlot;
  isGrandFinalReset?: boolean;
  previousForfeitingParticipantId?: string;
  seriesGameNumber?: number;
  previousSeriesGameWinnerId?: string;
  participantId?: string;
  previousAttendanceStatus?: TournamentParticipantAttendance;
  attendanceStatus?: TournamentParticipantAttendance;
};

export type TournamentParticipant = {
  id: string;
  name: string;
  seed: number;
  group?: string;
  role?: string;
  seat?: number;
  attendanceStatus?: TournamentParticipantAttendance;
  withdrawnAt?: string;
};

export type TournamentMatch = {
  id: string;
  matchNumber: number;
  status: TournamentMatchStatus;
  participantAId?: string;
  participantBId?: string;
  winnerId?: string;
  completedAt?: string;
  resultSequence?: number;
  conditionDraw?: TournamentConditionDraw;
  scoreA?: number;
  scoreB?: number;
  resultMethod?: TournamentResultMethod;
  forfeitingParticipantId?: string;
  bracket?: TournamentBracket;
  bracketRound?: number;
  winnerNextMatchId?: string;
  winnerNextSlot?: TournamentMatchSlot;
  loserNextMatchId?: string;
  loserNextSlot?: TournamentMatchSlot;
  isGrandFinalReset?: boolean;
  seriesWinsA?: number;
  seriesWinsB?: number;
  seriesGames?: Array<{
    gameNumber: number;
    winnerId: string;
    resultMethod: TournamentResultMethod;
    completedAt: string;
  }>;
};

export type TournamentRound = {
  roundNumber: number;
  label?: string;
  matches: TournamentMatch[];
};

export type Tournament = {
  id: string;
  title: string;
  format: TournamentFormat;
  roundRobinTiebreaker: RoundRobinTiebreaker;
  scoring?: RoundRobinScoring;
  seeding: TournamentSeeding;
  byePolicy: TournamentByePolicy;
  withdrawalPolicy: TournamentWithdrawalPolicy;
  thirdPlaceMatch: boolean;
  bestOf: TournamentBestOf;
  status: TournamentStatus;
  participants: TournamentParticipant[];
  rounds: TournamentRound[];
  nextResultSequence: number;
  events: TournamentEvent[];
  nextEventSequence: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  grandFinalMatchId?: string;
  grandFinalResetMatchId?: string;
};
