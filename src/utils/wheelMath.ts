import type { VisualMode, Wheel, WheelOption } from "../types";

export type WheelSegment = {
  option: WheelOption;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  percentage: number;
};

const FULL_CIRCLE = Math.PI * 2;
const POINTER_ANGLE_DEGREES = -90;

export function getActiveOptions(options: WheelOption[]): WheelOption[] {
  return options
    .filter((option) => option.isActive && !option.isRemoved && Number.isFinite(option.weight) && option.weight > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function calculateTotalWeight(options: WheelOption[]): number {
  return getActiveOptions(options).reduce((total, option) => total + option.weight, 0);
}

export function calculateOptionChance(
  option: WheelOption,
  options: WheelOption[],
): number {
  const activeOptions = getActiveOptions(options);
  const maxWeight = activeOptions.reduce((max, candidate) => Math.max(max, candidate.weight), 0);

  if (!Number.isFinite(maxWeight) || maxWeight <= 0 || !option.isActive || option.isRemoved || option.weight <= 0) {
    return 0;
  }

  const normalizedTotal = activeOptions.reduce((total, candidate) => total + candidate.weight / maxWeight, 0);
  return (option.weight / maxWeight) / normalizedTotal;
}

export function getSegmentAngles(
  options: WheelOption[],
  visualMode: VisualMode,
): WheelSegment[] {
  const activeOptions = getActiveOptions(options);
  const maxWeight = activeOptions.reduce((max, option) => Math.max(max, option.weight), 0);
  const normalizedTotal = maxWeight > 0
    ? activeOptions.reduce((total, option) => total + option.weight / maxWeight, 0)
    : 0;
  let cursor = -Math.PI / 2;

  if (activeOptions.length === 0) {
    return [];
  }

  return activeOptions.map((option) => {
    const share =
      visualMode === "weighted" && normalizedTotal > 0
        ? (option.weight / maxWeight) / normalizedTotal
        : 1 / activeOptions.length;
    const startAngle = cursor;
    const endAngle = cursor + FULL_CIRCLE * share;
    const segment = {
      option,
      startAngle,
      endAngle,
      midAngle: startAngle + (endAngle - startAngle) / 2,
      percentage: share,
    };

    cursor = endAngle;
    return segment;
  });
}

export function calculateTargetRotation(
  selectedOptionId: string,
  segments: WheelSegment[],
  currentRotationDegrees: number,
  minimumSpins = 6,
  landingOffsetDegrees = 0,
  pointerAngleDegrees = POINTER_ANGLE_DEGREES,
): number {
  const selectedSegment = segments.find(
    (segment) => segment.option.id === selectedOptionId,
  );

  if (!selectedSegment) {
    return currentRotationDegrees;
  }

  const selectedMidpointDegrees = radiansToDegrees(selectedSegment.midAngle) + landingOffsetDegrees;
  const normalizedCurrent = normalizeDegrees(currentRotationDegrees);
  let targetRotation =
    currentRotationDegrees +
    (pointerAngleDegrees - normalizeDegrees(selectedMidpointDegrees + normalizedCurrent));

  while (targetRotation < currentRotationDegrees + minimumSpins * 360) {
    targetRotation += 360;
  }

  return targetRotation;
}

export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function canSpinWheel(wheel: Wheel): boolean {
  return getActiveOptions(wheel.options).length >= 2;
}
