import { loadData, saveData, StaleEditError } from "./storageService";
import type { Wheel, WheelOption } from "../types";
import { getDefaultOptionColor, getReadableTextColor } from "../utils/colors";
import { createId } from "../utils/ids";

export type CreateWheelInput = Partial<
  Pick<
    Wheel,
    | "title"
    | "description"
    | "options"
    | "visualMode"
    | "spinMode"
    | "removeWinnerAfterSpin"
    | "spinDurationMs"
    | "theme"
  >
>;

export function createWheelOption(
  label: string,
  index: number,
  overrides: Partial<WheelOption> = {},
): WheelOption {
  const color = overrides.color ?? getDefaultOptionColor(index);

  return {
    id: overrides.id ?? createId("option"),
    label,
    color,
    textColor: overrides.textColor ?? getReadableTextColor(color),
    weight: overrides.weight ?? 1,
    isActive: overrides.isActive ?? true,
    isRemoved: overrides.isRemoved ?? false,
    isSpecial: overrides.isSpecial ?? false,
    specialType: overrides.specialType ?? "normal",
    sortOrder: overrides.sortOrder ?? index,
  };
}

export function getWheels(): Wheel[] {
  return loadData().wheels;
}

export function getWheel(wheelId: string): Wheel | undefined {
  return getWheels().find((wheel) => wheel.id === wheelId);
}

export function createWheel(input: CreateWheelInput = {}): Wheel {
  const now = new Date().toISOString();
  const wheel: Wheel = {
    id: createId("wheel"),
    title: input.title?.trim() || "Untitled Wheel",
    description: input.description ?? "",
    options: input.options ?? [
      createWheelOption("Option A", 0),
      createWheelOption("Option B", 1),
    ],
    visualMode: input.visualMode ?? "equal",
    spinMode: input.spinMode ?? "normal",
    removeWinnerAfterSpin: input.removeWinnerAfterSpin ?? false,
    spinDurationMs: input.spinDurationMs ?? 5600,
    theme: input.theme ?? "default",
    createdAt: now,
    updatedAt: now,
  };

  const data = loadData();
  saveData({ ...data, wheels: [...data.wheels, wheel] });

  return wheel;
}

export function saveWheel(wheel: Wheel, expectedUpdatedAt?: string): Wheel {
  const data = loadData();
  const existingIndex = data.wheels.findIndex((item) => item.id === wheel.id);
  const existingWheel = existingIndex >= 0 ? data.wheels[existingIndex] : undefined;
  if (expectedUpdatedAt !== undefined && existingWheel?.updatedAt !== expectedUpdatedAt) {
    throw new StaleEditError("wheel");
  }
  const updatedWheel = { ...wheel, updatedAt: new Date().toISOString() };
  const wheels =
    existingIndex >= 0
      ? data.wheels.map((item) => (item.id === wheel.id ? updatedWheel : item))
      : [...data.wheels, updatedWheel];

  saveData({ ...data, wheels });
  return updatedWheel;
}

export function updateWheel(
  wheelId: string,
  updates: Partial<Omit<Wheel, "id" | "createdAt">>,
): Wheel | undefined {
  const existingWheel = getWheel(wheelId);

  if (!existingWheel) {
    return undefined;
  }

  return saveWheel({
    ...existingWheel,
    ...updates,
    id: existingWheel.id,
    createdAt: existingWheel.createdAt,
  });
}

export function duplicateWheel(wheelId: string): Wheel | undefined {
  const wheel = getWheel(wheelId);

  if (!wheel) {
    return undefined;
  }

  return createWheel({
    ...wheel,
    title: `${wheel.title} Copy`,
    options: wheel.options.map((option) => ({
      ...option,
      id: createId("option"),
      isRemoved: false,
    })),
  });
}

export function deleteWheel(wheelId: string): void {
  const data = loadData();

  saveData({
    ...data,
    wheels: data.wheels.filter((wheel) => wheel.id !== wheelId),
    chains: data.chains.map((chain) => ({
      ...chain,
      steps: chain.steps.filter((step) => step.wheelId !== wheelId || !step.isRequired),
    })),
  });
}
