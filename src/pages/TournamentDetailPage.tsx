import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Download, FileSpreadsheet, MonitorPlay, Pencil, Printer, Undo2 } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import { TournamentConditionSpinner } from "../components/tournament/TournamentConditionSpinner";
import { TournamentWinnerDrawPanel } from "../components/tournament/TournamentWinnerDrawPanel";
import { correctTournamentMatchScore, correctTournamentMatchWinner, drawTournamentWinner, recordTournamentMatchBye, recordTournamentMatchCondition, recordTournamentMatchScore, recordTournamentMatchWinner, undoTournamentResult, undoTournamentWinnerDraw, updateTournamentSetup, withdrawTournamentParticipantFromMatch } from "../services/tournamentService";
import type { RoundRobinScoring, Tournament, TournamentConditionDraw, TournamentEvent } from "../types";
import { useWheels } from "../hooks/useWheels";
import { useTournaments } from "../hooks/useTournaments";
import { canEditTournamentSetup, getDependentCompletedMatchCount, getTournamentProgress, getTournamentRoundLabel, getTournamentStandings, hasUndoableTournamentResult, isValidRoundRobinScoring, MAX_ROUND_ROBIN_PARTICIPANTS, MAX_TOURNAMENT_PARTICIPANTS } from "../utils/tournamentLogic";
import { parseParticipantNames } from "../utils/participantImport";
import { defaultRoundRobinScoring } from "../data/tournamentDefaults";
import { buildTournamentCsv, getTournamentCsvPreview } from "../utils/tournamentExport";

function getTournamentSummary(tournament: Tournament): string {
  const participants = new Map(tournament.participants.map((participant) => [participant.id, participant.name]));
  const isRoundRobin = tournament.format === "round-robin";
  const lines = [
    tournament.title,
    isRoundRobin
      ? `Round robin · ${tournament.roundRobinTiebreaker === "head-to-head" ? "head-to-head mini-table tiebreak" : "seed-order tiebreak"} · ${tournament.scoring?.winPoints ?? 3}/${tournament.scoring?.drawPoints ?? 1}/${tournament.scoring?.lossPoints ?? 0} win/draw/loss points`
      : "Single elimination",
    "",
  ];
  for (const round of tournament.rounds) {
    lines.push(`${getTournamentRoundLabel(round.roundNumber, tournament.rounds.length, tournament.format)}:`);
    for (const match of round.matches) {
      const first = match.participantAId ? participants.get(match.participantAId) : "TBD";
      const second = match.participantBId ? participants.get(match.participantBId) : "TBD";
      const winner = match.winnerId ? participants.get(match.winnerId) : undefined;
      if (match.status === "bye") lines.push(`Bye: ${first}`);
      else {
        const result = match.status !== "complete" ? "Pending"
          : match.resultMethod === "forfeit"
            ? `Forfeit: ${participants.get(match.forfeitingParticipantId ?? "") ?? "Participant"} forfeited | Winner: ${winner ?? "Unknown participant"}`
          : match.scoreA !== undefined && match.scoreB !== undefined
            ? `${match.scoreA}-${match.scoreB}${winner ? ` | Winner: ${winner}` : " | Draw"}`
            : winner ? `Winner: ${winner}` : "Complete";
        lines.push(`Match ${match.matchNumber}: ${first} vs ${second} | ${result}`);
        if (match.conditionDraw) lines.push(`  Condition: ${match.conditionDraw.optionLabel} (${match.conditionDraw.wheelTitle}, ${Math.round(match.conditionDraw.optionChance * 1000) / 10}%)`);
      }
    }
    lines.push("");
  }
  const progress = getTournamentProgress(tournament);
  if (isRoundRobin) {
    lines.push("Standings:");
    for (const standing of getTournamentStandings(tournament)) {
      lines.push(`${standing.rank}. ${standing.participant.name} | ${standing.points} pts | ${standing.wins}W-${standing.losses}L${tournament.roundRobinTiebreaker === "head-to-head" ? ` | ${standing.headToHeadPoints} H2H pts` : ""}`);
    }
  }
  if (progress.champion) lines.push(`Champion: ${progress.champion}`);
  else if (tournament.status === "completed" && isRoundRobin) lines.push("Top place: tied");
  if (tournament.events.length > 0) {
    lines.push("", "Activity history:");
    for (const event of tournament.events) lines.push(`#${event.sequence} ${describeTournamentEvent(event, participants, tournament.events)}`);
  }
  return lines.join("\n");
}

function describeTournamentEvent(event: TournamentEvent, participants: Map<string, string>, events: TournamentEvent[] = []): string {
  if (event.type === "participant-attendance-changed") {
    const participant = participants.get(event.participantId ?? "") ?? "Unknown participant";
    const labels = { expected: "Expected", "checked-in": "Checked in", "not-present": "Not present" };
    return `${participant}: attendance changed from ${labels[event.previousAttendanceStatus ?? "expected"]} to ${labels[event.attendanceStatus ?? "expected"]}. No match result or pairing changed.`;
  }
  if (event.type === "participant-withdrawn") {
    return `${participants.get(event.participantId ?? "") ?? "Unknown participant"} withdrew from the tournament.`;
  }
  if (event.type === "winner-drawn" && event.winnerDraw) {
    const winners = event.winnerDraw.winnerIds.map((winnerId, index) => {
      const entrant = event.winnerDraw!.entrants.find((item) => item.participantId === winnerId);
      return `${entrant?.participantName ?? "Unknown participant"} (${(event.winnerDraw!.winnerChances[index] * 100).toFixed(2)}% at pick)`;
    });
    return `Chance-based draw, not a match result: selected ${winners.join(", ")} from ${event.winnerDraw.entrants.length} entrants and ${event.winnerDraw.entrants.reduce((sum, entrant) => sum + entrant.tickets, 0)} tickets.`;
  }
  if (event.type === "winner-draw-undone") {
    const target = events.find((item) => item.id === event.relatedEventId);
    return `Undid chance draw #${target?.sequence ?? "?"}; the original draw remains in history.`;
  }
  const matchLabel = event.roundNumber !== undefined && event.matchNumber !== undefined
    ? `Round ${event.roundNumber}, match ${event.matchNumber}` : "Tournament";
  if (event.type === "condition-drawn" && event.conditionDraw) {
    return `${matchLabel}: drew ${event.conditionDraw.optionLabel} from ${event.conditionDraw.wheelTitle} as the match condition. This did not decide the winner.`;
  }
  const winner = event.winnerId ? participants.get(event.winnerId) ?? "Unknown participant" : undefined;
  const previousWinner = event.previousWinnerId ? participants.get(event.previousWinnerId) ?? "Unknown participant" : undefined;
  const forfeitingParticipant = event.forfeitingParticipantId ? participants.get(event.forfeitingParticipantId) ?? "Unknown participant" : undefined;
  const previousForfeitingParticipant = event.previousForfeitingParticipantId ? participants.get(event.previousForfeitingParticipantId) ?? "Unknown participant" : undefined;
  if (event.type === "result-recorded" && event.resultMethod === "forfeit") {
    return `${matchLabel}: ${forfeitingParticipant} forfeited; ${winner} was awarded the win.`;
  }
  if (event.type === "bye-confirmed") return `${matchLabel}: confirmed ${winner} as advancing on a bye.`;
  if (event.type === "result-recorded") return event.scoreA !== undefined && event.scoreB !== undefined
    ? `${matchLabel}: recorded ${event.scoreA}-${event.scoreB}${winner ? `, ${winner} won` : ", a draw"}.`
    : `${matchLabel}: recorded ${winner} as the winner.`;
  if (event.type === "result-corrected") {
    const reopened = event.invalidatedMatches?.map((match) =>
      `Round ${match.roundNumber}, match ${match.matchNumber} (previous winner: ${participants.get(match.winnerId) ?? "Unknown participant"})`,
    ) ?? [];
    const previousResult = event.previousScoreA !== undefined && event.previousScoreB !== undefined
      ? `${event.previousScoreA}-${event.previousScoreB}`
      : previousWinner;
    const nextResult = event.scoreA !== undefined && event.scoreB !== undefined
      ? `${event.scoreA}-${event.scoreB}${winner ? ` (${winner} won)` : " (draw)"}`
      : winner;
    const previousDescription = event.previousResultMethod === "forfeit"
      ? `forfeit (${previousForfeitingParticipant} forfeited)` : previousResult;
    const nextDescription = event.resultMethod === "forfeit"
      ? `forfeit (${forfeitingParticipant} forfeited; ${winner} wins)` : nextResult;
    return `${matchLabel}: corrected ${previousDescription} to ${nextDescription}.${reopened.length ? ` Reopened: ${reopened.join("; ")}.` : ""}`;
  }
  if (event.type === "result-undone" && event.previousResultMethod === "forfeit") {
    return `${matchLabel}: undid the forfeit; ${previousForfeitingParticipant} had forfeited.`;
  }
  const undoneResult = event.previousScoreA !== undefined && event.previousScoreB !== undefined
    ? `${event.previousScoreA}-${event.previousScoreB}`
    : previousWinner;
  return `${matchLabel}: undid the result ${undoneResult}.`;
}

export function TournamentDetailPage() {
  const { tournamentId } = useParams();
  const tournaments = useTournaments();
  const tournament = tournaments.find((item) => item.id === tournamentId);
  const [message, setMessage] = useState("");
  const [correctingMatchId, setCorrectingMatchId] = useState<string | null>(null);
  const [isEditingSetup, setIsEditingSetup] = useState(false);
  const [setupTitle, setSetupTitle] = useState("");
  const [setupParticipantText, setSetupParticipantText] = useState("");
  const [setupSeeding, setSetupSeeding] = useState<Tournament["seeding"]>("entry-order");
  const [setupFormat, setSetupFormat] = useState<Tournament["format"]>("single-elimination");
  const [setupTiebreaker, setSetupTiebreaker] = useState<Tournament["roundRobinTiebreaker"]>("seed");
  const [setupScoring, setSetupScoring] = useState<RoundRobinScoring>(() => ({ ...defaultRoundRobinScoring }));
  const [setupBaseUpdatedAt, setSetupBaseUpdatedAt] = useState<string>();
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { a: string; b: string }>>({});
  const [setupError, setSetupError] = useState("");
  const [conditionMatchId, setConditionMatchId] = useState<string | null>(null);
  const [isCsvExportOpen, setIsCsvExportOpen] = useState(false);
  const [anonymizeCsvNames, setAnonymizeCsvNames] = useState(false);
  const [includeCsvActivity, setIncludeCsvActivity] = useState(false);
  const wheels = useWheels();
  const participantsById = useMemo(() => new Map(tournament?.participants.map((participant) => [participant.id, participant]) ?? []), [tournament]);
  const participantNamesById = useMemo(() => new Map(tournament?.participants.map((participant) => [participant.id, participant.name]) ?? []), [tournament]);
  const progress = tournament ? getTournamentProgress(tournament) : undefined;
  const standings = useMemo(() => tournament?.format === "round-robin" ? getTournamentStandings(tournament) : [], [tournament]);
  const tiedTop = Boolean(standings[0] && standings[1] && standings[0].rank === standings[1].rank);
  const currentLeader = tiedTop ? "Tie" : standings[0]?.participant.name ?? "—";
  const parsedSetupParticipants = useMemo(() => parseParticipantNames(setupParticipantText), [setupParticipantText]);
  const setupParticipantLimit = setupFormat === "round-robin" ? MAX_ROUND_ROBIN_PARTICIPANTS : MAX_TOURNAMENT_PARTICIPANTS;
  const hasStaleSetup = isEditingSetup && setupBaseUpdatedAt !== undefined && tournament?.updatedAt !== setupBaseUpdatedAt;
  const csvPreview = tournament ? getTournamentCsvPreview(tournament, {
    anonymizeParticipantNames: anonymizeCsvNames,
    includeActivityHistory: includeCsvActivity,
  }) : undefined;

  async function copySchedule() {
    if (!tournament) return;
    try {
      await navigator.clipboard.writeText(getTournamentSummary(tournament));
      setMessage("Tournament copied.");
    } catch {
      setMessage("Could not access the clipboard in this browser.");
    }
  }

  function exportSchedule() {
    if (!tournament) return;
    const blob = new Blob([getTournamentSummary(tournament)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    const suffix = tournament.format === "round-robin" ? "schedule" : "bracket";
    anchor.download = `${tournament.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "tournament"}-${suffix}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Tournament exported.");
  }

  function exportCsv() {
    if (!tournament) return;
    const csv = buildTournamentCsv(tournament, {
      anonymizeParticipantNames: anonymizeCsvNames,
      includeActivityHistory: includeCsvActivity,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tournament.title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "tournament"}-results.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setIsCsvExportOpen(false);
    setMessage("Tournament CSV downloaded.");
  }

  function chooseWinner(matchId: string, winnerId: string) {
    if (!tournament) return;
    try {
      recordTournamentMatchWinner(tournament.id, matchId, winnerId);
      setConditionMatchId(null);
      setMessage("");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not record that result.");
    }
  }

  function confirmBye(matchId: string, participantName: string) {
    if (!tournament) return;
    try {
      recordTournamentMatchBye(tournament.id, matchId);
      setMessage(`${participantName} confirmed as advancing on a bye.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not confirm the bye.");
    }
  }

  function withdrawParticipant(participantId: string, participantName: string) {
    if (!tournament || !window.confirm(`Withdraw ${participantName} from this tournament? ${tournament.withdrawalPolicy === "advance-opponent" ? "Pending opponents will advance where possible." : "Pending fixtures will remain unchanged."}`)) return;
    try {
      withdrawTournamentParticipantFromMatch(tournament.id, participantId);
      setMessage(`${participantName} was withdrawn from the tournament.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not withdraw that participant.");
    }
  }

  function saveRoundRobinScore(matchId: string, correction = false) {
    if (!tournament) return;
    const draft = scoreDrafts[matchId];
    if (!draft || !draft.a.trim() || !draft.b.trim()) {
      setMessage("Enter both scores before saving the result.");
      return;
    }
    const scoreA = Number(draft.a);
    const scoreB = Number(draft.b);
    try {
      if (correction) correctTournamentMatchScore(tournament.id, matchId, scoreA, scoreB);
      else recordTournamentMatchScore(tournament.id, matchId, scoreA, scoreB);
      setCorrectingMatchId(null);
      setScoreDrafts((current) => {
        const next = { ...current };
        delete next[matchId];
        return next;
      });
      setMessage(correction ? "Match score corrected." : "Match score recorded.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not save that match score.");
    }
  }

  function beginScoreCorrection(matchId: string, scoreA: number, scoreB: number) {
    setScoreDrafts((current) => ({ ...current, [matchId]: { a: String(scoreA), b: String(scoreB) } }));
    setCorrectingMatchId(matchId);
  }

  function saveMatchCondition(matchId: string, draw: TournamentConditionDraw) {
    if (!tournament) return;
    try {
      recordTournamentMatchCondition(tournament.id, matchId, draw);
      setMessage(`Match condition drawn: ${draw.optionLabel}. Record the actual match winner separately.`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not record that match condition.");
    }
  }

  function saveChanceDraw(entrants: Array<{ participantId: string; tickets: number }>, winnerCount: number) {
    if (!tournament) return;
    try {
      drawTournamentWinner(tournament.id, entrants, winnerCount);
      setMessage("Chance draw recorded separately from tournament matches.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not draw tournament winners.");
    }
  }

  function undoChanceDraw() {
    if (!tournament) return;
    try {
      undoTournamentWinnerDraw(tournament.id);
      setMessage("Chance draw marked as undone. The original remains in activity history.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not undo that chance draw.");
    }
  }

  function correctWinner(matchId: string, winnerId: string) {
    if (!tournament) return;
    const dependentCount = getDependentCompletedMatchCount(tournament, matchId);
    const warning = dependentCount > 0
      ? `Correcting this result will clear ${dependentCount} later match ${dependentCount === 1 ? "result" : "results"} that depend on it. Those matches will need to be recorded again. Continue?`
      : "Correct this match result?";
    if (!window.confirm(warning)) return;
    try {
      correctTournamentMatchWinner(tournament.id, matchId, winnerId);
      setCorrectingMatchId(null);
      setMessage(dependentCount > 0
        ? `Result corrected. ${dependentCount} dependent ${dependentCount === 1 ? "match was" : "matches were"} reopened.`
        : "Result corrected.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Could not correct that result.");
    }
  }

  function undoLatest() {
    if (!tournament) return;
    const latestResult = tournament.rounds.flatMap((round) => round.matches)
      .filter((match) => match.resultSequence !== undefined)
      .reduce<{ id: string; sequence: number } | undefined>((latest, match) =>
        !latest || match.resultSequence! > latest.sequence
          ? { id: match.id, sequence: match.resultSequence! }
          : latest, undefined);
    undoTournamentResult(tournament.id);
    if (latestResult) {
      setScoreDrafts((current) => {
        const next = { ...current };
        delete next[latestResult.id];
        return next;
      });
      setCorrectingMatchId((current) => current === latestResult.id ? null : current);
    }
    setMessage("Latest match result undone.");
  }

  function beginSetupEdit() {
    if (!tournament) return;
    setSetupTitle(tournament.title);
    setSetupParticipantText(tournament.participants.map((participant) => participant.name).join("\n"));
    setSetupSeeding(tournament.seeding);
    setSetupFormat(tournament.format);
    setSetupTiebreaker(tournament.roundRobinTiebreaker ?? "seed");
    setSetupScoring({ ...(tournament.scoring ?? defaultRoundRobinScoring) });
    setSetupBaseUpdatedAt(tournament.updatedAt);
    setSetupError("");
    setIsEditingSetup(true);
  }

  function saveSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tournament) return;
    try {
      updateTournamentSetup(tournament.id, setupTitle, parsedSetupParticipants.names, setupSeeding, setupFormat, setupTiebreaker, setupScoring, setupBaseUpdatedAt);
      setIsEditingSetup(false);
      setSetupError("");
      setMessage("Tournament setup and pairings updated.");
    } catch (reason) {
      setSetupError(reason instanceof Error ? reason.message : "Could not update tournament setup.");
    }
  }

  if (!tournament || !progress) {
    return <div className="stack">
      <PageHeader eyebrow="Competition" title="Tournament not found" description="It may have been deleted from this browser." actions={<Link className="secondary-link" to="/tournaments"><ArrowLeft size={16} /> All tournaments</Link>} />
    </div>;
  }

  return <div className="stack">
    <PageHeader
      eyebrow={tournament.format === "round-robin" ? "Round robin" : "Single elimination"}
      title={tournament.title}
      description={`${tournament.participants.length} participants · ${progress.played} of ${progress.total} matches recorded`}
      actions={<div className="hero-actions">
        <Link className="secondary-link" to="/tournaments"><ArrowLeft size={16} /> Tournaments</Link>
        <Link className="secondary-link" to={`/tournaments/${tournament.id}/host`}><MonitorPlay size={16} /> Host mode</Link>
        {canEditTournamentSetup(tournament) && !isEditingSetup && <button className="secondary-link" type="button" onClick={beginSetupEdit}><Pencil size={16} /> Edit setup</button>}
        <button className="secondary-link" type="button" onClick={undoLatest} disabled={!hasUndoableTournamentResult(tournament)}><Undo2 size={16} /> Undo latest result</button>
        <button className="square-action" type="button" onClick={() => void copySchedule()} title="Copy tournament" aria-label="Copy tournament"><Copy size={16} /></button>
        <button className="square-action" type="button" onClick={exportSchedule} title="Export tournament" aria-label="Export tournament"><Download size={16} /></button>
        <button className="secondary-link" type="button" aria-expanded={isCsvExportOpen} onClick={() => setIsCsvExportOpen((current) => !current)}><FileSpreadsheet size={16} /> CSV export</button>
        <button className="secondary-link" type="button" onClick={() => window.print()}><Printer size={16} /> Print schedule</button>
      </div>}
    />
    <section className="metric-strip" aria-label="Tournament progress">
      <div><strong>{tournament.participants.length}</strong><span>Participants</span></div>
      <div><strong>{progress.played}/{progress.total}</strong><span>Matches decided</span></div>
      <div><strong>{tournament.rounds.length}</strong><span>Rounds</span></div>
      <div><strong>{tournament.format === "round-robin" ? currentLeader : progress.champion ?? "—"}</strong><span>{tournament.format === "round-robin" ? "Top place" : "Champion"}</span></div>
    </section>
    {message && <p className="status-note" role="status">{message}</p>}
    {isCsvExportOpen && csvPreview && <section className="shell-card tournament-export-review no-print" aria-label="Tournament CSV export review">
      <div className="shell-card-heading"><h2>Review CSV export</h2><p>Choose whether participant names and local activity history should be included before downloading.</p></div>
      <fieldset className="tournament-export-options">
        <legend>Privacy options</legend>
        <label><input type="checkbox" checked={anonymizeCsvNames} onChange={(event) => setAnonymizeCsvNames(event.target.checked)} /><span>Anonymize participant names</span></label>
        <label><input type="checkbox" checked={includeCsvActivity} onChange={(event) => setIncludeCsvActivity(event.target.checked)} /><span>Include local activity history, including chance-draw entrants, tickets, and odds</span></label>
      </fieldset>
      <section className="tournament-export-preview" aria-label="CSV export preview">
        <h3>Included in this file</h3>
        <ul>
          <li>{csvPreview.matchRows} match and schedule rows</li>
          {csvPreview.standingsRows > 0 && <li>{csvPreview.standingsRows} standings rows</li>}
          <li>Participant names: {csvPreview.participantNames}</li>
          <li>Activity history: {csvPreview.activityHistory}{includeCsvActivity ? ` (${csvPreview.activityRows} rows)` : ""}</li>
        </ul>
        <p className="muted">Email addresses and contact fields are not included in tournament exports.</p>
      </section>
      <div className="hero-actions">
        <button className="primary-link" type="button" onClick={exportCsv}><Download size={16} /> Download CSV</button>
        <button className="secondary-link" type="button" onClick={() => setIsCsvExportOpen(false)}>Cancel</button>
      </div>
    </section>}
    <div className="no-print"><ShellCard title="Chance-based winner draw" description="For raffles and casual games. It never decides a played match or changes standings.">
      <TournamentWinnerDrawPanel tournament={tournament} onDraw={saveChanceDraw} onUndo={undoChanceDraw} />
    </ShellCard></div>
    {isEditingSetup && <ShellCard title="Edit tournament setup" description="Update the roster or seeding before any match result is recorded. Pairings and automatic byes will be regenerated.">
      <form className="tournament-create-form" onSubmit={saveSetup}>
        {hasStaleSetup && <div className="validation-message" role="alert">
          <strong>This tournament changed in another tab.</strong>
          <p>Your unsaved setup is preserved. {canEditTournamentSetup(tournament) ? "Reload the current setup before continuing, or cancel to discard this draft." : "Event activity was recorded, so setup is now locked. Cancel to discard this stale draft."}</p>
          <div className="hero-actions">
            {canEditTournamentSetup(tournament) && <button className="secondary-link" type="button" onClick={beginSetupEdit}>Reload latest setup</button>}
            <button className="secondary-link" type="button" onClick={() => { setIsEditingSetup(false); setSetupError(""); }}>Cancel draft</button>
          </div>
        </div>}
        <label className="field-stack">
          <span>Tournament name</span>
          <input className="text-field" value={setupTitle} onChange={(event) => setSetupTitle(event.target.value)} required />
        </label>
        <label className="field-stack">
          <span>Participants · {parsedSetupParticipants.names.length} of {setupParticipantLimit}</span>
          <textarea className="text-field participant-entry" value={setupParticipantText} onChange={(event) => setSetupParticipantText(event.target.value)} rows={8} />
        </label>
        <label className="field-stack">
          <span>Seeding</span>
          <select className="select-field" value={setupSeeding} onChange={(event) => setSetupSeeding(event.target.value as Tournament["seeding"])}>
            <option value="entry-order">Use entry order</option>
            <option value="random">Shuffle participants</option>
            <option value="manual">Use saved seat numbers</option>
          </select>
        </label>
        <label className="field-stack">
          <span>Format</span>
          <select className="select-field" value={setupFormat} onChange={(event) => setSetupFormat(event.target.value as Tournament["format"])}>
            <option value="single-elimination">Single elimination</option>
            <option value="round-robin">Round robin</option>
          </select>
        </label>
        {setupFormat === "round-robin" && <label className="field-stack">
          <span>Standings tiebreaker</span>
          <select className="select-field" value={setupTiebreaker} onChange={(event) => setSetupTiebreaker(event.target.value as Tournament["roundRobinTiebreaker"])}>
            <option value="seed">Seed order</option>
            <option value="head-to-head">Head-to-head wins, then seed</option>
          </select>
        </label>}
        {setupFormat === "round-robin" && <fieldset className="tournament-scoring-fields">
          <legend>Points system</legend>
          <label className="field-stack"><span>Win points</span><input className="text-field" type="number" min="0" max="10000" step="1" value={setupScoring.winPoints} onChange={(event) => setSetupScoring((current) => ({ ...current, winPoints: Number(event.target.value) }))} /></label>
          <label className="field-stack"><span>Draw points</span><input className="text-field" type="number" min="0" max="10000" step="1" value={setupScoring.drawPoints} onChange={(event) => setSetupScoring((current) => ({ ...current, drawPoints: Number(event.target.value) }))} /></label>
          <label className="field-stack"><span>Loss points</span><input className="text-field" type="number" min="0" max="10000" step="1" value={setupScoring.lossPoints} onChange={(event) => setSetupScoring((current) => ({ ...current, lossPoints: Number(event.target.value) }))} /></label>
        </fieldset>}
        {setupFormat === "round-robin" && !isValidRoundRobinScoring(setupScoring) && <p className="validation-message" role="alert">Use whole points from 0 to 10,000, with wins above draws and draws at least equal to losses.</p>}
        {parsedSetupParticipants.duplicateCount > 0 && <p className="muted" role="status">Repeated names will be ignored ({parsedSetupParticipants.duplicateCount}).</p>}
        {parsedSetupParticipants.names.length > setupParticipantLimit && <p className="validation-message" role="alert">This format supports up to {setupParticipantLimit} participants.</p>}
        {setupError && <p className="validation-message" role="alert">{setupError}</p>}
        <div className="hero-actions">
          <button className="primary-link" type="submit" disabled={hasStaleSetup || !setupTitle.trim() || parsedSetupParticipants.names.length < 2 || parsedSetupParticipants.names.length > setupParticipantLimit || (setupFormat === "round-robin" && !isValidRoundRobinScoring(setupScoring))}>Save setup</button>
          <button className="secondary-link" type="button" onClick={() => { setIsEditingSetup(false); setSetupError(""); }}>Cancel</button>
        </div>
      </form>
    </ShellCard>}
    <ShellCard title="Participant management" description={`Withdrawal policy: ${tournament.withdrawalPolicy === "advance-opponent" ? "advance opponents through affected pending fixtures" : "preserve pending fixtures"}. Each withdrawal is logged with the tournament record.`}>
      <div className="project-list">{tournament.participants.map((participant) => <article className="project-row" key={participant.id}>
        <div className="project-copy"><strong>{participant.name}</strong><span>{participant.withdrawnAt ? `Withdrawn ${new Date(participant.withdrawnAt).toLocaleString()}` : participant.attendanceStatus === "checked-in" ? "Checked in" : "Active"}</span></div>
        {!participant.withdrawnAt && <button className="secondary-link" type="button" onClick={() => withdrawParticipant(participant.id, participant.name)}>Withdraw</button>}
      </article>)}</div>
    </ShellCard>
    <ShellCard title={tournament.format === "round-robin" ? "Schedule" : "Bracket"} description={tournament.format === "round-robin" ? `Every participant plays every other participant. Points are ${tournament.scoring?.winPoints ?? 3} for a win, ${tournament.scoring?.drawPoints ?? 1} for a draw, and ${tournament.scoring?.lossPoints ?? 0} for a loss. ${tournament.roundRobinTiebreaker === "head-to-head" ? "Overall-point ties are ranked by their head-to-head mini-table; unresolved ties share rank." : "Wins break point ties; seed sets display order for otherwise tied records."}` : "Record the real match winner. Byes advance automatically and never count as played matches."}>
      <div className="tournament-bracket" aria-label={tournament.format === "round-robin" ? "Round-robin schedule" : "Single-elimination bracket"}>
        {tournament.rounds.map((round) => <section className="tournament-round" key={round.roundNumber} aria-label={getTournamentRoundLabel(round.roundNumber, tournament.rounds.length, tournament.format)}>
          <header className="tournament-round-heading">
            <h2>{getTournamentRoundLabel(round.roundNumber, tournament.rounds.length, tournament.format)}</h2>
            <span>{round.matches.filter((match) => match.status === "complete").length}/{round.matches.filter((match) => match.status !== "bye").length}</span>
          </header>
          <div className="tournament-match-list">
            {round.matches.map((match) => {
              const participantA = match.participantAId ? participantsById.get(match.participantAId) : undefined;
              const participantB = match.participantBId ? participantsById.get(match.participantBId) : undefined;
              const winner = match.winnerId ? participantsById.get(match.winnerId) : undefined;
              const loser = winner?.id === participantA?.id ? participantB : participantA;
              const hasScore = match.scoreA !== undefined && match.scoreB !== undefined;
              const scoreDraft = scoreDrafts[match.id] ?? {
                a: hasScore ? String(match.scoreA) : "",
                b: hasScore ? String(match.scoreB) : "",
              };
              return <article className={`tournament-match ${match.status === "complete" ? "is-complete" : ""}`} data-match-id={match.id} key={match.id}>
                <div className="tournament-match-title"><strong>Match {match.matchNumber}</strong>{match.status === "bye" ? <span>Bye</span> : match.status === "complete" ? <span>Complete</span> : <span>Pending</span>}</div>
                {match.status === "bye" && winner ? <div className="tournament-bye"><span className="seed-label">Seed {winner.seed}</span><strong>{winner.name}</strong>{(winner.group || winner.role || winner.seat) && <small className="muted">{[winner.group, winner.role, winner.seat ? `Seat ${winner.seat}` : ""].filter(Boolean).join(" · ")}</small>}<span className="muted">{tournament.format === "round-robin" ? "Bye · no match played" : "Bye · advances"}</span></div> : <>
                  {[participantA, participantB].map((participant, side) => participant ? <div className={`tournament-entrant ${winner?.id === participant.id ? "is-winner" : ""}`} key={participant.id}>
                    <span className="seed-label">{participant.seed}</span>
                    <strong>{participant.name}</strong>
                    {(participant.group || participant.role || participant.seat) && <small className="muted">{[participant.group, participant.role, participant.seat ? `Seat ${participant.seat}` : ""].filter(Boolean).join(" · ")}</small>}
                    {winner?.id === participant.id && correctingMatchId !== match.id && <span className="winner-tag">Winner</span>}
                    {match.status === "pending" && participantA && participantB && <button className="record-winner-button" type="button" aria-label={`Record ${participant.name} as winner of round ${round.roundNumber} match ${match.matchNumber}`} onClick={() => chooseWinner(match.id, participant.id)}>Winner</button>}
                    {match.status === "pending" && !participantB && side === 0 && <button className="record-winner-button" type="button" aria-label={`Confirm bye for ${participant.name} in match ${match.matchNumber}`} onClick={() => confirmBye(match.id, participant.name)}>Confirm bye</button>}
                    {match.status === "complete" && correctingMatchId === match.id && !hasScore && <button className="record-winner-button" type="button" aria-label={`Correct result: make ${participant.name} the winner of match ${match.matchNumber}`} onClick={() => correctWinner(match.id, participant.id)}>Set winner</button>}
                    {match.status === "complete" && correctingMatchId !== match.id && !hasScore && winner?.id === participant.id && <button className="record-winner-button" type="button" aria-label={`Correct result for match ${match.matchNumber}`} onClick={() => setCorrectingMatchId(match.id)}>Correct</button>}
                    {match.status === "complete" && winner && correctingMatchId !== match.id && winner.id !== participant.id && <span className="muted">{tournament.format === "round-robin" ? "Lost match" : "Eliminated"}</span>}
                    {match.status === "complete" && !winner && <span className="muted">Draw</span>}
                    {side === 0 && <span className="sr-only">vs</span>}
                  </div> : <div className="tournament-entrant is-undecided" key={`slot-${match.id}-${side}`}><span className="seed-label">—</span><span>{match.status === "complete" ? "No participant" : "Waiting for previous winner"}</span></div>)}
                  {tournament.format === "round-robin" && match.status === "pending" && participantA && participantB && <form className="match-score-entry" onSubmit={(event) => { event.preventDefault(); saveRoundRobinScore(match.id); }}>
                    <label className="field-stack"><span>{participantA.name} score</span><input aria-label={`${participantA.name} score, match ${match.matchNumber}`} className="text-field" type="number" min="0" max="1000000" step="1" required value={scoreDraft.a} onChange={(event) => setScoreDrafts((current) => ({ ...current, [match.id]: { ...scoreDraft, a: event.target.value } }))} /></label>
                    <label className="field-stack"><span>{participantB.name} score</span><input aria-label={`${participantB.name} score, match ${match.matchNumber}`} className="text-field" type="number" min="0" max="1000000" step="1" required value={scoreDraft.b} onChange={(event) => setScoreDrafts((current) => ({ ...current, [match.id]: { ...scoreDraft, b: event.target.value } }))} /></label>
                    <button className="secondary-link" type="submit">Record score</button>
                  </form>}
                  {tournament.format === "round-robin" && match.status === "complete" && hasScore && <>
                    <p className="tournament-result">{match.scoreA}-{match.scoreB}{winner ? ` · ${winner.name} won` : " · Draw"}</p>
                    {correctingMatchId === match.id ? <form className="match-score-entry" onSubmit={(event) => { event.preventDefault(); saveRoundRobinScore(match.id, true); }}>
                      <label className="field-stack"><span>{participantA?.name ?? "Participant A"} score</span><input aria-label={`Correct ${participantA?.name ?? "participant A"} score, match ${match.matchNumber}`} className="text-field" type="number" min="0" max="1000000" step="1" required value={scoreDraft.a} onChange={(event) => setScoreDrafts((current) => ({ ...current, [match.id]: { ...scoreDraft, a: event.target.value } }))} /></label>
                      <label className="field-stack"><span>{participantB?.name ?? "Participant B"} score</span><input aria-label={`Correct ${participantB?.name ?? "participant B"} score, match ${match.matchNumber}`} className="text-field" type="number" min="0" max="1000000" step="1" required value={scoreDraft.b} onChange={(event) => setScoreDrafts((current) => ({ ...current, [match.id]: { ...scoreDraft, b: event.target.value } }))} /></label>
                      <button className="secondary-link" type="submit">Save corrected score</button>
                    </form> : <button className="secondary-link" type="button" onClick={() => beginScoreCorrection(match.id, match.scoreA!, match.scoreB!)}>Correct score</button>}
                  </>}
                  {match.status === "complete" && winner && loser && !hasScore && <p className="tournament-result">{tournament.format === "round-robin" ? `${winner.name} defeated ${loser.name}` : `${winner.name} advances over ${loser.name}`}</p>}
                  {match.conditionDraw && <p className="tournament-condition-result"><strong>Condition:</strong> {match.conditionDraw.optionLabel} <span>from {match.conditionDraw.wheelTitle} · {Math.round(match.conditionDraw.optionChance * 1000) / 10}% chance</span></p>}
                  {match.status === "pending" && participantA && participantB && <div className="tournament-condition-actions">
                    <button className="secondary-link" type="button" onClick={() => setConditionMatchId(conditionMatchId === match.id ? null : match.id)}>{match.conditionDraw ? "Re-spin condition" : "Spin for condition"}</button>
                    {conditionMatchId === match.id && <TournamentConditionSpinner wheels={wheels} previousDraw={match.conditionDraw} onDraw={(draw) => saveMatchCondition(match.id, draw)} onClose={() => setConditionMatchId(null)} />}
                  </div>}
                  {correctingMatchId === match.id && <button className="tournament-cancel-correction" type="button" onClick={() => setCorrectingMatchId(null)}>Cancel correction</button>}
                </>}
              </article>;
            })}
          </div>
        </section>)}
      </div>
    </ShellCard>
    {tournament.format === "round-robin" && <ShellCard title={tournament.status === "completed" ? "Final standings" : "Standings"} description={`${tournament.scoring?.winPoints ?? 3} / ${tournament.scoring?.drawPoints ?? 1} / ${tournament.scoring?.lossPoints ?? 0} points for win / draw / loss. ${tournament.roundRobinTiebreaker === "head-to-head" ? "Head-to-head mini-table points break overall-point ties; unresolved ties share rank." : "Wins break point ties; otherwise tied records share rank and seed sets display order."}`}>
      <div className="tournament-standings" role="table" aria-label="Round-robin standings">
        <div className={`tournament-standing-row is-heading${tournament.roundRobinTiebreaker === "head-to-head" ? " has-h2h" : ""}`} role="row"><span role="columnheader">Rank</span><span role="columnheader">Participant</span><span role="columnheader">W-D-L</span><span role="columnheader">Points</span>{tournament.roundRobinTiebreaker === "head-to-head" && <span role="columnheader">H2H</span>}</div>
        {standings.map((standing) => <div className={`tournament-standing-row${tournament.roundRobinTiebreaker === "head-to-head" ? " has-h2h" : ""}`} role="row" key={standing.participant.id}>
          <strong role="cell">{standing.rank}</strong><span role="cell">{standing.participant.name}</span><span role="cell">{standing.wins}-{standing.draws}-{standing.losses}</span><strong role="cell">{standing.points}</strong>{tournament.roundRobinTiebreaker === "head-to-head" && <span role="cell">{standing.headToHeadPoints}</span>}
        </div>)}
      </div>
    </ShellCard>}
    {progress.champion && tournament.format === "single-elimination" && <ShellCard title="Champion" description="Tournament complete."><div className="champion-banner"><strong>{progress.champion}</strong><span>Winner of {tournament.title}</span></div></ShellCard>}
    <ShellCard title="Activity history" description="A local record of match conditions, chance draws, results, corrections, and undos. This history is not a tamper-proof or independently verified audit log.">
      {tournament.events.length > 0 ? <div className="project-list tournament-event-list">
        {[...tournament.events].reverse().map((event) => {
          const timestamp = new Date(event.createdAt);
          const timeLabel = Number.isNaN(timestamp.getTime()) ? event.createdAt : timestamp.toLocaleString();
          return <article className="project-row" key={event.id}>
            <div className="project-copy"><strong>#{event.sequence} · {describeTournamentEvent(event, participantNamesById, tournament.events)}</strong><span>{timeLabel}</span></div>
          </article>;
        })}
      </div> : <p className="muted">Match condition draws, chance draws, results, corrections, and undos will appear here.</p>}
    </ShellCard>
  </div>;
}
