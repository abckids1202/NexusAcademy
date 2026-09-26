import type { ChainSessionResult, SpinChainStep, Wheel } from "../types";

export type StepResolution =
  | { status: "ready"; wheel: Wheel; conditionMatched: boolean }
  | { status: "skip"; conditionMatched: false }
  | { status: "invalid"; message: string };

export function resolveChainStep(
  step: SpinChainStep,
  results: ChainSessionResult[],
  wheels: Wheel[],
): StepResolution {
  const conditionType = step.conditionType ?? "always";
  let conditionMatched = true;

  if (conditionType !== "always") {
    const dependency = results.find((item) => item.stepId === step.dependsOnStepId);
    const expected = step.dependsOnResultValue?.trim().toLocaleLowerCase() ?? "";
    const actual = dependency?.result.resultLabel.trim().toLocaleLowerCase() ?? "";
    conditionMatched = Boolean(dependency && expected) && (
      conditionType === "equals" ? actual === expected
        : conditionType === "notEquals" ? actual !== expected
          : actual.includes(expected)
    );
  }

  const selectedWheelId = conditionMatched ? step.wheelId : step.fallbackWheelId;
  if (!selectedWheelId) {
    return step.isRequired
      ? { status: "invalid", message: `Required step “${step.title}” needs a fallback wheel when its condition is false.` }
      : { status: "skip", conditionMatched: false };
  }

  const wheel = wheels.find((item) => item.id === selectedWheelId);
  if (!wheel) {
    return { status: "invalid", message: `Step “${step.title}” points to a wheel that no longer exists.` };
  }

  const activeCount = wheel.options.filter((option) => option.isActive && !option.isRemoved && option.weight > 0).length;
  if (activeCount < 2) {
    return { status: "invalid", message: `“${wheel.title}” needs at least two active options.` };
  }

  return { status: "ready", wheel, conditionMatched };
}

export function findNextRunnableStepIndex(
  steps: SpinChainStep[],
  startIndex: number,
  results: ChainSessionResult[],
  wheels: Wheel[],
): number {
  for (let index = startIndex; index < steps.length; index += 1) {
    if (resolveChainStep(steps[index], results, wheels).status !== "skip") return index;
  }
  return steps.length;
}
