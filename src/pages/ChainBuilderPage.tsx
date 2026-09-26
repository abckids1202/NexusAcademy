import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import {
  createChain,
  createChainStep,
  getChain,
  saveChain,
} from "../services/chainService";
import { useWheels } from "../hooks/useWheels";
import type { SpinChain, SpinChainStep } from "../types";
import { validateChain } from "../utils/validation";
import { useDataRevision } from "../hooks/useDataRevision";

type ChainBuilderPageProps = {
  mode: "create" | "edit";
};

export function ChainBuilderPage({ mode }: ChainBuilderPageProps) {
  useDataRevision();
  const navigate = useNavigate();
  const { chainId } = useParams();
  const isCreate = mode === "create";
  const wheels = useWheels();
  const existingChain = !isCreate && chainId ? getChain(chainId) : undefined;
  const [chain, setChain] = useState<SpinChain>(() => {
    const now = new Date().toISOString();

    return (
      existingChain ?? {
        id: "draft-chain",
        title: "",
        description: "",
        steps: wheels[0]
          ? [
              createChainStep("draft-chain", "Step 1", wheels[0].id, 0),
            ]
          : [],
        createdAt: now,
        updatedAt: now,
      }
    );
  });
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(() => existingChain?.updatedAt);
  const [saveError, setSaveError] = useState("");
  const validationErrors = useMemo(() => validateChain(chain, wheels), [chain, wheels]);
  const hasStaleDraft = !isCreate && baseUpdatedAt !== undefined && existingChain?.updatedAt !== baseUpdatedAt;

  function updateStep(stepId: string, updates: Partial<SpinChainStep>) {
    setChain((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step,
      ),
    }));
  }

  function addStep() {
    if (!wheels[0]) {
      return;
    }

    setChain((current) => ({
      ...current,
      steps: [
        ...current.steps,
        createChainStep(
          current.id,
          `Step ${current.steps.length + 1}`,
          wheels[0].id,
          current.steps.length,
        ),
      ],
    }));
  }

  function deleteStep(stepId: string) {
    setChain((current) => ({
      ...current,
      steps: current.steps
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index })),
    }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= chain.steps.length) return;
    setChain((current) => {
      const steps = [...current.steps];
      [steps[index], steps[destination]] = [steps[destination], steps[index]];
      return { ...current, steps: steps.map((step, order) => ({ ...step, order })) };
    });
  }

  function handleSave(asCopy = false) {
    if (validationErrors.length > 0) return;
    const normalizedSteps = chain.steps.map((step, index) => ({
      ...step,
      title: step.title.trim() || `Step ${index + 1}`,
      order: index,
    }));
    try {
      const savedChain = isCreate || asCopy
        ? createChain({
            title: asCopy ? `${chain.title.trim() || "Untitled Generator"} (copy)` : chain.title.trim(),
            description: chain.description,
            steps: asCopy
              ? normalizedSteps.map((step, index) => createChainStep("copy", step.title, step.wheelId, index, { ...step, id: undefined }))
              : normalizedSteps,
          })
        : saveChain({ ...chain, title: chain.title.trim(), steps: normalizedSteps }, baseUpdatedAt);
      navigate(`/chains/${savedChain.id}/run`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save this generator.");
    }
  }

  function reloadLatest() {
    if (!existingChain) {
      navigate("/dashboard");
      return;
    }
    setChain(existingChain);
    setBaseUpdatedAt(existingChain.updatedAt);
    setSaveError("");
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow={isCreate ? "New chain" : "Edit chain"}
        title={isCreate ? "Create a generator chain" : "Edit generator chain"}
        description="Build multi-step flows by assigning wheels to ordered steps."
        actions={
          <button className="primary-link" type="button" onClick={() => handleSave()} disabled={validationErrors.length > 0 || hasStaleDraft}>
            Save chain
          </button>
        }
      />
      {hasStaleDraft && <div className="validation-message" role="alert">
        <strong>This generator changed in another tab.</strong>
        <p>Your draft is still here. Reload the latest version or save this draft as a separate generator.</p>
        <div className="hero-actions">
          {existingChain && <button className="secondary-link" type="button" onClick={reloadLatest}>Reload latest version</button>}
          <button className="secondary-link" type="button" onClick={() => handleSave(true)} disabled={validationErrors.length > 0}>Save draft as a new generator</button>
        </div>
      </div>}
      {saveError && !hasStaleDraft && <div className="validation-message" role="alert">{saveError}</div>}
      {validationErrors.length > 0 && <div className="validation-message" role="alert"><strong>Before saving</strong><ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <ShellCard title="Chain details" description="Name the flow and choose which saved wheel runs at each step.">
        <div className="form-grid">
          <label className="field-stack">
            <span>Title</span>
            <input
              className="text-field"
              value={chain.title}
              onChange={(event) =>
                setChain((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Fantasy Story Generator"
            />
          </label>
          <label className="field-stack">
            <span>Description</span>
            <textarea
              className="text-field"
              value={chain.description}
              onChange={(event) =>
                setChain((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="What this chain creates"
            />
          </label>
        </div>
      </ShellCard>
      <ShellCard title="Chain steps" description="Set each step's wheel, run behavior, and optional result-based route.">
        {wheels.length === 0 ? (
          <p className="muted">Create at least one wheel before building a chain.</p>
        ) : (
          <div className="chain-step-list">
            {chain.steps.map((step, index) => (
              <div className="chain-step-row" key={step.id}>
                <span className="step-number">{index + 1}</span>
                <input
                  className="text-field"
                  aria-label={`Step ${index + 1} title`}
                  value={step.title}
                  onChange={(event) =>
                    updateStep(step.id, { title: event.target.value })
                  }
                />
                <select
                  className="select-field"
                  aria-label={`Wheel for step ${index + 1}`}
                  value={step.wheelId}
                  onChange={(event) =>
                    updateStep(step.id, { wheelId: event.target.value })
                  }
                >
                  {wheels.map((wheel) => (
                    <option key={wheel.id} value={wheel.id}>
                      {wheel.title}
                    </option>
                  ))}
                </select>
                <label className="mini-toggle">
                  <input
                    checked={step.autoSpinAfterPrevious}
                    type="checkbox"
                    onChange={(event) =>
                      updateStep(step.id, {
                        autoSpinAfterPrevious: event.target.checked,
                      })
                    }
                  />
                  <span>Auto after previous</span>
                </label>
                <label className="mini-toggle">
                  <input
                    checked={step.isRequired}
                    type="checkbox"
                    onChange={(event) => updateStep(step.id, { isRequired: event.target.checked })}
                  />
                  <span>Required</span>
                </label>
                <div className="step-order-actions">
                  <button className="square-action" type="button" aria-label={`Move ${step.title} up`} title="Move up" disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUp size={15} /></button>
                  <button className="square-action" type="button" aria-label={`Move ${step.title} down`} title="Move down" disabled={index === chain.steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown size={15} /></button>
                </div>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => deleteStep(step.id)}
                  disabled={chain.steps.length <= 1}
                >
                  Delete
                </button>
                <details className="step-advanced">
                  <summary>Conditional route and timing</summary>
                  <div className="step-advanced-grid">
                    <label className="field-stack"><span>Run condition</span>
                      <select className="select-field" value={step.conditionType ?? "always"} onChange={(event) => updateStep(step.id, { conditionType: event.target.value as SpinChainStep["conditionType"] })}>
                        <option value="always">Always run</option>
                        <option value="equals">Previous result equals</option>
                        <option value="notEquals">Previous result does not equal</option>
                        <option value="contains">Previous result contains</option>
                      </select>
                    </label>
                    {step.conditionType && step.conditionType !== "always" && <>
                      <label className="field-stack"><span>Based on step</span>
                        <select className="select-field" value={step.dependsOnStepId ?? ""} onChange={(event) => updateStep(step.id, { dependsOnStepId: event.target.value })}>
                          <option value="">Choose an earlier step</option>
                          {chain.steps.slice(0, index).map((previous) => <option key={previous.id} value={previous.id}>{previous.title}</option>)}
                        </select>
                      </label>
                      <label className="field-stack"><span>Comparison value</span><input className="text-field" value={step.dependsOnResultValue ?? ""} onChange={(event) => updateStep(step.id, { dependsOnResultValue: event.target.value })} placeholder="The result label to compare" /></label>
                      <label className="field-stack"><span>Fallback wheel when condition is false</span>
                        <select className="select-field" value={step.fallbackWheelId ?? ""} onChange={(event) => updateStep(step.id, { fallbackWheelId: event.target.value || undefined })}>
                          <option value="">Skip this step when false</option>
                          {wheels.map((wheel) => <option key={wheel.id} value={wheel.id}>{wheel.title}</option>)}
                        </select>
                      </label>
                    </>}
                    {step.autoSpinAfterPrevious && <label className="field-stack"><span>Delay before spin (ms)</span><input className="text-field" type="number" min="0" step="100" value={step.delayBeforeSpinMs} onChange={(event) => updateStep(step.id, { delayBeforeSpinMs: Math.max(0, Number(event.target.value) || 0) })} /></label>}
                  </div>
                  {step.conditionType && step.conditionType !== "always" && <p className="muted">The selected wheel runs when the comparison matches. Otherwise the fallback wheel runs, or this step is skipped.</p>}
                </details>
              </div>
            ))}
          </div>
        )}
        <div className="editor-actions">
          <button
            className="secondary-link"
            type="button"
            onClick={addStep}
            disabled={wheels.length === 0}
          >
            Add step
          </button>
          <button className="primary-link" type="button" onClick={() => handleSave()} disabled={validationErrors.length > 0 || hasStaleDraft}>
            Save chain
          </button>
          <Link className="secondary-link" to="/dashboard">
            Cancel
          </Link>
        </div>
      </ShellCard>
    </div>
  );
}
