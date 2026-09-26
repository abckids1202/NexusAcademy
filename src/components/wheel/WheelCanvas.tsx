import { useEffect, useMemo, useRef } from "react";
import type { Wheel } from "../../types";
import { getReadableTextColor, getWheelDisplayColor } from "../../utils/colors";
import { degreesToRadians, getSegmentAngles } from "../../utils/wheelMath";

type WheelCanvasProps = {
  wheel: Wheel;
  rotationDegrees: number;
  selectedOptionId?: string;
};

const CANVAS_SIZE = 760;

export function WheelCanvas({
  rotationDegrees,
  selectedOptionId,
  wheel,
}: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const segments = useMemo(
    () => getSegmentAngles(wheel.options, wheel.visualMode),
    [wheel.options, wheel.visualMode],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const center = CANVAS_SIZE / 2;
    const radius = center - 26;

    context.save();
    context.translate(center, center);
    context.rotate(degreesToRadians(rotationDegrees));

    for (const segment of segments) {
      const isSelected = segment.option.id === selectedOptionId;

      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, segment.startAngle, segment.endAngle);
      context.closePath();
      context.fillStyle = getWheelDisplayColor(segment.option.color);
      context.fill();

      context.lineWidth = isSelected ? 8 : 4;
      context.strokeStyle = isSelected
        ? "rgba(248, 250, 252, 0.95)"
        : "rgba(2, 6, 23, 0.7)";
      context.shadowColor = isSelected ? "rgba(248, 250, 252, 0.35)" : "rgba(2, 6, 23, 0.26)";
      context.shadowBlur = isSelected ? 12 : 3;
      context.stroke();
      context.shadowBlur = 0;

      drawSegmentLabel(context, segment, radius);
    }

    context.restore();

    drawWheelDetails(context, center, radius);

    context.beginPath();
    context.arc(center, center, radius + 5, 0, Math.PI * 2);
    context.lineWidth = 12;
    context.strokeStyle = "rgba(248, 250, 252, 0.78)";
    context.stroke();

    context.beginPath();
    context.arc(center, center, 82, 0, Math.PI * 2);
    const hubGradient = context.createRadialGradient(center - 16, center - 18, 8, center, center, 84);
    hubGradient.addColorStop(0, "#263455");
    hubGradient.addColorStop(0.65, "#111a32");
    hubGradient.addColorStop(1, "#070b18");
    context.fillStyle = hubGradient;
    context.fill();
    context.lineWidth = 8;
    context.strokeStyle = "rgba(248, 250, 252, 0.9)";
    context.stroke();

    context.fillStyle = "#f8fafc";
    context.font = "800 24px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("WheelForge", center, center);
  }, [rotationDegrees, segments, selectedOptionId]);

  return (
    <canvas
      ref={canvasRef}
      className="wheel-canvas"
      role="img"
      aria-label={`${wheel.title} spin wheel. ${wheel.options.filter((option) => option.isActive && !option.isRemoved).length} active options. See the options and chances list below.`}
    >
      Wheel visual for {wheel.title}. The options and chances are listed below.
    </canvas>
  );
}

function drawWheelDetails(context: CanvasRenderingContext2D, center: number, radius: number) {
  context.save();
  context.translate(center, center);
  context.lineCap = "round";

  context.beginPath();
  context.arc(0, 0, radius - 13, -Math.PI * 0.82, -Math.PI * 0.18);
  context.strokeStyle = "rgba(255, 255, 255, 0.32)";
  context.lineWidth = 5;
  context.stroke();

  for (let index = 0; index < 24; index += 1) {
    const angle = (Math.PI * 2 * index) / 24;
    const inner = radius + 9;
    const outer = radius + (index % 3 === 0 ? 18 : 14);
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    context.strokeStyle = index % 3 === 0 ? "rgba(248, 199, 106, 0.8)" : "rgba(248, 250, 252, 0.34)";
    context.lineWidth = index % 3 === 0 ? 3 : 2;
    context.stroke();
  }

  context.restore();
}

function drawSegmentLabel(
  context: CanvasRenderingContext2D,
  segment: ReturnType<typeof getSegmentAngles>[number],
  radius: number,
) {
  const segmentSize = segment.endAngle - segment.startAngle;

  if (segmentSize < 0.14) {
    return;
  }

  const label = segment.option.label;
  const trimmedLabel = label.length > 24 ? `${label.slice(0, 22)}...` : label;
  const labelRadius = radius * 0.66;

  context.save();
  context.rotate(segment.midAngle);
  context.translate(labelRadius, 0);
  context.rotate(Math.PI / 2);
  context.fillStyle = getReadableTextColor(getWheelDisplayColor(segment.option.color));
  context.font = "800 22px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(15, 23, 42, 0.45)";
  context.shadowBlur = 5;
  context.fillText(trimmedLabel, 0, 0);
  context.restore();
}
