import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Check, Clipboard, RotateCw, Trash2, X } from "lucide-react";
import type { SpinResult } from "../../types";
import { getRarityLabel } from "../../utils/rarity";
import { loadData } from "../../services/storageService";
import { shouldCelebrateResult, shouldSkipSpinAnimation } from "../../utils/celebration";

type ResultModalProps = {
  result: SpinResult | null;
  onClose: () => void;
  onDiscard?: () => void;
  onSpinAgain?: () => void;
  returnFocusRef?: { current: HTMLElement | null };
};

export function ResultModal({ onClose, onDiscard, onSpinAgain, result, returnFocusRef }: ResultModalProps) {
  const isOpen = result !== null;
  const settings = result ? loadData().settings : null;
  const showConfetti = Boolean(result && settings?.confettiEnabled && settings.animationsEnabled &&
    !settings.reducedMotion && !shouldSkipSpinAnimation() && shouldCelebrateResult(result.specialType));
  const titleId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const explicitReturnFocus = returnFocusRef?.current ?? null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      const items = focusable ? Array.from(focusable) : [];
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const returnTarget = explicitReturnFocus ?? previousFocus;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [isOpen, returnFocusRef]);

  if (!result) {
    return null;
  }

  function copyResult() {
    const resultToCopy = result as SpinResult;
    void navigator.clipboard?.writeText(`${resultToCopy.resultLabel} · ${Math.round(resultToCopy.resultChance * 1000) / 10}% chance · weight ${resultToCopy.resultWeight}`)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  }

  return (
    <div className="result-backdrop" role="presentation">
      {showConfetti && <div className="confetti-burst" aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => {
          const style = {
            left: `${(index * 37 + 9) % 100}%`,
            animationDelay: `${(index % 8) * 35}ms`,
            animationDuration: `${900 + (index % 5) * 120}ms`,
            backgroundColor: ["#f59e0b", "#38bdf8", "#10b981", "#f472b6", "#e2e8f0"][index % 5],
          } as CSSProperties;
          return <span className="confetti-piece" key={index} style={style} />;
        })}
      </div>}
      <section
        ref={dialogRef}
        className={`result-modal result-${result.specialType}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button
          ref={closeButtonRef}
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close result"
          title="Close result"
        >
          <X size={18} />
        </button>
        <p className="result-badge">{getRarityLabel(result.specialType)}</p>
        <h2 id={titleId}>{result.resultLabel}</h2>
        <dl className="result-stats">
          <div>
            <dt>Weight</dt>
            <dd>{result.resultWeight}</dd>
          </div>
          <div>
            <dt>Chance</dt>
            <dd>{Math.round(result.resultChance * 1000) / 10}%</dd>
          </div>
        </dl>
        <p className="result-guidance">Choose what should happen to this result.</p>
        <div className="result-actions" aria-label="Result actions">
          <button className="primary-link result-action-keep" type="button" onClick={onClose}><Check size={17} /> Keep result</button>
          {onDiscard && <button className="secondary-link result-action-discard" type="button" onClick={onDiscard}><Trash2 size={16} /> Discard / remove</button>}
          {onSpinAgain && <button className="secondary-link" type="button" onClick={onSpinAgain}><RotateCw size={16} /> Spin again</button>}
          <button className="square-action result-copy-action" type="button" onClick={copyResult} aria-label="Copy result details" title="Copy result details">{copied ? <Check size={16} /> : <Clipboard size={16} />}</button>
        </div>
        <p className="result-footnote">{onDiscard ? "Discarding removes this option from future spins. You can restore it from the wheel controls." : "This result has been saved to history."}</p>
      </section>
    </div>
  );
}
