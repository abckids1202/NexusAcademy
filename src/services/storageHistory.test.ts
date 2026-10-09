import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearSavedHistory, createEmptyData, loadData, resetData, saveData, STORAGE_KEY } from "./storageService";

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved history cleanup", () => {
  it("clears spin results and completed sessions while preserving active sessions and projects", () => {
    const data = createEmptyData();
    data.wheels = [{
      id: "wheel-1",
      title: "Lunch",
      description: "",
      options: [{ id: "option-1", label: "Pizza", color: "#fff", textColor: "#000", weight: 1, isActive: true, sortOrder: 0, specialType: "normal" }],
      visualMode: "equal",
      spinMode: "normal",
      removeWinnerAfterSpin: false,
      spinDurationMs: 3000,
      theme: "default",
      createdAt: "2026-10-09T00:00:00.000Z",
      updatedAt: "2026-10-09T00:00:00.000Z",
    }];
    data.spinResults = [{
      id: "result-1", wheelId: "wheel-1", wheelTitle: "Lunch", optionId: "option-1", resultLabel: "Pizza",
      resultColor: "#fff", resultWeight: 1, resultChance: 1, specialType: "normal", createdAt: "2026-10-09T00:00:00.000Z", spinIndex: 1,
    }];
    data.chainSessions = [
      { id: "active", chainId: "chain-1", chainTitle: "Story", status: "in_progress", results: [], startedAt: "2026-10-09T00:00:00.000Z" },
      { id: "complete", chainId: "chain-1", chainTitle: "Story", status: "completed", results: [], startedAt: "2026-10-08T00:00:00.000Z", completedAt: "2026-10-08T00:01:00.000Z" },
    ];
    saveData(data);

    const cleared = clearSavedHistory();

    expect(cleared.wheels).toHaveLength(1);
    expect(cleared.spinResults).toEqual([]);
    expect(cleared.chainSessions.map((session) => session.id)).toEqual(["active"]);
    expect(loadData().chainSessions.map((session) => session.id)).toEqual(["active"]);
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").wheels).toHaveLength(1);
  });
});
