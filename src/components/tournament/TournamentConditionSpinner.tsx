import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { TournamentConditionDraw, Wheel } from "../../types";
import { createSpinSelection, easeOutCubic } from "../../utils/spinLogic";
import { canSpinWheel } from "../../utils/wheelMath";
import { shouldSkipSpinAnimation } from "../../utils/celebration";
import { SpinButton } from "../wheel/SpinButton";
import { WheelCanvas } from "../wheel/WheelCanvas";
import { WheelPointer } from "../wheel/WheelPointer";

type TournamentConditionSpinnerProps = {
  wheels: Wheel[];
  previousDraw?: TournamentConditionDraw;
  onDraw: (draw: TournamentConditionDraw) => void;
  onClose: () => void;
};

export function TournamentConditionSpinner({ wheels, previousDraw, onDraw, onClose }: TournamentConditionSpinnerProps) {
  const usableWheels = wheels.filter(canSpinWheel);
  const [wheelId, setWheelId] = useState(() => usableWheels[0]?.id ?? "");
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string>();
  const [isSpinning, setIsSpinning] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const animationRef = useRef<number | null>(null);
  const spinButtonRef = useRef<HTMLButtonElement | null>(null);
  const wheel = usableWheels.find((item) => item.id === wheelId);

  useEffect(() => () => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
  }, []);

  function spin() {
    if (!wheel || isSpinning || !canSpinWheel(wheel)) return;
    const selection = createSpinSelection(wheel, rotationDegrees);
    if (!selection) {
      setError("This wheel has no eligible options.");
      return;
    }

    const startRotation = rotationDegrees;
    const durationMs = shouldSkipSpinAnimation() ? 0 : wheel.spinDurationMs;
    const startedAt = performance.now();
    setIsSpinning(true);
    setSelectedOptionId(undefined);
    setError("");
    setAnnouncement(`${wheel.title} is spinning to choose a match condition.`);

    const animate = (timestamp: number) => {
      const progress = durationMs === 0 ? 1 : Math.min((timestamp - startedAt) / durationMs, 1);
      setRotationDegrees(startRotation + (selection.targetRotation - startRotation) * easeOutCubic(progress));
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      setRotationDegrees(selection.targetRotation);
      setSelectedOptionId(selection.option.id);
      setIsSpinning(false);
      const draw: TournamentConditionDraw = {
        wheelId: wheel.id,
        wheelTitle: wheel.title,
        optionId: selection.option.id,
        optionLabel: selection.option.label,
        optionColor: selection.option.color,
        optionWeight: selection.option.weight,
        optionChance: selection.chance,
        createdAt: new Date().toISOString(),
      };
      onDraw(draw);
      setAnnouncement(`Match condition selected: ${draw.optionLabel}, ${Math.round(draw.optionChance * 1000) / 10}% chance. Winner must be recorded separately.`);
    };

    if (durationMs === 0) animate(startedAt);
    else animationRef.current = requestAnimationFrame(animate);
  }

  return <section className="condition-spinner" aria-label="Match condition wheel">
    <div className="condition-spinner-heading">
      <div><h3>Spin for a match condition</h3><p>Chooses a map, challenge, or rule only. It does not select the match winner.</p><p>Uses active options and weights, but not standalone no-repeat/removal behavior. It leaves the saved wheel and spin history unchanged.</p></div>
      <button className="square-action" type="button" aria-label="Close condition wheel" onClick={onClose} disabled={isSpinning}><X size={16} /></button>
    </div>
    {usableWheels.length > 0 ? <>
      <label className="field-stack condition-wheel-select"><span>Condition wheel</span><select className="select-field" value={wheelId} onChange={(event) => { setWheelId(event.target.value); setRotationDegrees(0); setSelectedOptionId(undefined); }} disabled={isSpinning}>
        {usableWheels.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>
      <div className="condition-spinner-content">
        <div className="condition-wheel-stage">
          <WheelPointer />
          {wheel && <WheelCanvas wheel={wheel} rotationDegrees={rotationDegrees} selectedOptionId={selectedOptionId} />}
        </div>
        <div className="condition-spinner-actions">
          <SpinButton buttonRef={spinButtonRef} isSpinning={isSpinning} onClick={spin} />
          {previousDraw && <p className="muted">Previous draw: {previousDraw.optionLabel}</p>}
          {error && <p role="alert" className="validation-message">{error}</p>}
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </> : <p className="muted">Create a wheel with at least two active options to draw a condition. <Link to="/wheels/new">Create wheel</Link></p>}
  </section>;
}
