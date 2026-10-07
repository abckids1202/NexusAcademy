import type { CSSProperties } from "react";

type WheelPointerProps = {
  angleDegrees?: number;
};

export function WheelPointer({ angleDegrees = -90 }: WheelPointerProps) {
  return (
    <div className="wheel-pointer" data-pointer-angle={angleDegrees} style={{ "--pointer-rotation": `${angleDegrees + 90}deg` } as CSSProperties} aria-hidden="true">
      <span />
    </div>
  );
}
