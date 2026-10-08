import type { TemplatePack } from "../types";

const specialTypes = new Set(["normal", "uncommon", "rare", "legendary", "jackpot", "danger", "mystery", "bonus"]);
const wheelCategories = new Set(["decision", "giveaway", "classroom", "creative", "game"]);
const chainCategories = new Set(["creative", "giveaway", "classroom", "game"]);
const packCategories = new Set(["classroom", "giveaway", "creative", "game", "tournament"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(record: Record<string, unknown>, key: string): boolean {
  return !(key in record) || typeof record[key] === "string";
}

function validateWheelTemplate(value: unknown, index: number): string[] {
  if (!isRecord(value)) return [`Wheel template ${index + 1} is not an object.`];
  const errors: string[] = [];
  if (typeof value.id !== "string" || !value.id.trim()) errors.push(`Wheel template ${index + 1} has no ID.`);
  if (typeof value.title !== "string" || !value.title.trim()) errors.push(`Wheel template ${index + 1} has no title.`);
  if (typeof value.description !== "string") errors.push(`Wheel template ${index + 1} has an invalid description.`);
  if (typeof value.category !== "string" || !wheelCategories.has(value.category)) errors.push(`Wheel template ${index + 1} has an invalid category.`);
  const wheel = value.wheel;
  if (!isRecord(wheel)) return [...errors, `Wheel template ${index + 1} has no wheel definition.`];
  if (!Array.isArray(wheel.options) || wheel.options.length < 2) errors.push(`Wheel template ${index + 1} needs at least two options.`);
  if (wheel.visualMode !== "equal" && wheel.visualMode !== "weighted") errors.push(`Wheel template ${index + 1} has an invalid visual mode.`);
  if (typeof wheel.spinMode !== "string" || !new Set(["normal", "elimination", "no-repeat", "accumulation"]).has(wheel.spinMode)) errors.push(`Wheel template ${index + 1} has an invalid spin mode.`);
  if (typeof wheel.removeWinnerAfterSpin !== "boolean" || typeof wheel.spinDurationMs !== "number" || !Number.isFinite(wheel.spinDurationMs) || wheel.spinDurationMs <= 0 || typeof wheel.theme !== "string") errors.push(`Wheel template ${index + 1} has invalid wheel settings.`);
  if (Array.isArray(wheel.options)) wheel.options.forEach((option, optionIndex) => {
    if (!isRecord(option) || typeof option.label !== "string" || !option.label.trim() || typeof option.color !== "string" || typeof option.textColor !== "string" || typeof option.weight !== "number" || !Number.isFinite(option.weight) || option.weight <= 0 || typeof option.isActive !== "boolean" || (option.isRemoved !== undefined && typeof option.isRemoved !== "boolean") || (option.isSpecial !== undefined && typeof option.isSpecial !== "boolean") || (typeof option.specialType !== "string" || !specialTypes.has(option.specialType)) || (option.sortOrder !== undefined && (typeof option.sortOrder !== "number" || !Number.isFinite(option.sortOrder)))) {
      errors.push(`Wheel template ${index + 1} option ${optionIndex + 1} is invalid.`);
    }
  });
  return errors;
}

function validateChainTemplate(value: unknown, index: number, wheelIds: Set<string>): string[] {
  if (!isRecord(value)) return [`Chain template ${index + 1} is not an object.`];
  const errors: string[] = [];
  if (typeof value.id !== "string" || !value.id.trim()) errors.push(`Chain template ${index + 1} has no ID.`);
  if (typeof value.title !== "string" || !value.title.trim()) errors.push(`Chain template ${index + 1} has no title.`);
  if (typeof value.description !== "string") errors.push(`Chain template ${index + 1} has an invalid description.`);
  if (typeof value.category !== "string" || !chainCategories.has(value.category)) errors.push(`Chain template ${index + 1} has an invalid category.`);
  if (!Array.isArray(value.steps) || value.steps.length === 0) return [...errors, `Chain template ${index + 1} needs at least one step.`];
  const orders = new Set<number>();
  value.steps.forEach((step, stepIndex) => {
    if (!isRecord(step) || typeof step.title !== "string" || !step.title.trim() || typeof step.wheelTemplateId !== "string" || !wheelIds.has(step.wheelTemplateId) || typeof step.order !== "number" || !Number.isInteger(step.order) || step.order < 0 || orders.has(step.order) || typeof step.isRequired !== "boolean" || typeof step.autoSpinAfterPrevious !== "boolean" || typeof step.delayBeforeSpinMs !== "number" || !Number.isFinite(step.delayBeforeSpinMs) || step.delayBeforeSpinMs < 0 || !optionalString(step, "dependsOnStepId") || !optionalString(step, "dependsOnResultValue") || !optionalString(step, "fallbackWheelId")) {
      errors.push(`Chain template ${index + 1} step ${stepIndex + 1} is invalid or references a missing wheel.`);
    } else {
      orders.add(step.order);
      if (typeof step.fallbackWheelId === "string" && !wheelIds.has(step.fallbackWheelId)) errors.push(`Chain template ${index + 1} step ${stepIndex + 1} references a missing fallback wheel.`);
    }
  });
  return errors;
}

function validatePackContents(wheelsValue: unknown, chainsValue: unknown, label: string): string[] {
  const errors: string[] = [];
  if (!Array.isArray(wheelsValue)) errors.push(`The template pack ${label} wheels are invalid.`);
  if (!Array.isArray(chainsValue)) errors.push(`The template pack ${label} chains are invalid.`);
  if (!Array.isArray(wheelsValue) || !Array.isArray(chainsValue)) return errors;
  const wheelIds = new Set<string>();
  wheelsValue.forEach((wheel, index) => {
    errors.push(...validateWheelTemplate(wheel, index));
    if (isRecord(wheel) && typeof wheel.id === "string") wheelIds.add(wheel.id);
  });
  if (wheelIds.size !== wheelsValue.length) errors.push(`The template pack ${label} contains duplicate wheel IDs.`);
  chainsValue.forEach((chain, index) => errors.push(...validateChainTemplate(chain, index, wheelIds)));
  return errors;
}

export function getTemplatePackValidationErrors(value: unknown): string[] {
  if (!isRecord(value)) return ["The template pack is not an object."];
  const errors: string[] = [];
  if (typeof value.id !== "string" || !value.id.trim()) errors.push("The template pack has no ID.");
  if (typeof value.title !== "string" || !value.title.trim()) errors.push("The template pack has no title.");
  if (typeof value.description !== "string") errors.push("The template pack has an invalid description.");
  if (typeof value.category !== "string" || !packCategories.has(value.category)) errors.push("The template pack has an invalid category.");
  if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string")) errors.push("The template pack tags are invalid.");
  if (typeof value.version !== "number" || !Number.isInteger(value.version) || value.version < 1) errors.push("The template pack version is invalid.");
  if (value.source !== "built-in" && value.source !== "user") errors.push("The template pack source is invalid.");
  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") errors.push("The template pack timestamps are invalid.");
  errors.push(...validatePackContents(value.wheels, value.chains, ""));
  if (value.history !== undefined) {
    if (!Array.isArray(value.history)) errors.push("The template pack history is invalid.");
    else value.history.forEach((revision, index) => {
      if (!isRecord(revision) || typeof revision.version !== "number" || !Number.isInteger(revision.version) || revision.version < 1 ||
        typeof revision.createdAt !== "string") {
        errors.push(`Template pack revision ${index + 1} has invalid metadata.`);
      } else {
        errors.push(...validatePackContents(revision.wheels, revision.chains, `revision ${revision.version}`));
      }
    });
  }
  return errors;
}

export function isValidTemplatePack(value: unknown): value is TemplatePack {
  return getTemplatePackValidationErrors(value).length === 0;
}
