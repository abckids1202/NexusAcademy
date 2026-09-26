import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoData } from "../data/demoData";
import { createTournament, updateTournamentSetup } from "./tournamentService";
import { saveChain } from "./chainService";
import { getWheel, saveWheel } from "./wheelService";
import { saveSettingsPatch, saveData, resetData, STORAGE_KEY, StaleEditError, loadData } from "./storageService";

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

describe("stale edit protection", () => {
  it("rejects a wheel draft based on an outdated version without overwriting the latest wheel", () => {
    const original = loadData().wheels[0];
    saveWheel({ ...original, title: "Changed in another tab" });

    expect(() => saveWheel({ ...original, title: "Stale draft" }, original.updatedAt)).toThrow(StaleEditError);
    expect(getWheel(original.id)?.title).toBe("Changed in another tab");
  });

  it("rejects a stale generator draft", () => {
    const original = loadData().chains[0];
    saveChain({ ...original, title: "Changed in another tab" });

    expect(() => saveChain({ ...original, title: "Stale draft" }, original.updatedAt)).toThrow(StaleEditError);
    expect(loadData().chains.find((chain) => chain.id === original.id)?.title).toBe("Changed in another tab");
  });

  it("rejects stale tournament setup and merges independent preference changes", () => {
    const tournament = createTournament("Local Cup", ["Avery", "Jordan"]);
    const saved = loadData().tournaments.find((item) => item.id === tournament.id)!;
    saveData({ ...loadData(), tournaments: loadData().tournaments.map((item) => item.id === tournament.id ? { ...item, updatedAt: "2026-09-22T00:00:00.000Z" } : item) });

    expect(() => updateTournamentSetup(tournament.id, "Stale setup", ["Avery", "Jordan"], "entry-order", "single-elimination", "seed", undefined, saved.updatedAt)).toThrow(StaleEditError);

    saveSettingsPatch({ theme: "light" });
    saveSettingsPatch({ soundsEnabled: false });
    expect(loadData().settings).toMatchObject({ theme: "light", soundsEnabled: false });
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").tournaments[0].title).toBe("Local Cup");
  });
});
