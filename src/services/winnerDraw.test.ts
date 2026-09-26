import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoData } from "../data/demoData";
import { undoLatestStandaloneSpin, saveUniqueWinnerDraw } from "./spinService";
import { exportData, importData, loadData, resetData, saveData } from "./storageService";

let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  } as unknown as Window);
  resetData();
  saveData(createDemoData());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("unique winner draw history", () => {
  it("persists one draw as a batch and undo removes the whole batch without changing the wheel", () => {
    const wheel = loadData().wheels[0];
    const results = saveUniqueWinnerDraw(wheel, [
      { option: wheel.options[0], chance: 0.5 },
      { option: wheel.options[1], chance: 1 },
    ]);

    expect(results.map((result) => [result.drawPosition, result.drawSize])).toEqual([[1, 2], [2, 2]]);
    expect(results[1].spinIndex).toBe(results[0].spinIndex + 1);
    expect(new Set(results.map((result) => result.drawId)).size).toBe(1);
    expect(exportData()).toContain(results[0].drawId);
    importData(exportData());
    expect(loadData().spinResults).toHaveLength(2);
    expect(undoLatestStandaloneSpin(wheel.id)?.drawId).toBe(results[0].drawId);
    expect(loadData().spinResults).toEqual([]);
    expect(loadData().wheels[0].options).toEqual(wheel.options);
  });

  it("rejects a backup containing only part of a winner-draw batch", () => {
    const wheel = loadData().wheels[0];
    const results = saveUniqueWinnerDraw(wheel, [
      { option: wheel.options[0], chance: 0.5 },
      { option: wheel.options[1], chance: 1 },
    ]);
    const partial = { ...loadData(), spinResults: [results[0]] };

    expect(() => importData(JSON.stringify(partial))).toThrow("Invalid or unsupported WheelForge backup.");
  });
});
