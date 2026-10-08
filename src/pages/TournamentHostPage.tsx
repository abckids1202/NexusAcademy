import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, Monitor, RotateCcw, Tv2 } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { TournamentConditionSpinner } from "../components/tournament/TournamentConditionSpinner";
import { useTournaments } from "../hooks/useTournaments";
import { useWheels } from "../hooks/useWheels";
import type { Tournament, TournamentMatch, TournamentParticipantAttendance } from "../types";
import { correctTournamentMatchScore, correctTournamentMatchWinner, recordTournamentMatchBye, recordTournamentMatchCondition, recordTournamentMatchForfeit, recordTournamentMatchScore, recordTournamentMatchWinner, undoTournamentResult, updateTournamentParticipantAttendance } from "../services/tournamentService";
import { getDependentCompletedMatchCount, getTournamentProgress, getTournamentRoundLabel, getTournamentStandings, hasUndoableTournamentResult } from "../utils/tournamentLogic";

type QueueMatch = { match: TournamentMatch; roundNumber: number };

function getReadyMatches(tournament: Tournament): QueueMatch[] {
  return tournament.rounds.flatMap((round) => round.matches
    .filter((match) => match.status === "pending" && match.participantAId && (match.participantBId || tournament.byePolicy === "manual"))
    .map((match) => ({ match, roundNumber: round.roundNumber })));
}

function getRecentResults(tournament: Tournament): QueueMatch[] {
  return tournament.rounds.flatMap((round) => round.matches
    .filter((match) => match.status === "complete")
    .map((match) => ({ match, roundNumber: round.roundNumber })))
    .sort((left, right) => (right.match.resultSequence ?? 0) - (left.match.resultSequence ?? 0))
    .slice(0, 4);
}

const attendanceOptions: Array<{ value: TournamentParticipantAttendance; label: string }> = [
  { value: "expected", label: "Expected" },
  { value: "checked-in", label: "Checked in" },
  { value: "not-present", label: "Not present" },
];

export function TournamentHostPage() {
  const { tournamentId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tournaments = useTournaments();
  const wheels = useWheels();
  const tournament = tournaments.find((item) => item.id === tournamentId);
  const participantNames = useMemo(() => new Map(tournament?.participants.map((participant) => [participant.id, participant.name]) ?? []), [tournament]);
  const isAudience = searchParams.get("view") === "audience";
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [conditionMatchId, setConditionMatchId] = useState("");
  const [correctingMatchId, setCorrectingMatchId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!tournament) return <section className="host-empty"><Link className="host-back-link" to="/tournaments"><ArrowLeft size={18} /> All tournaments</Link><h1>Tournament not found</h1><p>It may have been deleted from this browser.</p></section>;

  const progress = getTournamentProgress(tournament);
  const queue = getReadyMatches(tournament);
  const active = queue.find((item) => item.match.id === selectedMatchId) ?? queue[0];
  const recentResults = getRecentResults(tournament);
  const match = active?.match;
  const participantA = match?.participantAId ? participantNames.get(match.participantAId) : undefined;
  const participantB = match?.participantBId ? participantNames.get(match.participantBId) : undefined;

  function announceSuccess(text: string) {
    setError("");
    setMessage(text);
  }

  function announceFailure(reason: unknown, fallback: string) {
    setMessage("");
    setError(reason instanceof Error ? reason.message : fallback);
  }

  function recordWinner(winnerId: string, winnerName: string) {
    if (!match) return;
    try {
      recordTournamentMatchWinner(tournament!.id, match.id, winnerId);
      announceSuccess(`${winnerName} recorded as winner of ${getTournamentRoundLabel(active!.roundNumber, tournament!.rounds.length, tournament!.format)}, match ${match.matchNumber}.`);
      setSelectedMatchId("");
    } catch (reason) {
      announceFailure(reason, "Could not record that result.");
    }
  }

  function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!match) return;
    const values = new FormData(event.currentTarget);
    const first = Number(values.get("scoreA"));
    const second = Number(values.get("scoreB"));
    try {
      recordTournamentMatchScore(tournament!.id, match.id, first, second);
      announceSuccess(`Score recorded: ${participantA} ${first}, ${participantB} ${second}.`);
      setSelectedMatchId("");
    } catch (reason) {
      announceFailure(reason, "Could not record that score.");
    }
  }

  function undoLatest() {
    try {
      undoTournamentResult(tournament!.id);
      setSelectedMatchId("");
      announceSuccess("The latest match result was undone.");
    } catch (reason) {
      announceFailure(reason, "Could not undo the latest result.");
    }
  }

  function updateAttendance(participantId: string, status: TournamentParticipantAttendance) {
    const participant = tournament!.participants.find((item) => item.id === participantId);
    try {
      updateTournamentParticipantAttendance(tournament!.id, participantId, status);
      announceSuccess(`${participant?.name ?? "Participant"}: ${attendanceOptions.find((option) => option.value === status)?.label}. Fixtures and results are unchanged.`);
    } catch (reason) {
      announceFailure(reason, "Could not update participant attendance.");
    }
  }

  function recordForfeit(forfeitingParticipantId: string) {
    if (!match?.participantAId || !match.participantBId) return;
    const forfeitingName = participantNames.get(forfeitingParticipantId) ?? "Participant";
    const winnerId = forfeitingParticipantId === match.participantAId ? match.participantBId : match.participantAId;
    const winnerName = participantNames.get(winnerId) ?? "Opponent";
    const policy = tournament!.format === "round-robin"
      ? "This awards the configured win/loss points with no score and does not change the participant's other fixtures."
      : "The opponent advances through the existing bracket. This does not remove the participant from the tournament record.";
    if (!window.confirm(`Record ${forfeitingName} as forfeiting this match? ${winnerName} will be the winner. ${policy}`)) return;
    try {
      recordTournamentMatchForfeit(tournament!.id, match.id, forfeitingParticipantId);
      announceSuccess(`${forfeitingName} forfeited. ${winnerName} is recorded as the match winner.`);
      setSelectedMatchId("");
    } catch (reason) {
      announceFailure(reason, "Could not record the forfeit.");
    }
  }

  function correctWinner(item: QueueMatch, winnerId: string, winnerName: string) {
    const dependentCount = getDependentCompletedMatchCount(tournament!, item.match.id);
    const warning = dependentCount > 0
      ? `Correcting this result will clear ${dependentCount} later match ${dependentCount === 1 ? "result" : "results"} that depend on it. Those matches will need to be recorded again. Continue?`
      : "Correct this match result?";
    if (!window.confirm(warning)) return;
    try {
      correctTournamentMatchWinner(tournament!.id, item.match.id, winnerId);
      setCorrectingMatchId("");
      announceSuccess(`${winnerName} is now recorded as the winner of ${getTournamentRoundLabel(item.roundNumber, tournament!.rounds.length, tournament!.format)}, match ${item.match.matchNumber}.`);
    } catch (reason) {
      announceFailure(reason, "Could not correct that result.");
    }
  }

  function submitCorrectedScore(event: FormEvent<HTMLFormElement>, item: QueueMatch) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      correctTournamentMatchScore(tournament!.id, item.match.id, Number(values.get("scoreA")), Number(values.get("scoreB")));
      setCorrectingMatchId("");
      announceSuccess(`Score corrected for ${getTournamentRoundLabel(item.roundNumber, tournament!.rounds.length, tournament!.format)}, match ${item.match.matchNumber}.`);
    } catch (reason) {
      announceFailure(reason, "Could not correct that score.");
    }
  }

  const formatName = tournament.format === "round-robin" ? "Round robin" : "Single elimination";

  return <div className={`tournament-host${isAudience ? " is-audience" : ""}`}>
    <header className="host-topbar">
      <div className="host-brand-lockup">
        <Link className="host-back-link" to={isAudience ? "/tournaments" : `/tournaments/${tournament.id}`} aria-label={isAudience ? "Back to tournaments" : "Back to tournament details"}><ArrowLeft size={18} /></Link>
        <div><span className="host-eyebrow">{formatName} · {progress.played}/{progress.total} matches</span><h1>{tournament.title}</h1></div>
      </div>
      <nav className="host-view-controls" aria-label="Tournament view">
        {isAudience
          ? <span className="host-current-view"><Tv2 size={16} /> Audience display</span>
          : <><button className="is-selected" type="button" aria-current="page"><Monitor size={16} /> Host</button><button type="button" onClick={() => setSearchParams({ view: "audience" })}><Tv2 size={16} /> Audience</button></>}
      </nav>
      {!isAudience && <div className="host-header-actions">
        <Link className="host-audience-link" to={`/tournaments/${tournament.id}/host?view=audience`} target="_blank" rel="noreferrer"><Tv2 size={16} /> Open audience screen</Link>
        <Link className="host-exit-link" to={`/tournaments/${tournament.id}`}>Exit host mode</Link>
      </div>}
    </header>

    {message && <p className="host-message" role="status">{message}</p>}
    {error && <p className="host-error" role="alert">{error}</p>}

    {isAudience ? <main className="audience-layout" aria-label="Tournament audience display">
      <section className="audience-scoreboard" aria-label="Current match">
        {match ? <>
          <p className="host-eyebrow">{getTournamentRoundLabel(active!.roundNumber, tournament.rounds.length, tournament.format)} · Match {match.matchNumber} · Up next</p>
          <div className="audience-players"><strong>{participantA}</strong><span>VS</span><strong>{participantB}</strong></div>
          {match.conditionDraw && <p className="audience-condition">{match.conditionDraw.optionLabel}<span>{match.conditionDraw.wheelTitle}</span></p>}
        </> : <>
          <p className="host-eyebrow">{tournament.status === "completed" ? "Tournament complete" : "Event status"}</p>
          <h2>{progress.champion ? `${progress.champion} wins` : tournament.status === "completed" ? "Final standings are tied" : "Waiting for the next match"}</h2>
          <p>{tournament.status === "completed" ? `${progress.played} matches played` : "The next pairing will appear here when results make it ready."}</p>
        </>}
      </section>
      {tournament.format === "round-robin" && <section className="audience-standings" aria-label="Current standings">
        <h2>Standings</h2>
        <ol>{getTournamentStandings(tournament).map((standing) => <li key={standing.participant.id}><span>{standing.rank}</span><strong>{standing.participant.name}</strong><span>{standing.points} pts</span></li>)}</ol>
      </section>}
      {recentResults.length > 0 && <section className="audience-results" aria-label="Recent results"><h2>Recent results</h2>
        {recentResults.map(({ match: result, roundNumber }) => <p key={result.id}><span>{getTournamentRoundLabel(roundNumber, tournament.rounds.length, tournament.format)} · {participantNames.get(result.participantAId ?? "")} {result.scoreA !== undefined ? `${result.scoreA}-${result.scoreB}` : "vs"} {participantNames.get(result.participantBId ?? "")}{result.resultMethod === "forfeit" ? ` · Forfeit: ${participantNames.get(result.forfeitingParticipantId ?? "")}` : ""}</span><strong>{participantNames.get(result.winnerId ?? "") ?? "Draw"}</strong></p>)}
      </section>}
    </main> : <main className="host-layout">
      <section className="host-current-panel" aria-label="Match queue">
        <div className="host-section-heading"><div><span className="host-eyebrow">Live match queue</span><h2>{match ? "Now playing" : "No match ready"}</h2></div>{hasUndoableTournamentResult(tournament) && <button className="host-undo-button" type="button" onClick={undoLatest}><RotateCcw size={16} /> Undo latest result</button>}</div>

        {match ? <article className="host-match-card" aria-label="Current match">
          <div className="host-match-meta"><span>{getTournamentRoundLabel(active!.roundNumber, tournament.rounds.length, tournament.format)}</span><span>Match {match.matchNumber}</span><span>{queue.length} ready</span></div>
          <div className="host-contestants">
            <div><span>Participant A</span><strong>{participantA}</strong></div><span className="host-versus">VS</span><div><span>Participant B</span><strong>{participantB}</strong></div>
          </div>
          {!participantB ? <div className="host-winner-actions"><p>This fixture has one participant. Confirm the bye to advance them.</p><button className="host-primary-action" type="button" onClick={() => { try { recordTournamentMatchBye(tournament.id, match.id); announceSuccess(`${participantA} confirmed as advancing on a bye.`); setSelectedMatchId(""); } catch (reason) { announceFailure(reason, "Could not confirm the bye."); } }}>Confirm bye for {participantA}</button></div> : <>
          {match.conditionDraw && <p className="host-condition-result"><strong>Condition:</strong> {match.conditionDraw.optionLabel}<span>{match.conditionDraw.wheelTitle} · {Math.round(match.conditionDraw.optionChance * 1000) / 10}% chance</span></p>}
          {!match.conditionDraw && <p className="host-subtle">Optional: draw a map, challenge, or rule. It does not choose the winner.</p>}
          {conditionMatchId === match.id
            ? <TournamentConditionSpinner wheels={wheels} previousDraw={match.conditionDraw} onDraw={(draw) => {
              try { recordTournamentMatchCondition(tournament.id, match.id, draw); announceSuccess(`Condition selected: ${draw.optionLabel}. Record the winner separately.`); }
              catch (reason) { announceFailure(reason, "Could not save the match condition."); }
            }} onClose={() => setConditionMatchId("")} />
            : <button className="host-condition-button" type="button" onClick={() => setConditionMatchId(match.id)}>{match.conditionDraw ? "Re-spin condition" : "Spin for condition"}<ChevronRight size={16} /></button>}

          {tournament.format === "round-robin" ? <form className="host-score-entry" key={match.id} onSubmit={submitScore}>
            <label><span>{participantA} score</span><input aria-label={`${participantA} score`} name="scoreA" type="number" min="0" max="1000000" step="1" required /></label>
            <span className="host-score-divider">:</span>
            <label><span>{participantB} score</span><input aria-label={`${participantB} score`} name="scoreB" type="number" min="0" max="1000000" step="1" required /></label>
            <button className="host-primary-action" type="submit">Record score</button>
          </form> : <div className="host-winner-actions">
            <p>Record the match result</p>
            <button className="host-primary-action" type="button" onClick={() => recordWinner(match.participantAId!, participantA!)}>{participantA} wins</button>
            <button className="host-primary-action" type="button" onClick={() => recordWinner(match.participantBId!, participantB!)}>{participantB} wins</button>
          </div>}
          <div className="host-forfeit-actions">
            <p>Forfeit this match only. “Not present” does not automatically award a result.</p>
            <div>
              <button type="button" onClick={() => recordForfeit(match.participantAId!)}>{participantA} forfeits</button>
              <button type="button" onClick={() => recordForfeit(match.participantBId!)}>{participantB} forfeits</button>
            </div>
          </div>
          </>}
        </article> : <div className="host-waiting-state">
          <h3>{tournament.status === "completed" ? "The tournament is complete" : "Waiting on earlier results"}</h3>
          <p>{tournament.status === "completed" ? (progress.champion ? `${progress.champion} is the champion.` : "The final standings are tied.") : "The bracket will unlock the next match as soon as its participants are decided."}</p>
          {progress.champion && <strong className="host-champion">{progress.champion}</strong>}
        </div>}
      </section>

      <aside className="host-queue-panel" aria-label="Upcoming matches">
        <div className="host-section-heading"><div><span className="host-eyebrow">{queue.length} ready to play</span><h2>Up next</h2></div></div>
        {queue.filter((item) => item.match.id !== match?.id).length > 0 ? <ol className="host-queue-list">{queue.filter((item) => item.match.id !== match?.id).map(({ match: queuedMatch, roundNumber }) => <li key={queuedMatch.id}>
          <button className={`host-queue-item${selectedMatchId === queuedMatch.id ? " is-selected" : ""}`} type="button" onClick={() => { setSelectedMatchId(queuedMatch.id); setConditionMatchId(""); }}>
            <span>{getTournamentRoundLabel(roundNumber, tournament.rounds.length, tournament.format)} · Match {queuedMatch.matchNumber}</span>
            <strong>{participantNames.get(queuedMatch.participantAId ?? "")} <span>vs</span> {participantNames.get(queuedMatch.participantBId ?? "")}</strong>
          </button>
        </li>)}</ol> : <p className="host-subtle">{match ? "No other matches are ready yet." : "New matches appear here as the tournament progresses."}</p>}
        {recentResults.length > 0 && <div className="host-recent-results"><h3>Recent results</h3>{recentResults.slice(0, 3).map((item) => {
          const result = item.match;
          const roundLabel = getTournamentRoundLabel(item.roundNumber, tournament.rounds.length, tournament.format);
          const nameA = participantNames.get(result.participantAId ?? "") ?? "Participant A";
          const nameB = participantNames.get(result.participantBId ?? "") ?? "Participant B";
          return <article className="host-recent-result" key={result.id}>
            <div className="host-recent-result-row"><p><span>{roundLabel} · Match {result.matchNumber} · {nameA} vs {nameB}{result.resultMethod === "forfeit" ? ` · Forfeit: ${participantNames.get(result.forfeitingParticipantId ?? "")}` : ""}</span><strong>{participantNames.get(result.winnerId ?? "") ?? `${result.scoreA}-${result.scoreB} draw`}</strong></p>
              <button className="host-correct-button" type="button" aria-expanded={correctingMatchId === result.id} aria-label={`Correct result for ${roundLabel} match ${result.matchNumber}`} onClick={() => setCorrectingMatchId((current) => current === result.id ? "" : result.id)}>Correct</button>
            </div>
            {correctingMatchId === result.id && <div className="host-correction-panel" aria-label={`Correct ${roundLabel} match ${result.matchNumber}`}>
              {tournament.format === "round-robin" ? <form className="host-correction-score" key={result.id} onSubmit={(event) => submitCorrectedScore(event, item)}>
                {result.resultMethod === "forfeit" && <p>Entering a played score replaces this forfeit decision.</p>}
                <label><span>{nameA} score</span><input aria-label={`Correct ${nameA} score`} name="scoreA" type="number" min="0" max="1000000" step="1" defaultValue={result.scoreA ?? 0} required /></label>
                <label><span>{nameB} score</span><input aria-label={`Correct ${nameB} score`} name="scoreB" type="number" min="0" max="1000000" step="1" defaultValue={result.scoreB ?? 0} required /></label>
                <button className="host-primary-action" type="submit">Save corrected score</button>
              </form> : <div className="host-correction-winners">
                <p>Choose the correct winner. Later dependent results may be reopened.</p>
                {result.participantAId && <button type="button" onClick={() => correctWinner(item, result.participantAId!, nameA)}>Make {nameA} the winner</button>}
                {result.participantBId && <button type="button" onClick={() => correctWinner(item, result.participantBId!, nameB)}>Make {nameB} the winner</button>}
              </div>}
              <button className="host-cancel-correction" type="button" onClick={() => setCorrectingMatchId("")}>Cancel</button>
            </div>}
          </article>;
        })}</div>}
        {tournament.format === "round-robin" && <div className="host-mini-standings"><h3>Standings</h3>{getTournamentStandings(tournament).slice(0, 5).map((standing) => <p key={standing.participant.id}><span>{standing.rank}. {standing.participant.name}</span><strong>{standing.points} pts</strong></p>)}</div>}
        <section className="host-attendance" aria-label="Participant check-in">
          <div className="host-attendance-heading"><h3>Participant check-in</h3><span>{tournament.participants.filter((participant) => (participant.attendanceStatus ?? "expected") === "checked-in").length}/{tournament.participants.length} checked in</span></div>
          <p>Attendance does not change pairings or results. The first check-in locks tournament setup.</p>
          <ul>{tournament.participants.map((participant) => <li key={participant.id}>
            <label htmlFor={`attendance-${participant.id}`}>{participant.name}</label>
            <select id={`attendance-${participant.id}`} aria-label={`${participant.name} attendance`} value={participant.attendanceStatus ?? "expected"} onChange={(event) => updateAttendance(participant.id, event.target.value as TournamentParticipantAttendance)}>
              {attendanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </li>)}</ul>
        </section>
      </aside>
    </main>}
  </div>;
}
