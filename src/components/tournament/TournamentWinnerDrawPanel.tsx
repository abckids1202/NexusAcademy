import { useEffect, useMemo, useState } from "react";
import { Ticket, Undo2 } from "lucide-react";
import type { Tournament } from "../../types";

type TournamentWinnerDrawPanelProps = {
  tournament: Tournament;
  onDraw: (entrants: Array<{ participantId: string; tickets: number }>, winnerCount: number) => void;
  onUndo: () => void;
};

function formatChance(chance: number): string {
  return `${(chance * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function TournamentWinnerDrawPanel({ tournament, onDraw, onUndo }: TournamentWinnerDrawPanelProps) {
  const participantKey = tournament.participants.map((participant) => participant.id).join("|");
  const [isOpen, setIsOpen] = useState(false);
  const [eligibleIds, setEligibleIds] = useState<Set<string>>(() => new Set(tournament.participants.map((participant) => participant.id)));
  const [tickets, setTickets] = useState<Record<string, string>>(() => Object.fromEntries(tournament.participants.map((participant) => [participant.id, "1"])));
  const [winnerCount, setWinnerCount] = useState("1");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const participantIds = participantKey.split("|").filter(Boolean);
    setEligibleIds(new Set(participantIds));
    setTickets((current) => Object.fromEntries(participantIds.map((participantId) => [participantId, current[participantId] ?? "1"])));
  }, [participantKey]);

  const pool = useMemo(() => tournament.participants.flatMap((participant) => {
    if (!eligibleIds.has(participant.id)) return [];
    const count = Number(tickets[participant.id] ?? "1");
    return [{ participant, tickets: count }];
  }), [eligibleIds, tickets, tournament.participants]);
  const totalTickets = pool.reduce((total, entrant) => total + (Number.isInteger(entrant.tickets) && entrant.tickets > 0 ? entrant.tickets : 0), 0);
  const parsedWinnerCount = Number(winnerCount);
  const validWinnerCount = Number.isInteger(parsedWinnerCount) && parsedWinnerCount >= 1 && parsedWinnerCount <= pool.length;
  const validTickets = pool.every(({ tickets: count }) => Number.isInteger(count) && count >= 1 && count <= 10000);
  const latestEvent = tournament.events.at(-1);
  const latestDraw = [...tournament.events].reverse().find((event) => event.type === "winner-drawn" && event.winnerDraw);
  const isLatestDraw = latestEvent?.type === "winner-drawn" && latestEvent.id === latestDraw?.id;
  const isLatestUndo = Boolean(latestDraw && tournament.events.some((event) => event.type === "winner-draw-undone" && event.relatedEventId === latestDraw.id));

  function toggleEntrant(participantId: string, checked: boolean) {
    setEligibleIds((current) => {
      const next = new Set(current);
      if (checked) next.add(participantId);
      else next.delete(participantId);
      return next;
    });
    setMessage("");
  }

  function draw() {
    if (pool.length < 2 || !validTickets || !validWinnerCount) return;
    onDraw(pool.map(({ participant, tickets: count }) => ({ participantId: participant.id, tickets: count })), parsedWinnerCount);
    setIsOpen(false);
    setMessage("");
  }

  return <div className="winner-draw-panel">
    <p><strong>Chance-based draw only.</strong> This does not determine a played match or change standings. Winners are drawn without replacement; tickets affect only this draw.</p>
    <div className="hero-actions">
      <button className="secondary-link" type="button" aria-expanded={isOpen} onClick={() => setIsOpen((current) => !current)}>
        <Ticket size={16} /> {isOpen ? "Close draw setup" : "Set up chance-based draw"}
      </button>
    </div>
    {isOpen && <div className="tournament-winner-draw-setup">
      <fieldset className="tournament-draw-entrants">
        <legend>Review eligible participants and ticket odds</legend>
        {tournament.participants.map((participant) => {
          const count = Number(tickets[participant.id] ?? "1");
          const chance = totalTickets > 0 && Number.isInteger(count) && count > 0 ? count / totalTickets : 0;
          return <div className="tournament-draw-entrant" key={participant.id}>
            <label><input type="checkbox" checked={eligibleIds.has(participant.id)} onChange={(event) => toggleEntrant(participant.id, event.target.checked)} /><span>{participant.name}</span></label>
            <label><span>Tickets</span><input aria-label={`Tickets for ${participant.name}`} className="text-field" type="number" min="1" max="10000" step="1" disabled={!eligibleIds.has(participant.id)} value={tickets[participant.id] ?? "1"} onChange={(event) => { setTickets((current) => ({ ...current, [participant.id]: event.target.value })); setMessage(""); }} /></label>
            <strong>{eligibleIds.has(participant.id) ? formatChance(chance) : "Not entered"}</strong>
          </div>;
        })}
      </fieldset>
      <div className="winner-draw-controls">
        <label className="field-stack"><span>Number of winners</span><input aria-label="Tournament draw winner count" className="text-field" type="number" min="1" max={pool.length} step="1" value={winnerCount} onChange={(event) => setWinnerCount(event.target.value)} /></label>
        <button className="primary-link" type="button" onClick={draw} disabled={pool.length < 2 || !validTickets || !validWinnerCount}><Ticket size={16} /> Draw {validWinnerCount ? `${parsedWinnerCount} winner${parsedWinnerCount === 1 ? "" : "s"}` : "winners"}</button>
      </div>
      <p className="muted">{pool.length} eligible · {totalTickets} total tickets · no participant can win more than once in this draw.</p>
      {pool.length < 2 && <p className="validation-message" role="alert">Select at least two eligible participants.</p>}
      {!validTickets && <p className="validation-message" role="alert">Each eligible participant needs 1 to 10,000 whole tickets.</p>}
      {winnerCount && !validWinnerCount && pool.length >= 1 && <p className="validation-message" role="alert">Enter a whole number from 1 to {pool.length}.</p>}
      {message && <p className="validation-message" role="alert">{message}</p>}
    </div>}
    {latestDraw?.winnerDraw && <section className="winner-draw-history" aria-label="Latest tournament chance draw">
      <header><strong>{isLatestUndo ? "Chance draw undone" : "Chance draw result"}</strong><time dateTime={latestDraw.createdAt}>{new Date(latestDraw.createdAt).toLocaleString()}</time></header>
      <p className="muted">Recorded as a random draw, not a match result. {latestDraw.winnerDraw.entrants.length} entrants · {latestDraw.winnerDraw.entrants.reduce((sum, entrant) => sum + entrant.tickets, 0)} tickets · without replacement.</p>
      <ol>{latestDraw.winnerDraw.winnerIds.map((winnerId, index) => {
        const entrant = latestDraw.winnerDraw!.entrants.find((item) => item.participantId === winnerId);
        return <li key={winnerId}><span>{index + 1}.</span><strong>{entrant?.participantName ?? "Unknown participant"}</strong><em>{formatChance(latestDraw.winnerDraw!.winnerChances[index])} at this pick</em></li>;
      })}</ol>
      {isLatestDraw && <button className="secondary-link" type="button" onClick={onUndo}><Undo2 size={16} /> Undo this draw</button>}
    </section>}
  </div>;
}
