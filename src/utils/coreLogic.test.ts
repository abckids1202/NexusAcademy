import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainSessionResult, SpinChainStep, Wheel, WheelOption } from "../types";
import { createDemoData } from "../data/demoData";
import { getImportReviewSummary, getStorageHealth, importData, loadData, mergeImportData, resetData, saveData, STORAGE_KEY } from "../services/storageService";
import { undoLatestStandaloneSpin } from "../services/spinService";
import { createTournament, updateTournamentSetup } from "../services/tournamentService";
import { findNextRunnableStepIndex, resolveChainStep } from "./chainLogic";
import { countAccumulatedSelections, createSpinSelection, drawUniqueWinners, getRandomSpinDurationMs, getUniqueWinnerCount, pickWeightedOption, shouldRemoveWinnerAfterSpin } from "./spinLogic";
import { createRoundRobinTournament, createSingleEliminationTournament, drawTournamentWinners, recordTournamentCondition, recordTournamentScore, recordTournamentWinner, undoTournamentWinnerDraw } from "./tournamentLogic";
import { calculateTargetRotation, getSegmentAngles, normalizeDegrees } from "./wheelMath";
import { validateChain, validateWheel } from "./validation";
import { parseOptionLines } from "./optionImport";
import { parseParticipantNames } from "./participantImport";
import { shouldCelebrateResult, shouldSkipSpinAnimation } from "./celebration";

function option(id: string, weight: number, sortOrder: number, overrides: Partial<WheelOption> = {}): WheelOption {
  return {
    id,
    label: id,
    color: "#123456",
    textColor: "#ffffff",
    weight,
    isActive: true,
    isRemoved: false,
    specialType: "normal",
    sortOrder,
    ...overrides,
  };
}

function wheel(id: string, options: WheelOption[]): Wheel {
  return {
    id,
    title: id,
    description: "",
    options,
    visualMode: "weighted",
    spinMode: "normal",
    removeWinnerAfterSpin: false,
    spinDurationMs: 5000,
    theme: "default",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function step(overrides: Partial<SpinChainStep> = {}): SpinChainStep {
  return {
    id: "step-1",
    chainId: "chain-1",
    title: "Step 1",
    wheelId: "wheel-a",
    order: 0,
    isRequired: true,
    autoSpinAfterPrevious: false,
    delayBeforeSpinMs: 700,
    ...overrides,
  };
}

function chainResult(stepId: string, resultLabel: string): ChainSessionResult {
  return {
    stepId,
    stepTitle: stepId,
    wheelId: "wheel-a",
    wheelTitle: "wheel-a",
    result: {
      id: `result-${stepId}`,
      wheelId: "wheel-a",
      wheelTitle: "wheel-a",
      optionId: "option-a",
      resultLabel,
      resultColor: "#123456",
      resultWeight: 1,
      resultChance: 0.5,
      specialType: "normal",
      createdAt: "2026-01-01T00:00:00.000Z",
      spinIndex: 1,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("wheel selection and geometry", () => {
  it("reserves confetti for celebratory outcomes", () => {
    expect(shouldCelebrateResult("normal")).toBe(false);
    expect(shouldCelebrateResult("danger")).toBe(false);
    expect(shouldCelebrateResult("rare")).toBe(true);
    expect(shouldCelebrateResult("jackpot")).toBe(true);
  });

  it("respects the in-app reduced-motion preference", () => {
    vi.stubGlobal("document", { documentElement: { dataset: { reducedMotion: "true" } } });
    expect(shouldSkipSpinAnimation()).toBe(true);
    vi.stubGlobal("document", { documentElement: { dataset: { reducedMotion: "false", animationsEnabled: "true" } } });
    expect(shouldSkipSpinAnimation()).toBe(false);
  });

  it("respects the operating-system reduced-motion preference", () => {
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(shouldSkipSpinAnimation()).toBe(true);
  });

  it("selects from active entries using cumulative weights", () => {
    const options = [
      option("small", 1, 0),
      option("large", 3, 1),
      option("inactive", 100, 2, { isActive: false }),
      option("removed", 100, 3, { isRemoved: true }),
    ];
    expect(pickWeightedOption(options, () => 0.3)?.id).toBe("large");
  });

  it("chooses a realistic randomized spin duration between ten and fifteen seconds", () => {
    expect(getRandomSpinDurationMs(() => 0)).toBe(10_000);
    expect(getRandomSpinDurationMs(() => 0.5)).toBe(12_500);
    expect(getRandomSpinDurationMs(() => 0.999999)).toBe(15_000);
  });

  it("keeps weighted chances and selection stable when finite weights would overflow their sum", () => {
    const options = [option("first", Number.MAX_VALUE, 0), option("second", Number.MAX_VALUE, 1)];
    const testWheel = wheel("large-weights", options);
    const selection = createSpinSelection(testWheel, 0, [], () => 0.75);

    expect(selection?.option.id).toBe("second");
    expect(selection?.chance).toBe(0.5);
    expect(getSegmentAngles(options, "weighted").map((segment) => segment.percentage)).toEqual([0.5, 0.5]);
  });

  it("keeps equal visual segments independent from weighted selection odds", () => {
    const testWheel = wheel("wheel-a", [option("one", 1, 0), option("two", 3, 1)]);
    const segments = getSegmentAngles(testWheel.options, "equal");
    const selection = createSpinSelection(testWheel, 0, [], () => 0.1);

    expect(segments.map((segment) => segment.percentage)).toEqual([0.5, 0.5]);
    expect(selection?.option.id).toBe("one");
    expect(selection?.chance).toBe(0.25);
  });

  it("recalculates no-repeat odds from eligible entries", () => {
    const testWheel = wheel("wheel-a", [option("one", 1, 0), option("two", 3, 1)]);

    const selection = createSpinSelection(testWheel, 0, ["two"], () => 0.5);

    expect(selection?.option.id).toBe("one");
    expect(selection?.chance).toBe(1);
  });

  it("draws unique labels without replacement and recomputes weighted odds for each pick", () => {
    const options = [
      option("ticket-a1", 1, 0, { label: "Avery" }),
      option("ticket-a2", 2, 1, { label: "avery" }),
      option("jordan", 3, 2, { label: "Jordan" }),
      option("sam", 1, 3, { label: "Sam" }),
    ];
    const samples = [0, 0.99];

    expect(getUniqueWinnerCount(options)).toBe(3);
    const winners = drawUniqueWinners(options, 2, () => samples.shift()!);

    expect(winners.map(({ option: winner }) => winner.label)).toEqual(["Avery", "Sam"]);
    expect(winners.map(({ chance }) => chance)).toEqual([3 / 7, 1 / 4]);
    expect(new Set(winners.map(({ option: winner }) => winner.label.toLowerCase())).size).toBe(2);
  });

  it("rejects requests beyond the number of unique active labels", () => {
    const options = [option("a1", 1, 0, { label: "Avery" }), option("a2", 2, 1, { label: "avery" })];

    expect(getUniqueWinnerCount(options)).toBe(1);
    expect(() => drawUniqueWinners(options, 2, () => 0.5)).toThrow("Choose between 1 and 1 unique winners.");
  });

  it("accumulates only spins recorded in accumulation mode", () => {
    const results = [
      { ...chainResult("one", "A").result, spinMode: "accumulation" as const },
      { ...chainResult("two", "A").result, spinMode: "accumulation" as const },
      { ...chainResult("three", "B").result, spinMode: "normal" as const },
    ];

    expect(countAccumulatedSelections(results)).toEqual({ "option-a": 2 });
  });

  it("keeps options available during accumulation even when legacy removal is enabled", () => {
    expect(shouldRemoveWinnerAfterSpin({ ...wheel("wheel-a", [option("a", 1, 0), option("b", 1, 1)]),
      spinMode: "accumulation",
      removeWinnerAfterSpin: true,
    })).toBe(false);
    expect(shouldRemoveWinnerAfterSpin({ ...wheel("wheel-a", [option("a", 1, 0), option("b", 1, 1)]),
      spinMode: "elimination",
    })).toBe(true);
  });

  it("lands the selected segment center under the pointer after a full spin", () => {
    const segments = getSegmentAngles(
      [option("one", 1, 0), option("two", 3, 1)],
      "weighted",
    );
    const selected = segments[1];
    const target = calculateTargetRotation(selected.option.id, segments, 127);
    const pointerAngle = normalizeDegrees(selected.midAngle * (180 / Math.PI) + target);

    expect(target).toBeGreaterThan(127 + 5 * 360);
    expect(Math.abs(pointerAngle - 270)).toBeLessThan(0.001);
  });

  it("can land at a realistic point inside the selected segment instead of always using its midpoint", () => {
    const segments = getSegmentAngles(
      [option("one", 1, 0), option("two", 1, 1), option("three", 1, 2), option("four", 1, 3)],
      "equal",
    );
    const target = calculateTargetRotation(segments[1].option.id, segments, 0, 6, 12);
    const pointerAngle = normalizeDegrees((segments[1].midAngle * 180) / Math.PI + target);
    const segmentStart = normalizeDegrees((segments[1].startAngle * 180) / Math.PI + target);
    const segmentEnd = normalizeDegrees((segments[1].endAngle * 180) / Math.PI + target);

    expect(pointerAngle).toBeCloseTo(258, 5);
    expect(segmentStart).toBeCloseTo(213, 5);
    expect(segmentEnd).toBeCloseTo(303, 5);
  });
});

describe("standalone spin recovery", () => {
  it("undoes the latest standalone spin and restores its eliminated option", () => {
    const data = createDemoData();
    const targetWheel = data.wheels[0];
    const eliminatedOption = targetWheel.options[0];
    eliminatedOption.isRemoved = true;
    const spinResult = {
      id: "spin-undo-test",
      wheelId: targetWheel.id,
      wheelTitle: targetWheel.title,
      optionId: eliminatedOption.id,
      resultLabel: eliminatedOption.label,
      resultColor: eliminatedOption.color,
      resultWeight: eliminatedOption.weight,
      resultChance: 0.5,
      specialType: "normal" as const,
      spinMode: "elimination" as const,
      removedOptionAfterSpin: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      spinIndex: 1,
    };
    data.spinResults = [spinResult];
    const values = new Map<string, string>([[STORAGE_KEY, JSON.stringify(data)]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    } as unknown as Window);

    expect(undoLatestStandaloneSpin(targetWheel.id)).toEqual(spinResult);
    const updated = loadData();
    expect(updated.spinResults).toEqual([]);
    expect(updated.wheels[0].options[0].isRemoved).toBe(false);
  });

  it("does not undo a standalone spin hidden behind a newer chain result", () => {
    const data = createDemoData();
    const wheelId = data.wheels[0].id;
    const baseResult = {
      id: "spin-older",
      wheelId,
      wheelTitle: data.wheels[0].title,
      optionId: data.wheels[0].options[0].id,
      resultLabel: data.wheels[0].options[0].label,
      resultColor: data.wheels[0].options[0].color,
      resultWeight: 1,
      resultChance: 0.5,
      specialType: "normal" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      spinIndex: 1,
    };
    data.spinResults = [
      { ...baseResult, id: "chain-spin", chainId: "chain-1" },
      baseResult,
    ];
    const values = new Map<string, string>([[STORAGE_KEY, JSON.stringify(data)]]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    } as unknown as Window);

    expect(undoLatestStandaloneSpin(wheelId)).toBeUndefined();
    expect(loadData().spinResults).toHaveLength(2);
  });
});

describe("conditional chain routing", () => {
  const wheels = [
    wheel("wheel-a", [option("a1", 1, 0), option("a2", 1, 1)]),
    wheel("wheel-b", [option("b1", 1, 0), option("b2", 1, 1)]),
  ];

  it("matches result labels case-insensitively and selects the primary wheel", () => {
    const result = resolveChainStep(
      step({ conditionType: "contains", dependsOnStepId: "prior", dependsOnResultValue: "blue" }),
      [chainResult("prior", "Blue Dragon")],
      wheels,
    );

    expect(result).toMatchObject({ status: "ready", wheel: { id: "wheel-a" }, conditionMatched: true });
  });

  it("selects a fallback wheel when the condition does not match", () => {
    const result = resolveChainStep(
      step({ conditionType: "equals", dependsOnStepId: "prior", dependsOnResultValue: "yes", fallbackWheelId: "wheel-b" }),
      [chainResult("prior", "no")],
      wheels,
    );

    expect(result).toMatchObject({ status: "ready", wheel: { id: "wheel-b" }, conditionMatched: false });
  });

  it("skips a false optional branch and finds the next runnable step", () => {
    const skipped = step({ isRequired: false, conditionType: "equals", dependsOnStepId: "prior", dependsOnResultValue: "yes" });
    const next = step({ id: "step-next", order: 2 });

    expect(resolveChainStep(skipped, [chainResult("prior", "no")], wheels)).toEqual({ status: "skip", conditionMatched: false });
    expect(findNextRunnableStepIndex([skipped, next], 0, [chainResult("prior", "no")], wheels)).toBe(1);
  });
});

describe("configuration validation and backup imports", () => {
  it("parses pasted option lists by trimming lines and dropping blanks", () => {
    expect(parseOptionLines(" Lunch \r\n\r\nDinner\n Takeout ")).toEqual(["Lunch", "Dinner", "Takeout"]);
    expect(parseOptionLines(" \n ")).toEqual([]);
  });

  it("deduplicates pasted tournament names case-insensitively", () => {
    expect(parseParticipantNames("Avery\nJordan\n aVERY \n\nSam")).toEqual({
      names: ["Avery", "Jordan", "Sam"],
      duplicateCount: 1,
    });
  });

  it("rejects wheels with too few active choices", () => {
    const invalidWheel = wheel("wheel-a", [option("only", 1, 0)]);

    expect(validateWheel(invalidWheel)).toContain("At least two active options are required to spin.");
  });

  it("rejects conditions that depend on a later step", () => {
    const first = step({ id: "first", order: 0 });
    const later = step({ id: "later", order: 1, conditionType: "equals", dependsOnStepId: "first", dependsOnResultValue: "ok", fallbackWheelId: "wheel-a" });
    const chain = { id: "chain-1", title: "Story", description: "", steps: [first, later], createdAt: "", updatedAt: "" };

    expect(validateChain(chain, [wheel("wheel-a", [option("a", 1, 0), option("b", 1, 1)])])).toEqual([]);
    expect(validateChain({ ...chain, steps: [{ ...first, order: 1 }, { ...later, order: 0 }] }, [wheel("wheel-a", [option("a", 1, 0), option("b", 1, 1)])])).toContain("Step 1 must depend on a previous step.");
  });

  it("rejects malformed nested chain data in imported backups", () => {
    const data = createDemoData();
    data.chains[0].steps[0] = {} as SpinChainStep;

    expect(() => importData(JSON.stringify(data))).toThrow("Invalid or unsupported WheelForge backup.");
  });

  it("seeds demo data once, then preserves an intentionally empty reset", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);

    expect(loadData().wheels.length).toBeGreaterThan(0);
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").version).toBe(1);
    expect(resetData().wheels).toEqual([]);
    expect(loadData().wheels).toEqual([]);
  });

  it("persists a valid imported backup under the versioned storage key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);

      const data = createDemoData();
      data.favoriteTemplateIds = ["food-picker", "fantasy-story-generator"];
      data.recentTemplateIds = ["food-picker"];
      const imported = importData(JSON.stringify(data));

    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null")).toEqual(imported);
      expect(imported.favoriteTemplateIds).toEqual(data.favoriteTemplateIds);
      expect(imported.recentTemplateIds).toEqual(data.recentTemplateIds);
  });

  it("migrates older version-one backups that do not yet contain tournaments", () => {
    const oldBackup = createDemoData() as unknown as Record<string, unknown>;
    delete oldBackup.tournaments;

    const imported = importData(JSON.stringify(oldBackup));

    expect(imported.tournaments).toEqual([]);
      expect(imported.favoriteTemplateIds).toEqual([]);
      expect(imported.recentTemplateIds).toEqual([]);
      expect(imported.userTemplates).toEqual([]);
  });

  it("merges backup records by ID, keeps current conflicts and preferences, and unions template markers", () => {
    const current = createDemoData();
    current.settings.theme = "light";
    current.wheels[0].title = "My current food wheel";
    current.favoriteTemplateIds = ["food-picker"];
    current.recentTemplateIds = ["food-picker"];

    const backup = createDemoData();
    backup.wheels[0].title = "Older food wheel copy";
    backup.wheels.push({ ...backup.wheels[0], id: "backup-only-wheel", title: "Backup only" });
    backup.favoriteTemplateIds = ["food-picker", "giveaway-prize-wheel"];
    backup.recentTemplateIds = ["giveaway-prize-wheel", "food-picker"];
    backup.settings.theme = "dark";

    const summary = getImportReviewSummary(current, backup);
    const merged = mergeImportData(current, backup);

    expect(summary.counts.wheels).toMatchObject({ current: current.wheels.length, incoming: backup.wheels.length, new: 1 });
    expect(summary.idConflicts).toBeGreaterThan(0);
    expect(merged.wheels.find((item) => item.id === current.wheels[0].id)?.title).toBe("My current food wheel");
    expect(merged.wheels.find((item) => item.id === "backup-only-wheel")?.title).toBe("Backup only");
    expect(merged.settings.theme).toBe("light");
    expect(merged.favoriteTemplateIds).toEqual(["food-picker", "giveaway-prize-wheel"]);
    expect(merged.recentTemplateIds).toEqual(["giveaway-prize-wheel", "food-picker"]);
    expect(merged.chains).toHaveLength(current.chains.length);
  });

  it("round-trips tournament condition draws and rejects malformed draw snapshots", () => {
    const data = createDemoData();
    const tournament = createSingleEliminationTournament("Map Night", [
      { id: "entrant-a", name: "Alpha" },
      { id: "entrant-b", name: "Bravo" },
    ]);
    const match = tournament.rounds[0].matches[0];
    const withCondition = recordTournamentCondition(tournament, match.id, {
      wheelId: "map-wheel", wheelTitle: "Map Picker", optionId: "arena", optionLabel: "Arena",
      optionColor: "#123456", optionWeight: 2, optionChance: 0.5, createdAt: "2026-01-01T00:00:00.000Z",
    });
    data.tournaments = [withCondition];

    const imported = importData(JSON.stringify(data));
    expect(imported.tournaments[0].rounds[0].matches[0].conditionDraw?.optionLabel).toBe("Arena");

    const malformed = JSON.parse(JSON.stringify(data)) as {
      tournaments: Array<{ events: Array<{ conditionDraw: { optionChance: number } }> }>;
    };
    malformed.tournaments[0].events[0].conditionDraw.optionChance = 2;
    expect(() => importData(JSON.stringify(malformed))).toThrow("Invalid or unsupported WheelForge backup.");
  });

  it("round-trips chance draw snapshots and rejects inconsistent odds", () => {
    const data = createDemoData();
    let tournament = createSingleEliminationTournament("Prize Cup", [
      { id: "entrant-a", name: "Alpha" },
      { id: "entrant-b", name: "Bravo" },
      { id: "entrant-c", name: "Charlie" },
    ]);
    tournament = drawTournamentWinners(tournament, [
      { participantId: "entrant-a", tickets: 3 },
      { participantId: "entrant-b", tickets: 1 },
      { participantId: "entrant-c", tickets: 2 },
    ], 2, "2026-01-01T00:00:00.000Z", (maximum) => maximum - 1);
    tournament = undoTournamentWinnerDraw(tournament, "2026-01-01T00:01:00.000Z");
    data.tournaments = [tournament];

    const imported = importData(JSON.stringify(data));
    expect(imported.tournaments[0].events).toEqual(tournament.events);
    expect(imported.tournaments[0].events[0].winnerDraw?.entrants[0]).toMatchObject({ tickets: 3, chance: 0.5 });

    const malformed = JSON.parse(JSON.stringify(data)) as {
      tournaments: Array<{ events: Array<{ winnerDraw?: { entrants: Array<{ chance: number }> } }> }>;
    };
    malformed.tournaments[0].events[0].winnerDraw!.entrants[0].chance = 0.9;
    expect(() => importData(JSON.stringify(malformed))).toThrow("Invalid or unsupported WheelForge backup.");
  });

  it("imports accumulation wheel defaults and tagged history entries", () => {
    const data = createDemoData();
    data.wheels[0].spinMode = "accumulation";
    data.spinResults = [{
      ...chainResult("accumulated", "Pizza").result,
      spinMode: "accumulation",
    }];

    const imported = importData(JSON.stringify(data));

    expect(imported.wheels[0].spinMode).toBe("accumulation");
    expect(countAccumulatedSelections(imported.spinResults)).toEqual({ "option-a": 1 });
  });

  it("round-trips round-robin tournaments and upgrades legacy brackets without a format", () => {
    const data = createDemoData();
    const entrants = [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }, { id: "p3", name: "Three" }];
    let matchId = 0;
    const initialLeague = createRoundRobinTournament("League", entrants, { id: "league-1", idFactory: (prefix) => `${prefix}-${++matchId}` });
    const firstMatch = initialLeague.rounds[0].matches.find((match) => match.status === "pending");
    if (!firstMatch) throw new Error("Expected a scheduled league match.");
    const league = recordTournamentWinner(initialLeague, firstMatch.id, firstMatch.participantAId!);
    const legacyBracket = createSingleEliminationTournament("Old Cup", entrants, { id: "old-cup", idFactory: (prefix) => `${prefix}-old` }) as unknown as Record<string, unknown>;
    delete legacyBracket.format;
    delete legacyBracket.roundRobinTiebreaker;
    delete legacyBracket.events;
    delete legacyBracket.nextEventSequence;
    data.tournaments = [league, legacyBracket as never];

    const imported = importData(JSON.stringify(data));

    expect(imported.tournaments.map((tournament) => tournament.format)).toEqual(["round-robin", "single-elimination"]);
    expect(imported.tournaments[0].events).toEqual(league.events);
    expect(imported.tournaments[1].events).toEqual([]);
    expect(imported.tournaments[1].nextEventSequence).toBe(1);
    expect(imported.tournaments.map((tournament) => tournament.roundRobinTiebreaker)).toEqual(["seed", "seed"]);
    expect(imported.tournaments.map((tournament) => tournament.scoring)).toEqual([
      { winPoints: 3, drawPoints: 1, lossPoints: 0 },
      { winPoints: 3, drawPoints: 1, lossPoints: 0 },
    ]);
  });

  it("round-trips score draws and rejects invalid score outcomes in tournament backups", () => {
    const data = createDemoData();
    const tournament = createRoundRobinTournament("Draw league", [
      { id: "draw-a", name: "Avery" }, { id: "draw-b", name: "Jordan" },
    ], { id: "draw-league" });
    const match = tournament.rounds[0].matches[0];
    const drawn = recordTournamentScore(tournament, match.id, 2, 2, "2026-01-01T00:00:00.000Z");
    data.tournaments = [drawn];

    const imported = importData(JSON.stringify(data));
    expect(imported.tournaments[0].rounds[0].matches[0]).toMatchObject({ status: "complete", scoreA: 2, scoreB: 2 });
    expect(imported.tournaments[0].rounds[0].matches[0].winnerId).toBeUndefined();
    expect(imported.tournaments[0].events[0]).toMatchObject({ type: "result-recorded", scoreA: 2, scoreB: 2 });

    const malformed = JSON.parse(JSON.stringify(data)) as { tournaments: Array<{ rounds: Array<{ matches: Array<Record<string, unknown>> }> }> };
    malformed.tournaments[0].rounds[0].matches[0].scoreB = 1;
    expect(() => importData(JSON.stringify(malformed))).toThrow("Invalid or unsupported WheelForge backup.");

    const elimination = createSingleEliminationTournament("No draws", [
      { id: "elim-a", name: "Avery" }, { id: "elim-b", name: "Jordan" },
    ]);
    const invalidElimination = {
      ...elimination,
      rounds: elimination.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((item) => item.id === elimination.rounds[0].matches[0].id
          ? { ...item, status: "complete" as const, scoreA: 0, scoreB: 0 }
          : item),
      })),
    };
    data.tournaments = [invalidElimination];
    expect(() => importData(JSON.stringify(data))).toThrow("Invalid or unsupported WheelForge backup.");
  });

  it("persists tournament setup edits through the service layer", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);
    resetData();
    saveData(createDemoData());

    const created = createTournament("Setup", ["Avery", "Jordan", "Sam", "Taylor"]);
    const updated = updateTournamentSetup(created.id, "League night", ["Avery", "Jordan", "Sam", "Taylor"], "random", "round-robin", "head-to-head");
    const persisted = loadData().tournaments.find((tournament) => tournament.id === created.id);

    expect(updated.format).toBe("round-robin");
    expect(updated.seeding).toBe("random");
    expect(persisted).toMatchObject({ title: "League night", format: "round-robin", seeding: "random", roundRobinTiebreaker: "head-to-head" });
    expect(persisted?.rounds.flatMap((round) => round.matches)).toHaveLength(6);
  });

  it("rejects malformed tournament data in a backup", () => {
    const data = createDemoData();
    data.tournaments = [{ id: "bad", title: "Bad bracket" } as never];

    expect(() => importData(JSON.stringify(data))).toThrow("Invalid or unsupported WheelForge backup.");
  });

  it("rejects malformed or out-of-order tournament activity history", () => {
    const data = createDemoData();
    const entrants = [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }];
    const tournament = createSingleEliminationTournament("Cup", entrants, { id: "cup", idFactory: (prefix) => `${prefix}-id` });
    data.tournaments = [{
      ...tournament,
      nextEventSequence: 3,
      events: [
        { id: "event-2", sequence: 2, type: "result-recorded", matchId: "match", roundNumber: 1, matchNumber: 1, createdAt: "2026-01-01T00:00:00.000Z", winnerId: "p1" },
        { id: "event-1", sequence: 1, type: "result-recorded", matchId: "match", roundNumber: 1, matchNumber: 1, createdAt: "2026-01-01T00:00:01.000Z", winnerId: "p2" },
      ],
    }];

    expect(() => importData(JSON.stringify(data))).toThrow("Invalid or unsupported WheelForge backup.");
  });

  it("keeps the workspace usable in memory when browser storage writes fail", () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new DOMException("Quota exceeded", "QuotaExceededError"); },
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);

    const seeded = loadData();
    expect(seeded.wheels.length).toBeGreaterThan(0);
    expect(getStorageHealth()).toEqual({ mode: "memory", reason: "write-failed" });

    const changed = { ...seeded, wheels: [] };
    saveData(changed);
    expect(loadData().wheels).toEqual([]);
    expect(getStorageHealth()).toEqual({ mode: "memory", reason: "write-failed" });
  });

  it("does not replace unsaved in-memory changes with stale persisted data", () => {
    let failWrites = false;
    const values = new Map<string, string>([[STORAGE_KEY, JSON.stringify(createDemoData())]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
        values.set(key, value);
      },
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);

    const initial = loadData();
    failWrites = true;
    saveData({ ...initial, wheels: [] });
    failWrites = false;

    expect(loadData().wheels).toEqual([]);
    expect(getStorageHealth()).toEqual({ mode: "memory", reason: "write-failed" });
    saveData(loadData());
    expect(getStorageHealth()).toEqual({ mode: "persistent" });
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").wheels).toEqual([]);
  });

  it("preserves corrupt stored data until backup import or reset is explicitly requested", async () => {
    vi.resetModules();
    const storageService = await import("../services/storageService");
    const values = new Map<string, string>([[STORAGE_KEY, "{broken backup"]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(storageService.loadData().wheels).toEqual([]);
    expect(storageService.getStorageHealth()).toEqual({ mode: "memory", reason: "corrupt" });
    expect(storageService.getPreservedCorruptData()).toBe("{broken backup");
    storageService.saveData({ ...storageService.loadData(), wheels: createDemoData().wheels });
    storageService.seedDemoData();
    storageService.saveSettingsPatch({ theme: "light" });
    expect(values.get(STORAGE_KEY)).toBe("{broken backup");

    const restored = storageService.importData(JSON.stringify(createDemoData()));
    expect(restored.wheels.length).toBeGreaterThan(0);
    expect(storageService.getPreservedCorruptData()).toBeUndefined();
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").wheels).toHaveLength(restored.wheels.length);

    values.set(STORAGE_KEY, "{broken again");
    expect(storageService.loadData().wheels).toHaveLength(restored.wheels.length);
    expect(storageService.getPreservedCorruptData()).toBe("{broken again");
    storageService.resetData();
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").wheels).toEqual([]);
    expect(storageService.getStorageHealth()).toEqual({ mode: "persistent" });
    expect(storageService.getPreservedCorruptData()).toBeUndefined();
  });

  it.each([
    ["an empty stored value", () => ""],
    ["parseable invalid root fields", () => ({ ...createDemoData(), wheels: [null] })],
    ["invalid nested records", () => {
      const data = createDemoData();
      data.wheels[0].options[0].weight = 0;
      return data;
    }],
    ["unsupported versions", () => ({ ...createDemoData(), version: 99 })],
  ])("preserves %s without exposing it as a valid workspace", async (_label, makeInvalidData) => {
    vi.resetModules();
    const storageService = await import("../services/storageService");
    const data = makeInvalidData();
    const raw = typeof data === "string" ? data : JSON.stringify(data);
    const values = new Map<string, string>([[STORAGE_KEY, raw]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(storageService.loadData().wheels).toEqual([]);
    expect(storageService.getStorageHealth()).toEqual({ mode: "memory", reason: "corrupt" });
    expect(storageService.getPreservedCorruptData()).toBe(raw);
    storageService.saveData({ ...storageService.loadData(), wheels: createDemoData().wheels });
    expect(values.get(STORAGE_KEY)).toBe(raw);
  });

  it("keeps the original corrupt value when an explicit recovery write fails", async () => {
    vi.resetModules();
    const storageService = await import("../services/storageService");
    const raw = "{broken workspace";
    let failWrites = true;
    const values = new Map<string, string>([[STORAGE_KEY, raw]]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
        values.set(key, value);
      },
    } as unknown as Storage } as unknown as Window);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    storageService.loadData();
    storageService.resetData();
    expect(values.get(STORAGE_KEY)).toBe(raw);
    expect(storageService.getPreservedCorruptData()).toBe(raw);
    expect(storageService.getStorageHealth()).toEqual({ mode: "memory", reason: "write-failed" });

    failWrites = false;
    storageService.importData(JSON.stringify(createDemoData()));
    expect(storageService.getPreservedCorruptData()).toBeUndefined();
    expect(storageService.getStorageHealth()).toEqual({ mode: "persistent" });
    expect(JSON.parse(values.get(STORAGE_KEY) ?? "null").wheels).toHaveLength(createDemoData().wheels.length);
  });

  it("migrates supported legacy workspace fields before returning local data", async () => {
    vi.resetModules();
    const storageService = await import("../services/storageService");
    const legacy = { ...createDemoData() } as Record<string, unknown>;
    delete legacy.tournaments;
    delete legacy.favoriteTemplateIds;
    delete legacy.recentTemplateIds;
    delete legacy.userTemplates;
    const values = new Map<string, string>([[STORAGE_KEY, JSON.stringify(legacy)]]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } as unknown as Storage } as unknown as Window);

    const migrated = storageService.loadData();
    expect(migrated.wheels).toHaveLength(createDemoData().wheels.length);
    expect(migrated.tournaments).toEqual([]);
    expect(migrated.favoriteTemplateIds).toEqual([]);
    expect(storageService.getStorageHealth()).toEqual({ mode: "persistent" });
    expect(storageService.getPreservedCorruptData()).toBeUndefined();
  });
});
