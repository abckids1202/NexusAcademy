import { Link } from "react-router-dom";
import { BookmarkPlus, Copy, Play, Trash2 } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import { deleteChain, duplicateChain } from "../services/chainService";
import { deleteWheel, duplicateWheel } from "../services/wheelService";
import { getTournamentProgress } from "../utils/tournamentLogic";
import { saveChainAsTemplate, saveWheelAsTemplate } from "../services/templateService";
import { useChains } from "../hooks/useChains";
import { useSpinResults } from "../hooks/useSpinResults";
import { useTournaments } from "../hooks/useTournaments";
import { useWheels } from "../hooks/useWheels";

export function DashboardPage() {
  const wheels = useWheels();
  const chains = useChains();
  const spins = useSpinResults();
  const tournaments = useTournaments();
  const recentSpins = spins.slice(0, 6);
  const mostCommon = spins.length
    ? Object.entries(spins.reduce<Record<string, number>>((counts, spin) => {
        counts[spin.resultLabel] = (counts[spin.resultLabel] ?? 0) + 1;
        return counts;
      }, {})).sort((a, b) => b[1] - a[1])[0]
    : undefined;

  function removeWheel(id: string, title: string) {
    if (window.confirm(`Delete “${title}”? This cannot be undone.`)) {
      deleteWheel(id);
    }
  }

  function removeChain(id: string, title: string) {
    if (window.confirm(`Delete “${title}”? Its saved sessions will also be removed.`)) {
      deleteChain(id);
    }
  }

  function saveWheelTemplate(id: string, title: string) {
    const templateTitle = window.prompt("Name this wheel template", title);
    if (!templateTitle?.trim()) return;
    try {
      saveWheelAsTemplate(id, templateTitle);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not save this wheel as a template.");
    }
  }

  function saveChainTemplate(id: string, title: string) {
    const templateTitle = window.prompt("Name this generator template", title);
    if (!templateTitle?.trim()) return;
    try {
      saveChainAsTemplate(id, templateTitle);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not save this generator as a template.");
    }
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description="Pick up a saved wheel or generator, or start something new."
        actions={<div className="hero-actions"><Link className="primary-link" to="/wheels/new">Create wheel</Link><Link className="secondary-link" to="/chains/new">Create chain</Link></div>}
      />
      <section className="metric-strip" aria-label="Workspace overview">
        <div><strong>{wheels.length}</strong><span>Wheels</span></div>
        <div><strong>{chains.length}</strong><span>Chains</span></div>
        <div><strong>{spins.length}</strong><span>Total spins</span></div>
        <div><strong>{mostCommon ? mostCommon[0] : "—"}</strong><span>Most common result</span></div>
      </section>
      <div className="dashboard-grid">
        <ShellCard title="My wheels" description="Your saved wheels, ready to edit or spin.">
          {wheels.length ? <div className="project-list">{wheels.map((wheel) => <article className="project-row" key={wheel.id}>
            <div className="project-copy"><strong>{wheel.title}</strong><span>{wheel.options.filter((option) => option.isActive && !option.isRemoved).length} active options · {wheel.visualMode} slices</span></div>
            <div className="row-actions">
              <Link className="square-action" title={`Spin ${wheel.title}`} aria-label={`Spin ${wheel.title}`} to={`/spin/${wheel.id}`}><Play size={16} /></Link>
              <Link className="square-action" title={`Edit ${wheel.title}`} aria-label={`Edit ${wheel.title}`} to={`/wheels/${wheel.id}/edit`}>Edit</Link>
              <button className="square-action" type="button" title="Save as a reusable template" aria-label={`Save ${wheel.title} as a template`} onClick={() => saveWheelTemplate(wheel.id, wheel.title)}><BookmarkPlus size={16} /></button>
              <button className="square-action" type="button" title="Duplicate wheel" aria-label={`Duplicate ${wheel.title}`} onClick={() => duplicateWheel(wheel.id)}><Copy size={16} /></button>
              <button className="square-action danger-action" type="button" title="Delete wheel" aria-label={`Delete ${wheel.title}`} onClick={() => removeWheel(wheel.id, wheel.title)}><Trash2 size={16} /></button>
            </div>
          </article>)}</div> : <p className="muted">No wheels yet. Create one or start with a template.</p>}
        </ShellCard>
        <ShellCard title="My chains" description="Multi-step generators built from your wheels.">
          {chains.length ? <div className="project-list">{chains.map((chain) => <article className="project-row" key={chain.id}>
            <div className="project-copy"><strong>{chain.title}</strong><span>{chain.steps.length} steps</span></div>
            <div className="row-actions">
              <Link className="square-action" title={`Run ${chain.title}`} aria-label={`Run ${chain.title}`} to={`/chains/${chain.id}/run`}><Play size={16} /></Link>
              <Link className="square-action" title={`Edit ${chain.title}`} aria-label={`Edit ${chain.title}`} to={`/chains/${chain.id}/edit`}>Edit</Link>
              <button className="square-action" type="button" title="Save as a reusable template" aria-label={`Save ${chain.title} as a template`} onClick={() => saveChainTemplate(chain.id, chain.title)}><BookmarkPlus size={16} /></button>
              <button className="square-action" type="button" title="Duplicate chain" aria-label={`Duplicate ${chain.title}`} onClick={() => duplicateChain(chain.id)}><Copy size={16} /></button>
              <button className="square-action danger-action" type="button" title="Delete chain" aria-label={`Delete ${chain.title}`} onClick={() => removeChain(chain.id, chain.title)}><Trash2 size={16} /></button>
            </div>
          </article>)}</div> : <p className="muted">No chains yet. Combine saved wheels into a generator flow.</p>}
        </ShellCard>
      </div>
      <ShellCard title="Tournaments" description="Brackets and round-robin schedules saved on this device.">
        {tournaments.length > 0 ? <div className="project-list">{tournaments.slice(0, 4).map((tournament) => {
          const progress = getTournamentProgress(tournament);
          return <Link className="project-row tournament-list-row" key={tournament.id} to={`/tournaments/${tournament.id}`}>
            <div className="project-copy"><strong>{tournament.title}</strong><span>{tournament.format === "round-robin" ? "Round robin" : "Single elimination"} · {progress.played}/{progress.total} matches · {progress.champion ? `Champion: ${progress.champion}` : tournament.status === "completed" ? "Tied standings" : "In progress"}</span></div>
            <span className="muted">{tournament.participants.length} participants</span>
          </Link>;
        })}</div> : <div className="empty-inline"><p className="muted">No tournaments yet.</p><Link className="secondary-link" to="/tournaments">Create tournament</Link></div>}
      </ShellCard>
      <ShellCard title="Recent spins" description="Latest results across all wheels.">
        {recentSpins.length ? <div className="project-list">{recentSpins.map((spin) => <div className="project-row" key={spin.id}>
          <span className="option-swatch" style={{ background: spin.resultColor }} aria-hidden="true" />
          <div className="project-copy"><strong>{spin.resultLabel}</strong><span>{spin.wheelTitle} · {new Date(spin.createdAt).toLocaleString()}</span></div>
          <strong>{(spin.resultChance * 100).toFixed(1)}%</strong>
        </div>)}</div> : <p className="muted">Spin a wheel to start building your history.</p>}
      </ShellCard>
    </div>
  );
}
