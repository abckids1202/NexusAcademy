import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Copy, Download, RotateCcw } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import { ResultModal } from "../components/wheel/ResultModal";
import { SpinButton } from "../components/wheel/SpinButton";
import { WheelCanvas } from "../components/wheel/WheelCanvas";
import { WheelPointer } from "../components/wheel/WheelPointer";
import { getChain } from "../services/chainService";
import { getChainSessions, getSpinResultsForWheel, saveChainSession, saveSpinResult } from "../services/spinService";
import { getWheels } from "../services/wheelService";
import type { ChainSessionResult, SpinResult, Wheel } from "../types";
import { createId } from "../utils/ids";
import { easeOutCubic, createSpinSelection, shouldRemoveWinnerAfterSpin } from "../utils/spinLogic";
import { findNextRunnableStepIndex, resolveChainStep } from "../utils/chainLogic";
import { validateChain } from "../utils/validation";
import { playSpinAudio, prepareSpinAudio, shouldSkipSpinAnimation } from "../utils/celebration";

export function ChainRunnerPage() {
  const { chainId } = useParams();
  const chain = chainId ? getChain(chainId) : undefined;
  const wheels = useMemo(() => getWheels(), []);
  const orderedSteps = useMemo(
    () => [...(chain?.steps ?? [])].sort((a, b) => a.order - b.order),
    [chain],
  );
  const resumableSession = useMemo(
    () => chain ? getChainSessions().find((session) => session.chainId === chain.id && !session.completedAt && session.status !== "abandoned" && session.results.length > 0) : undefined,
    [chain],
  );
  const initialResults = resumableSession?.results ?? [];
  const lastCompletedIndex = initialResults.reduce(
    (lastIndex, result) => Math.max(lastIndex, orderedSteps.findIndex((step) => step.id === result.stepId)),
    -1,
  );
  const initialIndex = resumableSession
    ? findNextRunnableStepIndex(orderedSteps, lastCompletedIndex + 1, initialResults, wheels)
    : 0;
  const initialStep = orderedSteps[initialIndex];
  const validationErrors = useMemo(
    () => chain ? validateChain(chain, wheels) : [],
    [chain, wheels],
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [results, setResults] = useState<ChainSessionResult[]>(initialResults);
  const [removedOptionIdsByWheel, setRemovedOptionIdsByWheel] = useState<Record<string, string[]>>(() => {
    const removed: Record<string, string[]> = {};
    for (const result of initialResults) {
      const wheel = wheels.find((item) => item.id === result.wheelId);
      if (wheel && shouldRemoveWinnerAfterSpin(wheel)) {
        removed[result.wheelId] = [...(removed[result.wheelId] ?? []), result.result.optionId];
      }
    }
    return removed;
  });
  const [currentResult, setCurrentResult] = useState<SpinResult | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string>();
  const [isSpinning, setIsSpinning] = useState(false);
  const spinButtonRef = useRef<HTMLButtonElement | null>(null);
  const [scheduledStepId, setScheduledStepId] = useState<string | null>(
    resumableSession && initialIndex > 0 && initialStep?.autoSpinAfterPrevious ? initialStep.id : null,
  );
  const [feedback, setFeedback] = useState("");
  const animationRef = useRef<number | null>(null);
  const spinActionRef = useRef<() => void>(() => undefined);
  const sessionRef = useRef<{ id: string; startedAt: string } | null>(
    resumableSession ? { id: resumableSession.id, startedAt: resumableSession.startedAt } : null,
  );

  const currentStep = orderedSteps[currentIndex];
  const currentResolution = currentStep
    ? resolveChainStep(currentStep, results, wheels)
    : undefined;
  const resolvedWheel = currentResolution?.status === "ready" ? currentResolution.wheel : undefined;
  const currentWheel: Wheel | undefined = useMemo(
    () => resolvedWheel
      ? {
          ...resolvedWheel,
          options: resolvedWheel.options.map((option) =>
            removedOptionIdsByWheel[resolvedWheel.id]?.includes(option.id)
              ? { ...option, isRemoved: true }
              : option,
          ),
        }
      : undefined,
    [removedOptionIdsByWheel, resolvedWheel],
  );
  const isComplete = orderedSteps.length > 0 && currentIndex >= orderedSteps.length;

  useEffect(() => {
    if (!currentStep || currentResolution?.status !== "skip") return;
    setCurrentIndex(findNextRunnableStepIndex(orderedSteps, currentIndex + 1, results, wheels));
  }, [currentIndex, currentResolution?.status, currentStep, orderedSteps, results, wheels]);

  useEffect(() => {
    setSelectedOptionId(undefined);
  }, [currentIndex]);

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
  }, []);

  const spinCurrentStep = useCallback(() => {
    if (!chain || !currentStep || !currentWheel || isComplete || isSpinning || validationErrors.length > 0) return;
    const lastWheelResult = getSpinResultsForWheel(currentWheel.id)[0];
    const excludedIds = currentWheel.spinMode === "no-repeat" && lastWheelResult
      ? [lastWheelResult.optionId]
      : [];
    const selection = createSpinSelection(currentWheel, rotationDegrees, excludedIds);
    if (!selection) return;

    const startRotation = rotationDegrees;
    const targetRotation = selection.targetRotation;
    const playSound = prepareSpinAudio();
    const skipAnimation = shouldSkipSpinAnimation();
    const durationMs = skipAnimation ? 0 : currentWheel.spinDurationMs;
    const startedAt = performance.now();
    setIsSpinning(true);
    setCurrentResult(null);
    setSelectedOptionId(undefined);

    const animate = (timestamp: number) => {
      const progress = durationMs === 0 ? 1 : Math.min((timestamp - startedAt) / durationMs, 1);
      setRotationDegrees(startRotation + (targetRotation - startRotation) * easeOutCubic(progress));
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const spinResult = saveSpinResult({
        wheelId: currentWheel.id,
        wheelTitle: currentWheel.title,
        optionId: selection.option.id,
        resultLabel: selection.option.label,
        resultColor: selection.option.color,
        resultWeight: selection.option.weight,
        resultChance: selection.chance,
        specialType: selection.option.specialType,
        spinMode: currentWheel.spinMode,
        chainId: chain.id,
        chainStepId: currentStep.id,
      });
      const nextResult: ChainSessionResult = {
        stepId: currentStep.id,
        stepTitle: currentStep.title,
        wheelId: currentWheel.id,
        wheelTitle: currentWheel.title,
        result: spinResult,
      };
      const nextResults = [...results.filter((item) => item.stepId !== currentStep.id), nextResult];
      const nextIndex = findNextRunnableStepIndex(orderedSteps, currentIndex + 1, nextResults, wheels);
      const completed = nextIndex >= orderedSteps.length;
      const started = sessionRef.current ?? { id: createId("session"), startedAt: new Date().toISOString() };
      sessionRef.current = started;
      saveChainSession({
        id: started.id,
        startedAt: started.startedAt,
        chainId: chain.id,
        chainTitle: chain.title,
        results: nextResults,
        status: completed ? "completed" : "in_progress",
        ...(completed ? { completedAt: new Date().toISOString() } : {}),
      });

      if (shouldRemoveWinnerAfterSpin(currentWheel)) {
        setRemovedOptionIdsByWheel((current) => ({
          ...current,
          [currentWheel.id]: [...new Set([...(current[currentWheel.id] ?? []), selection.option.id])],
        }));
      }

      setRotationDegrees(targetRotation);
      setSelectedOptionId(selection.option.id);
      setCurrentResult(spinResult);
      setResults(nextResults);
      setIsSpinning(false);
      setCurrentIndex(nextIndex);
      playSpinAudio(selection.option.specialType, playSound);

      if (!completed) {
        const nextStep = orderedSteps[nextIndex];
        setScheduledStepId(nextStep?.autoSpinAfterPrevious ? nextStep.id : null);
      } else {
        setScheduledStepId(null);
      }
    };

    if (durationMs === 0) animate(startedAt);
    else animationRef.current = requestAnimationFrame(animate);
  }, [chain, currentIndex, currentStep, currentWheel, isComplete, isSpinning, orderedSteps, results, rotationDegrees, validationErrors.length, wheels]);

  spinActionRef.current = spinCurrentStep;

  useEffect(() => {
    if (!scheduledStepId) return;
    const step = orderedSteps.find((item) => item.id === scheduledStepId);
    if (!step) {
      setScheduledStepId(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setScheduledStepId(null);
      if (!document.hidden) spinActionRef.current();
    }, Math.max(0, step.delayBeforeSpinMs));
    return () => window.clearTimeout(timer);
  }, [orderedSteps, scheduledStepId]);

  function resetRun() {
    setCurrentIndex(0);
    setResults([]);
    setCurrentResult(null);
    setScheduledStepId(null);
    setRemovedOptionIdsByWheel({});
    setSelectedOptionId(undefined);
    setRotationDegrees(0);
    sessionRef.current = null;
    setFeedback("");
  }

  function rerunFromStep(stepId: string) {
    const targetIndex = orderedSteps.findIndex((step) => step.id === stepId);
    if (targetIndex < 0) return;
    const retained = results.filter((item) => orderedSteps.findIndex((step) => step.id === item.stepId) < targetIndex);
    setResults(retained);
    const retainedRemoved: Record<string, string[]> = {};
    for (const result of retained) {
      const wheel = wheels.find((item) => item.id === result.wheelId);
      if (wheel && shouldRemoveWinnerAfterSpin(wheel)) {
        retainedRemoved[result.wheelId] = [...(retainedRemoved[result.wheelId] ?? []), result.result.optionId];
      }
    }
    setRemovedOptionIdsByWheel(retainedRemoved);
    setCurrentIndex(targetIndex);
    setScheduledStepId(null);
    setCurrentResult(null);
    setFeedback("");
    if (sessionRef.current && chain) {
      saveChainSession({
        id: sessionRef.current.id,
        startedAt: sessionRef.current.startedAt,
        chainId: chain.id,
        chainTitle: chain.title,
        results: retained,
        status: "in_progress",
      });
    }
  }

  function summaryText() {
    return `${chain?.title ?? "Generator result"}\n\n${results.map((item) => `${item.stepTitle}: ${item.result.resultLabel}`).join("\n")}`;
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText());
      setFeedback("Summary copied.");
    } catch {
      setFeedback("Clipboard access is unavailable in this browser.");
    }
  }

  function exportSummary() {
    const url = URL.createObjectURL(new Blob([summaryText()], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(chain?.title ?? "generator-result").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("Text result exported.");
  }

  if (!chain) {
    return <div className="stack"><PageHeader eyebrow="Chain runner" title="Chain not found" description="Create or choose a saved chain before running a multi-step generator." actions={<Link className="primary-link" to="/chains/new">Create chain</Link>} /></div>;
  }

  const showCurrentResult = currentResult && !scheduledStepId ? currentResult : null;
  const nextPreviewIndex = isComplete ? -1 : findNextRunnableStepIndex(orderedSteps, currentIndex + 1, results, wheels);
  const nextPreview = nextPreviewIndex < orderedSteps.length ? orderedSteps[nextPreviewIndex] : undefined;

  return <div className="stack">
    <PageHeader eyebrow="Chain runner" title={chain.title} description={chain.description || "Run connected wheels and collect a generated result."} />
    {validationErrors.length > 0 && <div className="validation-message" role="alert"><strong>This chain needs attention before it can run</strong><ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul><Link className="secondary-link" to={`/chains/${chain.id}/edit`}>Edit chain</Link></div>}
    <p className="sr-only" role="status" aria-live="polite">
      {currentResult ? `${currentResult.resultLabel} selected for ${orderedSteps.find((step) => step.id === currentResult.chainStepId)?.title ?? "this step"}.` : scheduledStepId ? "The next chain step is spinning automatically." : ""}
    </p>
    <div className="spin-grid">
      <ShellCard title="Current step" description="Spin each step, then continue manually or let configured steps run automatically.">
        <div className="chain-runner-panel">
          <div className="chain-progress-line">Step {isComplete ? orderedSteps.length : Math.min(currentIndex + 1, orderedSteps.length)} of {orderedSteps.length}</div>
          <div className="chain-progress-track"><span style={{ width: `${orderedSteps.length ? (Math.min(currentIndex, orderedSteps.length) / orderedSteps.length) * 100 : 0}%` }} /></div>
          {validationErrors.length > 0 ? <><h2>Chain needs attention</h2><p className="muted">Fix the step issues above, then try again.</p></>
            : currentResolution?.status === "invalid" ? <><h2>Step unavailable</h2><p className="muted">{currentResolution.message}</p></>
              : currentStep && currentWheel && !isComplete ? <>
                <div className="chain-current-heading"><div><h2>{currentStep.title}</h2><p className="muted">{currentWheel.title}{currentResolution?.conditionMatched === false ? " · fallback route" : ""}</p></div><span className="step-number">{currentStep.isRequired ? "Required" : "Optional"}</span></div>
                <div className="wheel-runner">
                  <div className="wheel-stage real-wheel-stage"><WheelPointer /><WheelCanvas wheel={currentWheel} rotationDegrees={rotationDegrees} selectedOptionId={selectedOptionId} /></div>
                  <div className="spin-action-row"><SpinButton buttonRef={spinButtonRef} disabled={isSpinning || validationErrors.length > 0} isSpinning={isSpinning} onClick={spinCurrentStep} /></div>
                </div>
                {currentStep.autoSpinAfterPrevious && <p className="muted">Auto-spin enabled · {currentStep.delayBeforeSpinMs} ms delay after the previous result.</p>}
              </> : <>
                <h2>Chain complete</h2>
                <p className="muted">Your generated result is ready.</p>
                <div className="editor-actions"><button className="secondary-link" type="button" onClick={resetRun}><RotateCcw size={16} /> Rerun chain</button><button className="secondary-link" type="button" onClick={() => void copySummary()}><Copy size={16} /> Copy result</button><button className="secondary-link" type="button" onClick={exportSummary}><Download size={16} /> Export text</button></div>
              </>}
          {nextPreview && !isComplete && currentStep && <p className="chain-next-preview">Next step: <strong>{nextPreview.title}</strong>{nextPreview.autoSpinAfterPrevious ? " · auto" : ""}</p>}
          {feedback && <p className="status-note" role="status">{feedback}</p>}
        </div>
      </ShellCard>
      <ShellCard title="Results so far" description="Every result is written to history and the current chain session as it happens.">
        <div className="chain-result-list" aria-live="polite" aria-relevant="additions text">{results.length > 0 ? results.map((item) => <div className="chain-result-row" key={item.stepId}>
          <div><span>{item.stepTitle}</span><strong>{item.result.resultLabel}</strong></div>
          <button className="square-action" type="button" title={`Rerun from ${item.stepTitle}`} aria-label={`Rerun from ${item.stepTitle}`} onClick={() => rerunFromStep(item.stepId)}><RotateCcw size={15} /></button>
        </div>) : <p className="muted">No chain results yet.</p>}</div>
        {isComplete && results.length > 0 && <div className="final-summary-box">{results.map((item) => <p key={item.stepId}><strong>{item.stepTitle}:</strong> {item.result.resultLabel}</p>)}</div>}
      </ShellCard>
    </div>
    <ResultModal result={showCurrentResult} onClose={() => setCurrentResult(null)} returnFocusRef={spinButtonRef} />
  </div>;
}
