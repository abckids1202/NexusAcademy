import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Trash2, Trophy, Upload } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import { createTournamentFromPreview, createTournamentPreview, deleteTournament } from "../services/tournamentService";
import { useTournaments } from "../hooks/useTournaments";
import type { RoundRobinScoring, RoundRobinTiebreaker, Tournament, TournamentFormat, TournamentMatch, TournamentSeeding } from "../types";
import { MAX_ROUND_ROBIN_PARTICIPANTS, MAX_TOURNAMENT_PARTICIPANTS, getTournamentProgress, getTournamentRoundLabel, isValidRoundRobinScoring } from "../utils/tournamentLogic";
import { parseParticipantNames } from "../utils/participantImport";
import { parseParticipantCsv, type CsvParticipantPreview } from "../utils/csvImport";
import { defaultRoundRobinScoring } from "../data/tournamentDefaults";

function describePreviewMatch(tournament: Tournament, roundIndex: number, matchIndex: number, match: TournamentMatch): string {
  const participants = new Map(tournament.participants.map((participant) => [participant.id, participant.name]));
  if (match.status === "bye" && match.winnerId) {
    const name = participants.get(match.winnerId) ?? "Participant";
    return tournament.format === "round-robin" ? `Bye · ${name} does not play this round` : `Bye · ${name} advances`;
  }
  if (tournament.format === "round-robin") {
    return `${participants.get(match.participantAId ?? "") ?? "TBD"} vs ${participants.get(match.participantBId ?? "") ?? "TBD"}`;
  }
  const sourceRound = tournament.rounds[roundIndex - 1];
  const getSide = (participantId: string | undefined, side: number) => {
    if (participantId) return participants.get(participantId) ?? "TBD";
    if (!sourceRound) return "TBD";
    const sourceMatch = sourceRound.matches[matchIndex * 2 + side];
    return sourceMatch
      ? `Winner of ${getTournamentRoundLabel(sourceRound.roundNumber, tournament.rounds.length, tournament.format)} match ${sourceMatch.matchNumber}`
      : "TBD";
  };
  return `${getSide(match.participantAId, 0)} vs ${getSide(match.participantBId, 1)}`;
}

export function TournamentsPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [participantText, setParticipantText] = useState("");
  const [seeding, setSeeding] = useState<TournamentSeeding>("entry-order");
  const [format, setFormat] = useState<TournamentFormat>("single-elimination");
  const [roundRobinTiebreaker, setRoundRobinTiebreaker] = useState<RoundRobinTiebreaker>("seed");
  const [scoring, setScoring] = useState<RoundRobinScoring>(() => ({ ...defaultRoundRobinScoring }));
  const tournaments = useTournaments();
  const [preview, setPreview] = useState<Tournament | null>(null);
  const [participantCsvPreview, setParticipantCsvPreview] = useState<CsvParticipantPreview | null>(null);
  const [error, setError] = useState("");
  const parsedParticipants = useMemo(() => parseParticipantNames(participantText), [participantText]);
  const participantLimit = format === "round-robin" ? MAX_ROUND_ROBIN_PARTICIPANTS : MAX_TOURNAMENT_PARTICIPANTS;
  const scoringValid = isValidRoundRobinScoring(scoring);
  const estimatedMatches = parsedParticipants.names.length * (parsedParticipants.names.length - 1) / 2;
  const estimatedRounds = parsedParticipants.names.length % 2 === 0
    ? parsedParticipants.names.length - 1
    : parsedParticipants.names.length;
  const csvAppendedCount = participantCsvPreview
    ? parseParticipantNames(`${participantText}\n${participantCsvPreview.names.join("\n")}`).names.length
    : 0;

  async function previewParticipantsCsv(file?: File) {
    if (!file) return;
    try {
      setParticipantCsvPreview(parseParticipantCsv(await file.text()));
      setError("");
    } catch (reason) {
      setParticipantCsvPreview(null);
      setError(reason instanceof Error ? reason.message : "Could not read this CSV file.");
    }
  }

  function applyParticipantsCsv(mode: "replace" | "append") {
    if (!participantCsvPreview) return;
    const names = mode === "replace"
      ? participantCsvPreview.names
      : parseParticipantNames(`${participantText}\n${participantCsvPreview.names.join("\n")}`).names;
    setParticipantText(names.join("\n"));
    setParticipantCsvPreview(null);
    setError("");
  }

  function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      setPreview(createTournamentPreview(title, parsedParticipants.names, seeding, format, roundRobinTiebreaker, scoring));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not prepare the tournament preview.");
    }
  }

  function handleCreatePreview() {
    if (!preview) return;
    setError("");
    try {
      const tournament = createTournamentFromPreview(preview);
      navigate(`/tournaments/${tournament.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the tournament.");
    }
  }

  function invalidatePreview() {
    setPreview(null);
    setError("");
  }

  function handleDelete(tournamentId: string, tournamentTitle: string) {
    if (!window.confirm(`Delete “${tournamentTitle}” and its tournament data? This cannot be undone.`)) return;
    deleteTournament(tournamentId);
  }

  return <div className="stack">
    <PageHeader eyebrow="Competition" title="Tournaments" description="Create brackets or round-robin schedules, record match results, and follow standings." />
    <div className="dashboard-grid tournament-page-grid">
      <ShellCard title="Create tournament" description="Paste one participant per line, then choose a competition format.">
        <form className="tournament-create-form" onSubmit={handlePreview}>
          <label className="field-stack">
            <span>Tournament name</span>
            <input className="text-field" value={title} onChange={(event) => { invalidatePreview(); setTitle(event.target.value); }} placeholder="Friday game night" required />
          </label>
          <label className="field-stack">
            <span>Participants · {parsedParticipants.names.length} of {participantLimit}</span>
            <textarea className="text-field participant-entry" value={participantText} onChange={(event) => { invalidatePreview(); setParticipantText(event.target.value); }} placeholder={'Avery\nJordan\nSam\nTaylor'} rows={8} />
          </label>
          <label className="secondary-link file-button"><Upload size={16} /> Preview participant CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { void previewParticipantsCsv(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          {participantCsvPreview && <section className="csv-option-preview" aria-label="Participant CSV preview">
            <p><strong>{participantCsvPreview.names.length} unique participants</strong>{participantCsvPreview.errors.length > 0 ? ` · ${participantCsvPreview.errors.length} rows need attention` : ""}{participantCsvPreview.blankRows > 0 ? ` · ${participantCsvPreview.blankRows} blank rows skipped` : ""}</p>
            <p className="muted">Only the first column is imported. Duplicate names are ignored without regard to capitalization.</p>
            {participantCsvPreview.duplicateCount > 0 && <p className="muted">{participantCsvPreview.duplicateCount} duplicate names found in this file.</p>}
            <ul>{participantCsvPreview.names.slice(0, 6).map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}</ul>
            {participantCsvPreview.names.length > 6 && <p className="muted">And {participantCsvPreview.names.length - 6} more participants.</p>}
            {participantCsvPreview.errors.length > 0 && <ul className="csv-option-errors" aria-label="Invalid participant rows">{participantCsvPreview.errors.slice(0, 4).map((item) => <li key={item.line}>Row {item.line}: {item.message}</li>)}</ul>}
            <p className="muted">Appending will result in {csvAppendedCount} unique participants.</p>
            <div className="hero-actions">
              <button className="primary-link" type="button" disabled={participantCsvPreview.names.length === 0} onClick={() => applyParticipantsCsv("append")}>Append participants</button>
              <button className="secondary-link" type="button" disabled={participantCsvPreview.names.length === 0} onClick={() => applyParticipantsCsv("replace")}>Replace participant list</button>
              <button className="secondary-link" type="button" onClick={() => setParticipantCsvPreview(null)}>Cancel import</button>
            </div>
          </section>}
          <label className="field-stack">
            <span>Format</span>
            <select className="select-field" value={format} onChange={(event) => { invalidatePreview(); setFormat(event.target.value as TournamentFormat); }}>
              <option value="single-elimination">Single elimination</option>
              <option value="round-robin">Round robin</option>
            </select>
          </label>
          <label className="field-stack">
            <span>Entry order</span>
            <select className="select-field" value={seeding} onChange={(event) => { invalidatePreview(); setSeeding(event.target.value as TournamentSeeding); }}>
              <option value="entry-order">Use entry order</option>
              <option value="random">Shuffle participants</option>
            </select>
          </label>
          {format === "round-robin" && <label className="field-stack">
            <span>Standings tiebreaker</span>
            <select className="select-field" value={roundRobinTiebreaker} onChange={(event) => { invalidatePreview(); setRoundRobinTiebreaker(event.target.value as RoundRobinTiebreaker); }}>
              <option value="seed">Seed order</option>
              <option value="head-to-head">Head-to-head wins, then seed</option>
            </select>
          </label>}
          {format === "round-robin" && <fieldset className="tournament-scoring-fields">
            <legend>Points system</legend>
            <label className="field-stack"><span>Win points</span><input className="text-field" type="number" min="0" max="10000" step="1" value={scoring.winPoints} onChange={(event) => { invalidatePreview(); setScoring((current) => ({ ...current, winPoints: Number(event.target.value) })); }} /></label>
            <label className="field-stack"><span>Draw points</span><input className="text-field" type="number" min="0" max="10000" step="1" value={scoring.drawPoints} onChange={(event) => { invalidatePreview(); setScoring((current) => ({ ...current, drawPoints: Number(event.target.value) })); }} /></label>
            <label className="field-stack"><span>Loss points</span><input className="text-field" type="number" min="0" max="10000" step="1" value={scoring.lossPoints} onChange={(event) => { invalidatePreview(); setScoring((current) => ({ ...current, lossPoints: Number(event.target.value) })); }} /></label>
          </fieldset>}
          {format === "round-robin" && !scoringValid && <p className="validation-message" role="alert">Use whole points from 0 to 10,000, with wins above draws and draws at least equal to losses.</p>}
          {format === "round-robin" && <p className="muted">Head-to-head awards 3 mini-table points for wins against opponents tied on overall points. Remaining ties share rank; seed order only sets display order.</p>}
          {format === "round-robin" && parsedParticipants.names.length >= 2 && <p className="muted">Schedule estimate · {estimatedRounds} rounds · {estimatedMatches} matches</p>}
          {parsedParticipants.names.length > participantLimit && <p className="validation-message" role="alert">{format === "round-robin" ? "Round robin supports up to 32 participants." : `This format supports up to ${MAX_TOURNAMENT_PARTICIPANTS} participants.`}</p>}
          {parsedParticipants.duplicateCount > 0 && <p className="muted" role="status">Repeated names are ignored ({parsedParticipants.duplicateCount}).</p>}
          {error && <p className="validation-message" role="alert">{error}</p>}
          <button className="primary-link" type="submit" disabled={!title.trim() || parsedParticipants.names.length < 2 || parsedParticipants.names.length > participantLimit || (format === "round-robin" && !scoringValid)}>
            <Trophy size={16} /> Preview tournament
          </button>
        </form>
        {preview && <section className="tournament-preview" aria-label="Tournament preview">
          <header className="tournament-preview-header">
            <div><p className="eyebrow">Review before creating</p><h2>{preview.title}</h2><p>{preview.format === "round-robin" ? `Round robin · ${preview.roundRobinTiebreaker === "head-to-head" ? "Head-to-head tiebreak" : "Seed-order tiebreak"} · ${preview.scoring?.winPoints ?? 3}/${preview.scoring?.drawPoints ?? 1}/${preview.scoring?.lossPoints ?? 0} win/draw/loss points` : "Single elimination"} · {preview.participants.length} participants · {getTournamentProgress(preview).total} matches</p></div>
            <span className="tournament-preview-seeding">{preview.seeding === "random" ? "Random seeding" : "Entry order"}</span>
          </header>
          {preview.seeding === "random" && <p className="muted">This shuffled seed order is fixed for this preview and will be used when you create the tournament.</p>}
          <ol className="tournament-preview-seeds" aria-label="Preview seed order">{preview.participants.map((participant) => <li key={participant.id}><span>Seed {participant.seed}</span><strong>{participant.name}</strong></li>)}</ol>
          <div className="tournament-preview-rounds" aria-label="Preview pairings" tabIndex={0}>
            {preview.rounds.map((round, roundIndex) => <section className="tournament-preview-round" key={round.roundNumber} aria-label={getTournamentRoundLabel(round.roundNumber, preview.rounds.length, preview.format)}>
              <h3>{getTournamentRoundLabel(round.roundNumber, preview.rounds.length, preview.format)}</h3>
              <ul>{round.matches.map((match, matchIndex) => <li className="tournament-preview-match" data-match-id={match.id} key={match.id}><span>Match {match.matchNumber}</span><strong>{describePreviewMatch(preview, roundIndex, matchIndex, match)}</strong></li>)}</ul>
            </section>)}
          </div>
          <div className="hero-actions">
            <button className="primary-link" type="button" onClick={handleCreatePreview}><Trophy size={16} /> Create this tournament</button>
            <button className="secondary-link" type="button" onClick={() => setPreview(createTournamentPreview(title, parsedParticipants.names, seeding, format, roundRobinTiebreaker, scoring))}>{seeding === "random" ? "Shuffle and preview again" : "Refresh preview"}</button>
          </div>
        </section>}
      </ShellCard>
      <ShellCard title="Saved tournaments" description={`${tournaments.length} local tournament${tournaments.length === 1 ? "" : "s"}`}>
        {tournaments.length > 0 ? <div className="project-list">
          {tournaments.map((tournament) => {
            const progress = getTournamentProgress(tournament);
            return <article className="project-row tournament-list-row" key={tournament.id}>
              <div className="project-copy">
                <strong>{tournament.title}</strong>
                <span>{tournament.format === "round-robin" ? "Round robin" : "Single elimination"} · {tournament.participants.length} participants · {progress.played}/{progress.total} matches · {tournament.status === "completed" ? `Champion: ${progress.champion ?? "Tie"}` : "In progress"}</span>
              </div>
              <div className="row-actions">
                <Link className="square-action" to={`/tournaments/${tournament.id}`} aria-label={`Open ${tournament.title}`} title="Open tournament"><ArrowRight size={16} /></Link>
                <button className="square-action danger-action" type="button" onClick={() => handleDelete(tournament.id, tournament.title)} aria-label={`Delete ${tournament.title}`} title="Delete tournament"><Trash2 size={16} /></button>
              </div>
            </article>;
          })}
        </div> : <p className="muted">No tournaments yet. Add participants to create your first bracket.</p>}
      </ShellCard>
    </div>
  </div>;
}
