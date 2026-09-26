import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Copy, Download, RotateCcw, Square, Trash2, Zap } from "lucide-react";
import { PageHeader } from "../components/common/PageHeader";
import { ShellCard } from "../components/common/ShellCard";
import { ResultModal } from "../components/wheel/ResultModal";
import { SpinButton } from "../components/wheel/SpinButton";
import { WheelCanvas } from "../components/wheel/WheelCanvas";
import { WheelPointer } from "../components/wheel/WheelPointer";
import { clearSpinHistory, getSpinResultsForWheel, saveSpinResult, saveUniqueWinnerDraw, undoLatestStandaloneSpin } from "../services/spinService";
import { saveWheel } from "../services/wheelService";
import type { SpinResult } from "../types";
import { useWheels } from "../hooks/useWheels";
import { countAccumulatedSelections, createSpinSelection, drawUniqueWinners, easeOutCubic, getRandomSpinDurationMs, getUniqueWinnerCount, shouldRemoveWinnerAfterSpin } from "../utils/spinLogic";
import { playSpinAudio, prepareSpinAudio, shouldSkipSpinAnimation } from "../utils/celebration";
import { randomUnit } from "../utils/random";
import {
  calculateOptionChance,
  canSpinWheel,
  getActiveOptions,
} from "../utils/wheelMath";

type HistoryDisplayItem = { drawId?: string; results: SpinResult[] };

function groupSpinHistory(history: SpinResult[]): HistoryDisplayItem[] {
  const seenDraws = new Set<string>();
  return history.flatMap((result) => {
    if (!result.drawId) return [{ results: [result] }];
    if (seenDraws.has(result.drawId)) return [];
    seenDraws.add(result.drawId);
    return [{ drawId: result.drawId, results: history
      .filter((item) => item.drawId === result.drawId)
      .sort((a, b) => (a.drawPosition ?? 0) - (b.drawPosition ?? 0)) }];
  });
}

function formatWinnerDraw(results: SpinResult[]): string {
  const title = results[0]?.wheelTitle ?? "WheelForge";
  return [
    `${title} · ${results.length} unique winners · drawn ${results[0]?.createdAt ?? ""}`,
    ...results.map((result, index) => `${index + 1}. ${result.resultLabel} · ${Math.round(result.resultChance * 1000) / 10}% chance at this pick`),
  ].join("\n");
}

export function SpinPage() {
  const { wheelId } = useParams();
  const wheels = useWheels();
  const [selectedWheelId, setSelectedWheelId] = useState<string>(() => {
    const availableWheels = wheels;
    return wheelId ?? availableWheels[0]?.id ?? "";
  });
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [pointerAngleDegrees, setPointerAngleDegrees] = useState(-90);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string>();
  const [currentResult, setCurrentResult] = useState<SpinResult | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [history, setHistory] = useState<SpinResult[]>([]);
  const [winnerCount, setWinnerCount] = useState("2");
  const [historyMessage, setHistoryMessage] = useState("");
  const [autoSpinCount, setAutoSpinCount] = useState("5");
  const [autoSpinActive, setAutoSpinActive] = useState(false);
  const [autoSpinResults, setAutoSpinResults] = useState<SpinResult[]>([]);
  const autoSpinRef = useRef<{ remaining: number; results: SpinResult[] } | null>(null);
  const spinButtonRef = useRef<HTMLButtonElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const selectedWheel = useMemo(
    () => wheels.find((wheel) => wheel.id === selectedWheelId) ?? wheels[0],
    [selectedWheelId, wheels],
  );
  const activeOptions = selectedWheel ? getActiveOptions(selectedWheel.options) : [];
  const uniqueWinnerCount = selectedWheel ? getUniqueWinnerCount(selectedWheel.options) : 0;
  const requestedWinnerCount = Number(winnerCount);
  const validWinnerCount = Number.isInteger(requestedWinnerCount) && requestedWinnerCount >= 1 && requestedWinnerCount <= uniqueWinnerCount;
  const canSpin = selectedWheel ? canSpinWheel(selectedWheel) : false;
  const recentOptionId = history[0]?.optionId;
  const canUndoLatestSpin = Boolean(history[0] && !history[0].chainId);
  const probabilityOptions = selectedWheel?.spinMode === "no-repeat" && recentOptionId
    ? selectedWheel.options.filter((option) => option.id !== recentOptionId)
    : selectedWheel?.options ?? [];
  const accumulationCounts = useMemo(() => countAccumulatedSelections(history), [history]);
  const historyItems = useMemo(() => groupSpinHistory(history), [history]);

  useEffect(() => {
    if (!selectedWheel) {
      return;
    }

    setHistory(getSpinResultsForWheel(selectedWheel.id));
  }, [selectedWheel]);

  useEffect(() => {
    if (isSpinning || !autoSpinActive || !autoSpinRef.current || autoSpinRef.current.remaining <= 0) return;
    const timer = window.setTimeout(() => handleSpin(true), 650);
    return () => window.clearTimeout(timer);
    // handleSpin intentionally uses the latest render after each completed spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpinning, autoSpinActive]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  function handleSpin(isAutomated = false) {
    if (!selectedWheel || !canSpin || isSpinning) {
      return;
    }

    const recentResults = getSpinResultsForWheel(selectedWheel.id);
    const excludedOptionIds = selectedWheel.spinMode === "no-repeat" && recentResults[0]
      ? [recentResults[0].optionId]
      : [];
    const nextPointerAngle = randomUnit() * 360 - 180;
    const selection = createSpinSelection(selectedWheel, rotationDegrees, excludedOptionIds, randomUnit, nextPointerAngle);

    if (!selection) {
      return;
    }

    const startRotation = rotationDegrees;
    const targetRotation = selection.targetRotation;
    const playSound = prepareSpinAudio();
    const skipAnimation = shouldSkipSpinAnimation();
    const durationMs = skipAnimation ? 0 : getRandomSpinDurationMs();
    const startedAt = performance.now();

    setIsSpinning(true);
    setPointerAngleDegrees(nextPointerAngle);
    setSelectedOptionId(undefined);
    setCurrentResult(null);
    setLiveAnnouncement(`${selectedWheel.title} is spinning.`);

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startedAt;
      const progress = durationMs === 0 ? 1 : Math.min(elapsed / durationMs, 1);
      const easedProgress = easeOutCubic(progress);
      const nextRotation =
        startRotation + (targetRotation - startRotation) * easedProgress;

      setRotationDegrees(nextRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const result = saveSpinResult({
        wheelId: selectedWheel.id,
        wheelTitle: selectedWheel.title,
        optionId: selection.option.id,
        resultLabel: selection.option.label,
        resultColor: selection.option.color,
        resultWeight: selection.option.weight,
        resultChance: selection.chance,
        specialType: selection.option.specialType,
        spinMode: selectedWheel.spinMode,
        removedOptionAfterSpin: shouldRemoveWinnerAfterSpin(selectedWheel),
      });

      setRotationDegrees(targetRotation);
      setSelectedOptionId(selection.option.id);
      setIsSpinning(false);
      if (isAutomated && autoSpinRef.current) {
        autoSpinRef.current.results = [...autoSpinRef.current.results, result];
        autoSpinRef.current.remaining -= 1;
        setAutoSpinResults(autoSpinRef.current.results);
        if (autoSpinRef.current.remaining <= 0) {
          autoSpinRef.current = null;
          setAutoSpinActive(false);
          setHistoryMessage(`Auto-spin complete: ${autoSpinResults.length + 1} results collected.`);
        }
      }
      // Automated runs collect quietly; if the user stopped the queue, still reveal the spin in progress.
      setCurrentResult(isAutomated && autoSpinRef.current ? null : result);
      setHistory(getSpinResultsForWheel(selectedWheel.id));
      setLiveAnnouncement(`Spin complete. ${result.resultLabel}, ${Math.round(result.resultChance * 1000) / 10}% chance.`);
      playSpinAudio(selection.option.specialType, playSound);
      if (shouldRemoveWinnerAfterSpin(selectedWheel)) {
        saveWheel({
          ...selectedWheel,
          options: selectedWheel.options.map((option) => option.id === selection.option.id
            ? { ...option, isRemoved: true }
            : option),
        });
      }
    };

    if (durationMs === 0) animate(startedAt);
    else animationRef.current = requestAnimationFrame(animate);
  }

  function startAutoSpin() {
    if (!selectedWheel || !canSpin || isSpinning) return;
    const count = Math.min(25, Math.max(1, Math.floor(Number(autoSpinCount))));
    autoSpinRef.current = { remaining: count, results: [] };
    setAutoSpinResults([]);
    setAutoSpinActive(true);
    handleSpin(true);
  }

  function stopAutoSpin() {
    autoSpinRef.current = null;
    setAutoSpinActive(false);
    setHistoryMessage("Auto-spin will stop after the current result.");
  }

  function restoreRemovedOptions() {
    if (!selectedWheel) return;
    saveWheel({
      ...selectedWheel,
      options: selectedWheel.options.map((option) => ({ ...option, isRemoved: false })),
    });
    setSelectedOptionId(undefined);
  }

  function clearHistory() {
    if (!selectedWheel || !window.confirm(`Clear saved spin history for “${selectedWheel.title}”?`)) return;
    clearSpinHistory(selectedWheel.id);
    setHistory([]);
    setHistoryMessage("");
  }

  function undoLatestSpin() {
    if (!selectedWheel) return;
    const undone = undoLatestStandaloneSpin(selectedWheel.id);
    if (!undone) return;
    setHistory(getSpinResultsForWheel(selectedWheel.id));
    setSelectedOptionId(undefined);
    setCurrentResult(null);
    const announcement = undone.drawId
      ? `Undid the complete ${undone.drawSize}-winner draw.`
      : `Undid the last spin: ${undone.resultLabel}.`;
    setLiveAnnouncement(announcement);
    setHistoryMessage(announcement);
  }

  function discardCurrentResult() {
    if (!selectedWheel || !currentResult) return;
    saveWheel({
      ...selectedWheel,
      options: selectedWheel.options.map((option) => option.id === currentResult.optionId
        ? { ...option, isRemoved: true }
        : option),
    });
    setSelectedOptionId(undefined);
    setCurrentResult(null);
    setHistoryMessage(`${currentResult.resultLabel} was discarded and removed from future spins.`);
  }

  function drawMultipleWinners() {
    if (!selectedWheel || !validWinnerCount || isSpinning) return;
    try {
      const selections = drawUniqueWinners(selectedWheel.options, requestedWinnerCount);
      const results = saveUniqueWinnerDraw(selectedWheel, selections);
      setHistory(getSpinResultsForWheel(selectedWheel.id));
      const announcement = `Drew ${results.length} unique winners without replacement from ${selectedWheel.title}.`;
      setLiveAnnouncement(announcement);
      setHistoryMessage(announcement);
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : "Could not draw winners from this wheel.");
    }
  }

  async function copyWinnerDraw(results: SpinResult[]) {
    try {
      await navigator.clipboard.writeText(formatWinnerDraw(results));
      setHistoryMessage("Winner list copied with each pick’s conditional odds.");
    } catch {
      setHistoryMessage("Could not access the clipboard in this browser.");
    }
  }

  function downloadWinnerDraw(results: SpinResult[]) {
    const blob = new Blob([formatWinnerDraw(results)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const slug = (results[0]?.wheelTitle ?? "wheel").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    anchor.href = url;
    anchor.download = `${slug || "wheel"}-winners.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setHistoryMessage("Winner list downloaded with each pick’s conditional odds.");
  }

  return (
    <div className="stack">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveAnnouncement}</div>
      <PageHeader
        eyebrow="Spin"
        title={selectedWheel?.title ?? "Wheel runner"}
        description={
          selectedWheel?.description ||
          "Spin a saved wheel, land on a real selected result, and save the outcome to history."
        }
      />
      <div className="spin-grid">
        <ShellCard
          title="Wheel canvas"
          description="The result is selected before the animation starts, then the wheel lands on that segment."
        >
          {selectedWheel ? (
            <div className="wheel-runner">
              <div className="wheel-stage real-wheel-stage">
                <WheelPointer angleDegrees={pointerAngleDegrees} />
                <WheelCanvas
                  wheel={selectedWheel}
                  rotationDegrees={rotationDegrees}
                  selectedOptionId={selectedOptionId}
                />
              </div>
              <div className="spin-action-row">
                <SpinButton
                  buttonRef={spinButtonRef}
                  disabled={!canSpin}
                  isSpinning={isSpinning}
                  onClick={handleSpin}
                />
              </div>
              <div className="auto-spin-panel" aria-label="Automatic spin controls">
                <div className="auto-spin-heading"><div><strong><Zap size={16} /> Auto-spin</strong><span>Run repeated spins and collect the results without opening each result modal.</span></div>{autoSpinActive && <span className="auto-spin-status">{autoSpinRef.current?.remaining ?? 0} left</span>}</div>
                <div className="auto-spin-controls">
                  <label className="field-stack"><span>Number of spins</span><input className="number-field" type="number" min="1" max="25" value={autoSpinCount} disabled={autoSpinActive} onChange={(event) => setAutoSpinCount(event.target.value)} /></label>
                  {!autoSpinActive ? <button className="secondary-link" type="button" disabled={!canSpin || isSpinning} onClick={startAutoSpin}><Zap size={16} /> Start auto-spin</button> : <button className="secondary-link danger-link" type="button" onClick={stopAutoSpin}><Square size={15} /> Stop after current</button>}
                </div>
                {autoSpinResults.length > 0 && <div className="auto-spin-results" aria-live="polite"><strong>{autoSpinActive ? "Results so far" : "Auto-spin results"}</strong><ol>{autoSpinResults.map((result, index) => <li key={result.id}><span className="option-swatch" style={{ background: result.resultColor }} aria-hidden="true" /><span>{index + 1}. {result.resultLabel}</span></li>)}</ol></div>}
              </div>
              {!canSpin ? (
                <div className="spin-empty-state">
                  <p className="status-note">{selectedWheel.options.some((option) => option.isRemoved) ? "This wheel is exhausted." : "Add at least two active options to spin."}</p>
                  {selectedWheel.options.some((option) => option.isRemoved) && <button className="secondary-link" type="button" onClick={restoreRemovedOptions}>Restore removed options</button>}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="muted">No wheels found. Demo data will seed on first storage load.</p>
          )}
        </ShellCard>
        <ShellCard
          title="History and settings"
          description="Choose a wheel, preview active odds, and inspect saved spin history."
        >
          <div className="spin-panel">
            <label className="field-label" htmlFor="wheel-select">
              Wheel
            </label>
            <select
              id="wheel-select"
              className="select-field"
              value={selectedWheel?.id ?? ""}
              onChange={(event) => {
                const nextWheel = wheels.find((wheel) => wheel.id === event.target.value);
                setSelectedWheelId(event.target.value);
                setWinnerCount((current) => String(Math.min(Number(current) || 1, Math.max(1, nextWheel ? getUniqueWinnerCount(nextWheel.options) : 1))));
                setSelectedOptionId(undefined);
                setCurrentResult(null);
                setHistoryMessage("");
              }}
            >
              {wheels.map((wheel) => (
                <option key={wheel.id} value={wheel.id}>
                  {wheel.title}
                </option>
              ))}
            </select>

            <div className="probability-list" role="list" aria-label="Options and chances">
              {activeOptions.map((option) => {
                const chance = Math.round(calculateOptionChance(option, probabilityOptions) * 1000) / 10;
                return <div className={`probability-row${selectedWheel?.spinMode === "accumulation" ? " accumulation-row" : ""}`} key={option.id} role="listitem" aria-label={`${option.label}: weight ${option.weight}, ${chance}% chance`}>
                  <span className="option-swatch" style={{ background: option.color }} aria-hidden="true" />
                  <span>{option.label}</span>
                  <strong>{option.weight}</strong>
                  <em>{chance}%</em>
                  {selectedWheel?.spinMode === "accumulation" && <strong className="accumulation-count" aria-label={`${accumulationCounts[option.id] ?? 0} accumulated picks`} title={`${accumulationCounts[option.id] ?? 0} accumulated picks`}>
                    {accumulationCounts[option.id] ?? 0} picks
                  </strong>}
                </div>;
              })}
            </div>

            <section className="winner-draw-panel" aria-label="Draw multiple unique winners">
              <h3>Draw unique winners</h3>
              <p className="muted">Draw without replacement. Repeated labels combine their ticket odds but are eligible only once. This draw does not remove options from the saved wheel.</p>
              <div className="winner-draw-controls">
                <label className="field-stack"><span>Number of winners</span><input aria-label="Number of winners" className="text-field" type="number" min="1" max={uniqueWinnerCount} step="1" value={winnerCount} onChange={(event) => setWinnerCount(event.target.value)} /></label>
                <button className="primary-link" type="button" disabled={!validWinnerCount || isSpinning} onClick={drawMultipleWinners}>Draw {validWinnerCount ? requestedWinnerCount : "unique"} winners</button>
              </div>
              {winnerCount && !validWinnerCount && <p className="validation-message" role="alert">Enter a whole number from 1 to {uniqueWinnerCount}.</p>}
            </section>

            <div className="history-list" aria-live="polite">
              <div className="history-heading"><h3>Recent results</h3><div className="history-actions">{canUndoLatestSpin && <button className="square-action" type="button" title={history[0]?.drawId ? "Undo the latest complete winner draw" : "Undo the latest standalone spin"} aria-label={`${history[0]?.drawId ? "Undo latest winner draw" : "Undo latest spin"} for ${selectedWheel?.title}`} onClick={undoLatestSpin}><RotateCcw size={16} /></button>}{history.length > 0 && <button className="square-action danger-action" type="button" title="Clear this wheel's history and accumulated counts" aria-label={`Clear spin history for ${selectedWheel?.title}`} onClick={clearHistory}><Trash2 size={16} /></button>}</div></div>
              {historyMessage && <p className="status-note" role="status">{historyMessage}</p>}
              {historyItems.length > 0 ? (
                historyItems.slice(0, 8).map((item) => {
                  const first = item.results[0];
                  if (item.drawId) return <section className="winner-draw-history" key={item.drawId} aria-label={`${item.results.length} unique winners from ${first.wheelTitle}`}>
                    <header><strong>{item.results.length} unique winners</strong><time dateTime={first.createdAt}>{new Date(first.createdAt).toLocaleTimeString()}</time></header>
                    <ol>{item.results.map((result) => <li key={result.id}>
                      <span className="option-swatch" style={{ background: result.resultColor }} aria-hidden="true" />
                      <span>{result.resultLabel}</span>
                      <em>{Math.round(result.resultChance * 1000) / 10}% at pick {result.drawPosition}</em>
                    </li>)}</ol>
                    <div className="history-actions">
                      <button className="square-action" type="button" title="Copy winner list" aria-label={`Copy winner list for ${first.wheelTitle}`} onClick={() => void copyWinnerDraw(item.results)}><Copy size={16} /></button>
                      <button className="square-action" type="button" title="Download winner list" aria-label={`Download winner list for ${first.wheelTitle}`} onClick={() => downloadWinnerDraw(item.results)}><Download size={16} /></button>
                    </div>
                  </section>;
                  const result = first;
                  return <div className="history-row" key={result.id}>
                    <span className="option-swatch" style={{ background: result.resultColor }} />
                    <span>{result.resultLabel}</span>
                    <em>{new Date(result.createdAt).toLocaleTimeString()}</em>
                  </div>;
                })
              ) : (
                <p className="muted">No spins yet for this wheel.</p>
              )}
            </div>
          </div>
        </ShellCard>
      </div>
      <ResultModal
        result={currentResult}
        onClose={() => setCurrentResult(null)}
        onDiscard={discardCurrentResult}
        onSpinAgain={() => { setCurrentResult(null); handleSpin(); }}
        returnFocusRef={spinButtonRef}
      />
    </div>
  );
}
