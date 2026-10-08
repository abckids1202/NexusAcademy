import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Shuffle, Trash2, Trophy, Upload } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import { createTournamentFromPreview, createTournamentPreview, deleteTournament, type TournamentRosterMetadata } from "../services/tournamentService";
import { useTournaments } from "../hooks/useTournaments";
import type { RoundRobinScoring, RoundRobinTiebreaker, Tournament, TournamentBestOf, TournamentByePolicy, TournamentFormat, TournamentMatch, TournamentSeeding, TournamentWithdrawalPolicy } from "../types";
import { MAX_DOUBLE_ELIMINATION_PARTICIPANTS, MAX_ROUND_ROBIN_PARTICIPANTS, MAX_TOURNAMENT_PARTICIPANTS, getTournamentProgress, getTournamentRoundLabel, isValidRoundRobinScoring, shuffleParticipants } from "../utils/tournamentLogic";
import { parseParticipantNames } from "../utils/participantImport";
import { inspectParticipantCsv, parseParticipantCsvColumn, type CsvParticipantPreview, type ParticipantCsvInspection } from "../utils/csvImport";
import { defaultRoundRobinScoring } from "../data/tournamentDefaults";
import { useParticipants } from "../hooks/useParticipants";

function describePreviewMatch(tournament: Tournament, roundIndex: number, matchIndex: number, match: TournamentMatch): string {
  const participants = new Map(tournament.participants.map((participant) => [participant.id, participant.name]));
  if (match.status === "bye" && match.winnerId) {
    const name = participants.get(match.winnerId) ?? "Participant";
    return tournament.format === "round-robin" ? `Bye · ${name} does not play this round` : `Bye · ${name} advances`;
  }
  if (tournament.format === "round-robin") {
    return `${participants.get(match.participantAId ?? "") ?? "TBD"} vs ${participants.get(match.participantBId ?? "") ?? "TBD"}`;
  }
  if (tournament.format === "double-elimination") {
    return `${participants.get(match.participantAId ?? "") ?? "TBD"} vs ${participants.get(match.participantBId ?? "") ?? "TBD"}`;
  }
  const sourceRound = tournament.rounds[roundIndex - 1];
  const isThirdPlace = tournament.thirdPlaceMatch && roundIndex === tournament.rounds.length - 1 && match.matchNumber === 2;
  const getSide = (participantId: string | undefined, side: number) => {
    if (participantId) return participants.get(participantId) ?? "TBD";
    if (!sourceRound) return "TBD";
    const sourceMatch = isThirdPlace
      ? sourceRound.matches[side]
      : sourceRound.matches[matchIndex * 2 + side];
    return sourceMatch
      ? `${isThirdPlace ? "Loser" : "Winner"} of ${getTournamentRoundLabel(sourceRound.roundNumber, tournament.rounds.length, tournament.format)} match ${sourceMatch.matchNumber}`
      : "TBD";
  };
  return `${getSide(match.participantAId, 0)} vs ${getSide(match.participantBId, 1)}`;
}

export function TournamentsPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [participantText, setParticipantText] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [rosterMetadata, setRosterMetadata] = useState<Record<string, TournamentRosterMetadata>>({});
  const [teamCount, setTeamCount] = useState(2);
  const [seeding, setSeeding] = useState<TournamentSeeding>("entry-order");
  const [byePolicy, setByePolicy] = useState<TournamentByePolicy>("automatic");
  const [withdrawalPolicy, setWithdrawalPolicy] = useState<TournamentWithdrawalPolicy>("advance-opponent");
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
  const [bestOf, setBestOf] = useState<TournamentBestOf>(1);
  const [format, setFormat] = useState<TournamentFormat>("single-elimination");
  const [roundRobinTiebreaker, setRoundRobinTiebreaker] = useState<RoundRobinTiebreaker>("seed");
  const [scoring, setScoring] = useState<RoundRobinScoring>(() => ({ ...defaultRoundRobinScoring }));
  const tournaments = useTournaments();
  const directoryParticipants = useParticipants(false);
  const [preview, setPreview] = useState<Tournament | null>(null);
  const [participantCsvPreview, setParticipantCsvPreview] = useState<CsvParticipantPreview | null>(null);
  const [participantCsvSource, setParticipantCsvSource] = useState<{ input: string; inspection: ParticipantCsvInspection } | null>(null);
  const [participantNameColumn, setParticipantNameColumn] = useState(0);
  const [error, setError] = useState("");
  const parsedParticipants = useMemo(() => parseParticipantNames(participantText), [participantText]);
  const participantLimit = format === "round-robin" ? MAX_ROUND_ROBIN_PARTICIPANTS : format === "double-elimination" ? MAX_DOUBLE_ELIMINATION_PARTICIPANTS : MAX_TOURNAMENT_PARTICIPANTS;
  const scoringValid = isValidRoundRobinScoring(scoring);
  const estimatedMatches = parsedParticipants.names.length * (parsedParticipants.names.length - 1) / 2;
  const estimatedRounds = parsedParticipants.names.length % 2 === 0
    ? parsedParticipants.names.length - 1
    : parsedParticipants.names.length;
  const csvAppendedCount = participantCsvPreview
    ? parseParticipantNames(`${participantText}\n${participantCsvPreview.names.join("\n")}`).names.length
    : 0;
  const directoryMetadataByName = useMemo<Record<string, TournamentRosterMetadata>>(() => Object.fromEntries(
    directoryParticipants.map((participant) => [participant.name.toLocaleLowerCase(), participant.group ? { group: participant.group } : {}]),
  ), [directoryParticipants]);
  const metadataByName = useMemo<Record<string, TournamentRosterMetadata>>(() => Object.fromEntries(
    parsedParticipants.names.map((name) => {
      const key = name.toLocaleLowerCase();
      const directory = directoryMetadataByName[key] ?? {};
      const custom = rosterMetadata[key] ?? {};
      return [key, {
        ...(directory.group ? { group: directory.group } : {}),
        ...(custom.group?.trim() ? { group: custom.group.trim() } : {}),
        ...(custom.role?.trim() ? { role: custom.role.trim() } : {}),
        ...(custom.seat && custom.seat > 0 ? { seat: Math.floor(custom.seat) } : {}),
      }];
    }),
  ), [directoryMetadataByName, parsedParticipants.names, rosterMetadata]);
  const manualSeedValid = seeding !== "manual" || (() => {
    const seats = parsedParticipants.names.map((name) => metadataByName[name.toLocaleLowerCase()]?.seat);
    return seats.length >= 2 && seats.every((seat) => seat !== undefined && Number.isInteger(seat) && seat > 0) && new Set(seats).size === seats.length;
  })();

  async function previewParticipantsCsv(file?: File) {
    if (!file) return;
    try {
      const input = await file.text();
      const inspection = inspectParticipantCsv(input);
      setParticipantCsvSource({ input, inspection });
      setParticipantNameColumn(0);
      setParticipantCsvPreview(parseParticipantCsvColumn(input, 0));
      setError("");
    } catch (reason) {
      setParticipantCsvPreview(null);
      setParticipantCsvSource(null);
      setError(reason instanceof Error ? reason.message : "Could not read this CSV file.");
    }
  }

  function changeParticipantNameColumn(value: number) {
    setParticipantNameColumn(value);
    if (participantCsvSource) setParticipantCsvPreview(parseParticipantCsvColumn(participantCsvSource.input, value));
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

  function addDirectoryParticipants() {
    const names = directoryParticipants
      .filter((participant) => selectedParticipantIds.includes(participant.id))
      .map((participant) => participant.name);
    if (names.length === 0) return;
    setParticipantText((current) => parseParticipantNames(`${current}\n${names.join("\n")}`).names.join("\n"));
    setSelectedParticipantIds([]);
    invalidatePreview();
  }

  function updateRosterMetadata(name: string, field: keyof TournamentRosterMetadata, value: string) {
    const key = name.toLocaleLowerCase();
    setRosterMetadata((current) => ({ ...current, [key]: { ...current[key], [field]: field === "seat" ? (value ? Number(value) : undefined) : value } }));
    invalidatePreview();
  }

  function assignRandomSeats() {
    const seats = shuffleParticipants(parsedParticipants.names).reduce<Record<string, TournamentRosterMetadata>>((result, name, index) => {
      const key = name.toLocaleLowerCase();
      result[key] = { ...rosterMetadata[key], seat: index + 1 };
      return result;
    }, {});
    setRosterMetadata((current) => ({ ...current, ...seats }));
    invalidatePreview();
  }

  function assignBalancedTeams() {
    const count = Math.max(2, Math.min(teamCount, parsedParticipants.names.length));
    const teams = shuffleParticipants(parsedParticipants.names).reduce<Record<string, TournamentRosterMetadata>>((result, name, index) => {
      const key = name.toLocaleLowerCase();
      result[key] = { ...rosterMetadata[key], group: `Team ${(index % count) + 1}` };
      return result;
    }, {});
    setRosterMetadata((current) => ({ ...current, ...teams }));
    invalidatePreview();
  }

  function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      setPreview(createTournamentPreview(title, parsedParticipants.names, seeding, format, roundRobinTiebreaker, scoring, metadataByName, byePolicy, withdrawalPolicy, thirdPlaceMatch, bestOf));
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
          {directoryParticipants.length > 0 && <fieldset className="directory-picker">
            <legend>Reuse participant directory</legend>
            <label className="field-stack"><span>Select saved participants</span><select className="select-field" multiple size={Math.min(5, directoryParticipants.length)} aria-label="Saved participants" value={selectedParticipantIds} onChange={(event) => setSelectedParticipantIds(Array.from(event.target.selectedOptions, (option) => option.value))}>{directoryParticipants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}{participant.group ? ` · ${participant.group}` : ""}</option>)}</select></label>
            <button className="secondary-link" type="button" disabled={selectedParticipantIds.length === 0} onClick={addDirectoryParticipants}>Add selected participants</button>
          </fieldset>}
          {parsedParticipants.names.length > 0 && <fieldset className="roster-details">
            <legend>Roster details</legend>
            <p className="muted">Add team labels, roles, or seats before reviewing the bracket. These details stay with the tournament record.</p>
            <div className="roster-detail-list">{parsedParticipants.names.map((name) => {
              const key = name.toLocaleLowerCase();
              const directoryGroup = directoryMetadataByName[key]?.group ?? "";
              const details = rosterMetadata[key] ?? {};
              return <div className="roster-detail-row" key={key}>
                <strong>{name}</strong>
                <label><span className="sr-only">Group or team for {name}</span><input className="text-field" value={details.group ?? directoryGroup} onChange={(event) => updateRosterMetadata(name, "group", event.target.value)} placeholder="Team / group" /></label>
                <label><span className="sr-only">Role for {name}</span><input className="text-field" value={details.role ?? ""} onChange={(event) => updateRosterMetadata(name, "role", event.target.value)} placeholder="Role" /></label>
                <label><span className="sr-only">Seat for {name}</span><input className="text-field" type="number" min="1" step="1" value={details.seat ?? ""} onChange={(event) => updateRosterMetadata(name, "seat", event.target.value)} placeholder="Seat" /></label>
              </div>;
            })}</div>
            <button className="secondary-link" type="button" onClick={assignRandomSeats}><Shuffle size={16} /> Assign random seats</button>
            <div className="hero-actions roster-team-actions">
              <label className="field-stack"><span>Teams</span><input className="text-field" type="number" min="2" max={parsedParticipants.names.length} step="1" value={teamCount} onChange={(event) => setTeamCount(Math.max(2, Number(event.target.value) || 2))} /></label>
              <button className="secondary-link" type="button" disabled={parsedParticipants.names.length < 2} onClick={assignBalancedTeams}><Shuffle size={16} /> Split into balanced teams</button>
            </div>
          </fieldset>}
          <label className="secondary-link file-button"><Upload size={16} /> Preview participant CSV<input type="file" accept=".csv,text/csv" onChange={(event) => { void previewParticipantsCsv(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          {participantCsvPreview && <section className="csv-option-preview" aria-label="Participant CSV preview">
            <p><strong>{participantCsvPreview.names.length} unique participants</strong>{participantCsvPreview.errors.length > 0 ? ` · ${participantCsvPreview.errors.length} rows need attention` : ""}{participantCsvPreview.blankRows > 0 ? ` · ${participantCsvPreview.blankRows} blank rows skipped` : ""}</p>
            {participantCsvSource && participantCsvSource.inspection.headers.length > 1 && <label className="field-stack"><span>Name column</span><select className="select-field" value={participantNameColumn} onChange={(event) => changeParticipantNameColumn(Number(event.target.value))}>{participantCsvSource.inspection.headers.map((header, index) => <option key={`${index}-${header}`} value={index}>{header}</option>)}</select></label>}
            <p className="muted">Names are read from the selected column. Duplicate names are ignored without regard to capitalization.</p>
            {participantCsvPreview.duplicateCount > 0 && <p className="muted">{participantCsvPreview.duplicateCount} duplicate names found in this file.</p>}
            <ul>{participantCsvPreview.names.slice(0, 6).map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}</ul>
            {participantCsvPreview.names.length > 6 && <p className="muted">And {participantCsvPreview.names.length - 6} more participants.</p>}
            {participantCsvPreview.errors.length > 0 && <ul className="csv-option-errors" aria-label="Invalid participant rows">{participantCsvPreview.errors.slice(0, 4).map((item) => <li key={item.line}>Row {item.line}: {item.message}</li>)}</ul>}
            <p className="muted">Appending will result in {csvAppendedCount} unique participants.</p>
            <div className="hero-actions">
              <button className="primary-link" type="button" disabled={participantCsvPreview.names.length === 0} onClick={() => applyParticipantsCsv("append")}>Append participants</button>
              <button className="secondary-link" type="button" disabled={participantCsvPreview.names.length === 0} onClick={() => applyParticipantsCsv("replace")}>Replace participant list</button>
              <button className="secondary-link" type="button" onClick={() => { setParticipantCsvPreview(null); setParticipantCsvSource(null); }}>Cancel import</button>
            </div>
          </section>}
          <label className="field-stack">
            <span>Format</span>
            <select className="select-field" value={format} onChange={(event) => { invalidatePreview(); setFormat(event.target.value as TournamentFormat); }}>
              <option value="single-elimination">Single elimination</option>
              <option value="double-elimination">Double elimination</option>
              <option value="round-robin">Round robin</option>
            </select>
          </label>
          <label className="field-stack">
            <span>Seeding</span>
            <select className="select-field" value={seeding} onChange={(event) => { invalidatePreview(); setSeeding(event.target.value as TournamentSeeding); }}>
              <option value="entry-order">Use entry order</option>
              <option value="random">Shuffle participants</option>
              <option value="manual">Use manual seat numbers</option>
            </select>
          </label>
          <label className="field-stack">
            <span>Bye handling</span>
            <select className="select-field" value={byePolicy} onChange={(event) => { invalidatePreview(); setByePolicy(event.target.value as TournamentByePolicy); }}>
              <option value="automatic">Auto-advance byes</option>
              <option value="manual">Confirm each bye</option>
            </select>
          </label>
          <p className="muted">Automatic byes advance immediately. Manual byes stay pending until the host confirms the participant is advancing.</p>
          <label className="field-stack">
            <span>Withdrawal handling</span>
            <select className="select-field" value={withdrawalPolicy} onChange={(event) => { invalidatePreview(); setWithdrawalPolicy(event.target.value as TournamentWithdrawalPolicy); }}>
              <option value="advance-opponent">Advance opponents automatically</option>
              <option value="preserve-fixtures">Preserve pending fixtures</option>
            </select>
          </label>
          <p className="muted">Advancing opponents turns affected pending fixtures into byes. Preserving fixtures records the withdrawal without changing the reviewed schedule.</p>
          {format === "single-elimination" && <label className="field-stack">
            <span>Placement matches</span>
            <select className="select-field" value={thirdPlaceMatch ? "third-place" : "championship-only"} onChange={(event) => { invalidatePreview(); setThirdPlaceMatch(event.target.value === "third-place"); }}>
              <option value="championship-only">Championship match only</option>
              <option value="third-place">Add third-place match</option>
            </select>
          </label>}
          {(format === "single-elimination" || format === "double-elimination") && <label className="field-stack"><span>Match series</span><select className="select-field" value={bestOf} onChange={(event) => { invalidatePreview(); setBestOf(Number(event.target.value) as TournamentBestOf); }}><option value="1">Single game</option><option value="3">Best of 3</option><option value="5">Best of 5</option></select></label>}
          {thirdPlaceMatch && parsedParticipants.names.length < 4 && <p className="validation-message" role="alert">A third-place match requires at least four participants.</p>}
          {seeding === "manual" && !manualSeedValid && <p className="validation-message" role="alert">Assign a unique positive seat number to every participant before previewing manual seeds.</p>}
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
          {parsedParticipants.names.length > participantLimit && <p className="validation-message" role="alert">{format === "round-robin" ? "Round robin supports up to 32 participants." : format === "double-elimination" ? "Double elimination supports up to 64 participants." : `This format supports up to ${MAX_TOURNAMENT_PARTICIPANTS} participants.`}</p>}
          {parsedParticipants.duplicateCount > 0 && <p className="muted" role="status">Repeated names are ignored ({parsedParticipants.duplicateCount}).</p>}
          {error && <p className="validation-message" role="alert">{error}</p>}
          <button className="primary-link" type="submit" disabled={!title.trim() || parsedParticipants.names.length < 2 || parsedParticipants.names.length > participantLimit || (format === "round-robin" && !scoringValid) || !manualSeedValid || (thirdPlaceMatch && parsedParticipants.names.length < 4)}>
            <Trophy size={16} /> Preview tournament
          </button>
        </form>
        {preview && <section className="tournament-preview" aria-label="Tournament preview">
          <header className="tournament-preview-header">
            <div><p className="eyebrow">Review before creating</p><h2>{preview.title}</h2><p>{preview.format === "round-robin" ? `Round robin · ${preview.roundRobinTiebreaker === "head-to-head" ? "Head-to-head tiebreak" : "Seed-order tiebreak"} · ${preview.scoring?.winPoints ?? 3}/${preview.scoring?.drawPoints ?? 1}/${preview.scoring?.lossPoints ?? 0} win/draw/loss points` : `${preview.format === "double-elimination" ? "Double elimination" : "Single elimination"} · Best of ${preview.bestOf}`} · {preview.participants.length} participants · {getTournamentProgress(preview).total} matches</p></div>
            <span className="tournament-preview-seeding">{preview.seeding === "random" ? "Random seeding" : preview.seeding === "manual" ? "Manual seat order" : "Entry order"} · {preview.byePolicy === "manual" ? "Manual byes" : "Automatic byes"} · {preview.withdrawalPolicy === "preserve-fixtures" ? "Preserve withdrawals" : "Advance withdrawals"}{preview.thirdPlaceMatch ? " · Third-place match" : ""}</span>
          </header>
          {preview.seeding === "random" && <p className="muted">This shuffled seed order is fixed for this preview and will be used when you create the tournament.</p>}
          <ol className="tournament-preview-seeds" aria-label="Preview seed order">{preview.participants.map((participant) => <li key={participant.id}><span>Seed {participant.seed}</span><strong>{participant.name}</strong>{(participant.group || participant.role || participant.seat) && <small className="muted">{[participant.group, participant.role, participant.seat ? `Seat ${participant.seat}` : ""].filter(Boolean).join(" · ")}</small>}</li>)}</ol>
          <div className="tournament-preview-rounds" aria-label="Preview pairings" tabIndex={0}>
            {preview.rounds.map((round, roundIndex) => <section className="tournament-preview-round" key={round.roundNumber} aria-label={round.label ?? getTournamentRoundLabel(round.roundNumber, preview.rounds.length, preview.format)}>
              <h3>{round.label ?? getTournamentRoundLabel(round.roundNumber, preview.rounds.length, preview.format)}</h3>
              <ul>{round.matches.map((match, matchIndex) => <li className="tournament-preview-match" data-match-id={match.id} key={match.id}><span>Match {match.matchNumber}</span><strong>{describePreviewMatch(preview, roundIndex, matchIndex, match)}</strong></li>)}</ul>
            </section>)}
          </div>
          <div className="hero-actions">
            <button className="primary-link" type="button" onClick={handleCreatePreview}><Trophy size={16} /> Create this tournament</button>
            <button className="secondary-link" type="button" onClick={() => setPreview(createTournamentPreview(title, parsedParticipants.names, seeding, format, roundRobinTiebreaker, scoring, metadataByName, byePolicy, withdrawalPolicy, thirdPlaceMatch, bestOf))}>{seeding === "random" ? "Shuffle and preview again" : "Refresh preview"}</button>
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
                <span>{tournament.format === "round-robin" ? "Round robin" : tournament.format === "double-elimination" ? "Double elimination" : "Single elimination"} · {tournament.participants.length} participants · {progress.played}/{progress.total} matches · {tournament.status === "completed" ? `Champion: ${progress.champion ?? "Tie"}` : "In progress"}</span>
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
