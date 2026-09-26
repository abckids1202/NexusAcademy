import type { CSSProperties } from "react";

type WheelPointerProps = {
  angleDegrees?: number;
};

export function WheelPointer({ angleDegrees = -90 }: WheelPointerProps) {
  return (
    <div className="wheel-pointer" style={{ "--pointer-rotation": `${angleDegrees + 90}deg` } as CSSProperties} aria-hidden="true">
      <span />
    </div>
  );
}
