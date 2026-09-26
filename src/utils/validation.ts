import type { SpinChain, Wheel } from "../types";
import { canSpinWheel, getActiveOptions } from "./wheelMath";

export function validateWheel(wheel: Wheel): string[] {
  const errors: string[] = [];
  if (!wheel.title.trim()) errors.push("Give this wheel a title.");
  if (wheel.options.some((option) => !option.label.trim())) {
    errors.push("Every option needs a label.");
  }
  if (wheel.options.some((option) => !Number.isFinite(option.weight) || option.weight <= 0)) {
    errors.push("Every option weight must be greater than zero.");
  }
  if (getActiveOptions(wheel.options).length < 2) {
    errors.push("At least two active options are required to spin.");
  }
  return errors;
}

export function validateChain(chain: SpinChain, wheels: Wheel[]): string[] {
  const errors: string[] = [];
  if (!chain.title.trim()) errors.push("Give this chain a title.");
  if (chain.steps.length === 0) errors.push("Add at least one step to this chain.");
  if (chain.steps.length > 0 && chain.steps.every((step) => !step.isRequired)) {
    errors.push("Mark at least one chain step as required.");
  }

  const orderedSteps = [...chain.steps].sort((a, b) => a.order - b.order);
  for (const [index, step] of orderedSteps.entries()) {
    const wheel = wheels.find((item) => item.id === step.wheelId);
    if (!wheel) {
      errors.push(`Step ${index + 1} (“${step.title || "Untitled"}”) needs a valid wheel${step.isRequired ? "" : " or should be removed"}.`);
    } else if (!canSpinWheel(wheel)) {
      errors.push(`“${wheel.title}” needs at least two active options before this chain can run.`);
    }

    if (step.conditionType && step.conditionType !== "always") {
      const dependsIndex = orderedSteps.findIndex((candidate) => candidate.id === step.dependsOnStepId);
      if (dependsIndex < 0 || dependsIndex >= index) {
        errors.push(`Step ${index + 1} must depend on a previous step.`);
      }
      if (!step.dependsOnResultValue?.trim()) {
        errors.push(`Step ${index + 1} needs a comparison value for its condition.`);
      }
      if (step.isRequired && !step.fallbackWheelId) {
        errors.push(`Required step ${index + 1} needs a fallback wheel or must be marked optional.`);
      }
    }

    if (step.fallbackWheelId) {
      const fallbackWheel = wheels.find((item) => item.id === step.fallbackWheelId);
      if (!fallbackWheel) {
        errors.push(`Step ${index + 1} has a fallback wheel that no longer exists.`);
      } else if (!canSpinWheel(fallbackWheel)) {
        errors.push(`Fallback wheel “${fallbackWheel.title}” needs at least two active options.`);
      }
    }
  }

  return errors;
}
