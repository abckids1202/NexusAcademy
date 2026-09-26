import type { SpinResult, Wheel, WheelOption } from "../types";
import {
  calculateOptionChance,
  calculateTargetRotation,
  getActiveOptions,
  getSegmentAngles,
} from "./wheelMath";
import { getSpecialAnimationType } from "./rarity";
import { randomUnit } from "./random";

export const MIN_REALISTIC_SPIN_DURATION_MS = 10_000;
export const MAX_REALISTIC_SPIN_DURATION_MS = 15_000;

export function getRandomSpinDurationMs(random: () => number = randomUnit): number {
  return MIN_REALISTIC_SPIN_DURATION_MS + Math.floor(random() * (MAX_REALISTIC_SPIN_DURATION_MS - MIN_REALISTIC_SPIN_DURATION_MS + 1));
}

export type SpinSelection = {
  option: WheelOption;
  chance: number;
  targetRotation: number;
};

export type UniqueWinnerSelection = {
  option: WheelOption;
  chance: number;
};

function normalizeWinnerLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function getUniqueWinnerCount(options: WheelOption[]): number {
  return new Set(getActiveOptions(options).map((option) => normalizeWinnerLabel(option.label))).size;
}

export function drawUniqueWinners(
  options: WheelOption[],
  count: number,
  random: () => number = randomUnit,
): UniqueWinnerSelection[] {
  const maximum = getUniqueWinnerCount(options);
  if (!Number.isInteger(count) || count < 1 || count > maximum) {
    throw new RangeError(`Choose between 1 and ${maximum} unique winners.`);
  }

  let remaining = getActiveOptions(options);
  const winners: UniqueWinnerSelection[] = [];
  for (let index = 0; index < count; index += 1) {
    const option = pickWeightedOption(remaining, random);
    if (!option) throw new Error("Could not draw a winner from the active options.");
    const labelKey = normalizeWinnerLabel(option.label);
    const chance = remaining
      .filter((candidate) => normalizeWinnerLabel(candidate.label) === labelKey)
      .reduce((total, candidate) => total + calculateOptionChance(candidate, remaining), 0);
    winners.push({
      option: { ...option, specialType: getSpecialAnimationType(option, chance) },
      chance,
    });
    remaining = remaining.filter((candidate) => normalizeWinnerLabel(candidate.label) !== labelKey);
  }
  return winners;
}

export function shouldRemoveWinnerAfterSpin(wheel: Wheel): boolean {
  return wheel.spinMode !== "accumulation" &&
    (wheel.removeWinnerAfterSpin || wheel.spinMode === "elimination");
}

export function countAccumulatedSelections(results: SpinResult[]): Record<string, number> {
  return results.reduce<Record<string, number>>((counts, result) => {
    if (result.spinMode === "accumulation") {
      counts[result.optionId] = (counts[result.optionId] ?? 0) + 1;
    }
    return counts;
  }, {});
}

export function pickWeightedOption(options: WheelOption[], random: () => number = randomUnit): WheelOption | undefined {
  const activeOptions = getActiveOptions(options);
  const maxWeight = activeOptions.reduce((max, option) => Math.max(max, option.weight), 0);

  if (activeOptions.length === 0 || !Number.isFinite(maxWeight) || maxWeight <= 0) {
    return undefined;
  }

  const normalizedWeights = activeOptions.map((option) => option.weight / maxWeight);
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) return undefined;
  let cursor = sample * normalizedWeights.reduce((total, weight) => total + weight, 0);

  for (const [index, option] of activeOptions.entries()) {
    cursor -= normalizedWeights[index];

    if (cursor < 0) {
      return option;
    }
  }

  return activeOptions.at(-1);
}

export function pickEqualOption(options: WheelOption[], random: () => number = randomUnit): WheelOption | undefined {
  const activeOptions = getActiveOptions(options);

  if (activeOptions.length === 0) {
    return undefined;
  }

  return activeOptions[Math.floor(random() * activeOptions.length)];
}

export function createSpinSelection(
  wheel: Wheel,
  currentRotationDegrees: number,
  excludedOptionIds: string[] = [],
  random: () => number = randomUnit,
  pointerAngleDegrees = -90,
): SpinSelection | undefined {
  const activeOptions = getActiveOptions(wheel.options);
  const eligibleOptions = activeOptions.filter(
    (option) => !excludedOptionIds.includes(option.id),
  );
  const candidates = eligibleOptions.length > 0 ? eligibleOptions : activeOptions;
  const selectedOption = pickWeightedOption(candidates, random);

  if (!selectedOption) {
    return undefined;
  }

  const segments = getSegmentAngles(wheel.options, wheel.visualMode);
  const selectedSegment = segments.find((segment) => segment.option.id === selectedOption.id);
  const segmentWidthDegrees = selectedSegment
    ? (selectedSegment.endAngle - selectedSegment.startAngle) * (180 / Math.PI)
    : 0;
  // Land away from the exact midpoint while keeping a comfortable margin inside the segment.
  const landingOffsetDegrees = segmentWidthDegrees > 0
    ? (random() - 0.5) * Math.min(segmentWidthDegrees * 0.55, 26)
    : 0;
  const chance = calculateOptionChance(selectedOption, candidates);
  const targetRotation = calculateTargetRotation(
    selectedOption.id,
    segments,
    currentRotationDegrees,
    6,
    landingOffsetDegrees,
    pointerAngleDegrees,
  );

  return {
    option: {
      ...selectedOption,
      specialType: getSpecialAnimationType(selectedOption, chance),
    },
    chance,
    targetRotation,
  };
}

export function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 5);
}
