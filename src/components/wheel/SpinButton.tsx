import type { Ref } from "react";
import { RotateCw } from "lucide-react";

type SpinButtonProps = {
  disabled?: boolean;
  isSpinning: boolean;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
};

export function SpinButton({ buttonRef, disabled, isSpinning, onClick }: SpinButtonProps) {
  return (
    <button
      ref={buttonRef}
      className="spin-button"
      disabled={disabled || isSpinning}
      onClick={onClick}
      type="button"
      aria-label={isSpinning ? "Wheel is spinning" : "Spin the wheel"}
    >
      <RotateCw size={24} />
      <span>{isSpinning ? "Spinning" : "Spin"}</span>
    </button>
  );
}
