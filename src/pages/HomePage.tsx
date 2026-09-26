import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Dices, Route, Sparkles, Trophy } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { createChainFromTemplate, createWheelFromTemplate } from "../services/templateService";
import { createWheel, createWheelOption } from "../services/wheelService";

export function HomePage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState("");
  const [error, setError] = useState("");

  function startQuickSpin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const labels = entries.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
    if (labels.length < 2) {
      setError("Add at least two entries to spin.");
      return;
    }
    if (labels.length > 100) {
      setError("A quick wheel can contain up to 100 entries.");
      return;
    }

    const wheel = createWheel({
      title: "Quick Choice",
      description: "Created from the WheelForge home page.",
      options: labels.map((label, index) => createWheelOption(label, index)),
    });
    navigate(`/spin/${wheel.id}`);
  }

  function startWheelTemplate(templateId: string) {
    const wheel = createWheelFromTemplate(templateId);
    if (wheel) navigate(`/spin/${wheel.id}`);
  }

  function startChainTemplate(templateId: string) {
    const chain = createChainFromTemplate(templateId);
    if (chain) navigate(`/chains/${chain.id}/run`);
  }

  return <div className="stack home-launchpad">
    <PageHeader
      eyebrow="WheelForge"
      title="What do you want to do?"
      description="Make a quick choice, start from a reusable wheel, build a generator, or organize a tournament."
    />

    <section className="home-launch-grid" aria-label="Start a WheelForge activity">
      <div className="quick-spin-panel">
        <div className="home-section-heading"><Dices size={20} /><h2>Quick spin</h2></div>
        <form className="quick-spin-form" onSubmit={startQuickSpin}>
          <label className="field-stack" htmlFor="quick-spin-entries">
            <span>Entries</span>
            <textarea
              id="quick-spin-entries"
              className="text-field quick-spin-input"
              value={entries}
              onChange={(event) => { setEntries(event.target.value); setError(""); }}
              placeholder={"Pizza\nSushi\nTacos"}
              rows={7}
              required
            />
          </label>
          {error && <p className="validation-message" role="alert">{error}</p>}
          <button className="primary-link" type="submit">Spin these entries <ArrowRight size={17} /></button>
        </form>
      </div>

      <div className="home-workflows">
        <h2>Start a workflow</h2>
        <button className="home-workflow-link" type="button" onClick={() => startWheelTemplate("food-picker")}>
          <span className="home-workflow-icon"><Sparkles size={18} /></span>
          <span><strong>Choose what to eat</strong><small>Food Picker wheel</small></span>
          <ArrowRight size={17} />
        </button>
        <button className="home-workflow-link" type="button" onClick={() => startWheelTemplate("giveaway-prize-wheel")}>
          <span className="home-workflow-icon"><Dices size={18} /></span>
          <span><strong>Run a prize draw</strong><small>Weighted giveaway wheel</small></span>
          <ArrowRight size={17} />
        </button>
        <button className="home-workflow-link" type="button" onClick={() => startWheelTemplate("classroom-picker")}>
          <span className="home-workflow-icon"><Sparkles size={18} /></span>
          <span><strong>Pick a participant</strong><small>Classroom wheel with pick counts</small></span>
          <ArrowRight size={17} />
        </button>
        <button className="home-workflow-link" type="button" onClick={() => startChainTemplate("fantasy-story-generator")}>
          <span className="home-workflow-icon"><Route size={18} /></span>
          <span><strong>Generate a fantasy story</strong><small>Run a connected story prompt</small></span>
          <ArrowRight size={17} />
        </button>
      </div>
    </section>

    <section className="home-more-actions" aria-label="Other ways to start">
      <Link className="home-text-action" to="/wheels/new"><Sparkles size={17} /> Build a custom wheel</Link>
      <Link className="home-text-action" to="/chains/new"><Route size={17} /> Create a generator</Link>
      <Link className="home-text-action" to="/tournaments"><Trophy size={17} /> Set up a tournament</Link>
      <Link className="home-text-action" to="/templates">Browse all templates <ArrowRight size={17} /></Link>
    </section>
  </div>;
}
