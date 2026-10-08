import type { ChainSession, SpinResult, Wheel } from "../types";
import { createId } from "../utils/ids";
import type { UniqueWinnerSelection } from "../utils/spinLogic";
import { loadData, saveData } from "./storageService";

export function getSpinResults(): SpinResult[] {
  return loadData().spinResults;
}

export function getSpinResultsForWheel(wheelId: string): SpinResult[] {
  return getSpinResults().filter((result) => result.wheelId === wheelId);
}

export function saveSpinResult(
  result: Omit<SpinResult, "id" | "createdAt" | "spinIndex"> &
    Partial<Pick<SpinResult, "id" | "createdAt" | "spinIndex">>,
): SpinResult {
  const data = loadData();
  const spinResult: SpinResult = {
    ...result,
    id: result.id ?? createId("spin"),
    createdAt: result.createdAt ?? new Date().toISOString(),
    spinIndex: result.spinIndex ?? data.spinResults.length + 1,
  };

  saveData({ ...data, spinResults: [spinResult, ...data.spinResults] });
  return spinResult;
}

export function saveUniqueWinnerDraw(wheel: Wheel, selections: UniqueWinnerSelection[], drawType: SpinResult["drawType"] = "unique-winners"): SpinResult[] {
  if (selections.length < 1) throw new Error("A winner draw must include at least one result.");
  const data = loadData();
  const drawId = createId("draw");
  const createdAt = new Date().toISOString();
  const results = selections.map(({ option, chance }, index): SpinResult => ({
    id: createId("spin"),
    wheelId: wheel.id,
    wheelTitle: wheel.title,
    optionId: option.id,
    resultLabel: option.label,
    resultColor: option.color,
    resultWeight: option.weight,
    resultChance: chance,
    specialType: option.specialType,
    drawId,
    drawType,
    drawPosition: index + 1,
    drawSize: selections.length,
    createdAt,
    spinIndex: data.spinResults.length + index + 1,
  }));
  saveData({ ...data, spinResults: [...results].reverse().concat(data.spinResults) });
  return results;
}

export function clearSpinHistory(wheelId?: string): void {
  const data = loadData();
  const spinResults = wheelId
    ? data.spinResults.filter((result) => result.wheelId !== wheelId)
    : [];

  saveData({ ...data, spinResults });
}

export function undoLatestStandaloneSpin(wheelId: string): SpinResult | undefined {
  const data = loadData();
  const latestResult = data.spinResults.find((result) => result.wheelId === wheelId);
  if (!latestResult || latestResult.chainId) return undefined;

  const wheel = data.wheels.find((item) => item.id === wheelId);
  const shouldRestoreOption = latestResult.removedOptionAfterSpin === true;
  const wheels = shouldRestoreOption && wheel
    ? data.wheels.map((item) => item.id !== wheelId
      ? item
      : {
          ...item,
          options: item.options.map((option) => option.id === latestResult.optionId
            ? { ...option, isRemoved: false }
            : option),
          updatedAt: new Date().toISOString(),
        })
    : data.wheels;

  const spinResults = latestResult.drawId
    ? data.spinResults.filter((result) => result.drawId !== latestResult.drawId)
    : data.spinResults.filter((result) => result.id !== latestResult.id);
  saveData({
    ...data,
    wheels,
    spinResults,
  });
  return latestResult;
}

export function getChainSessions(): ChainSession[] {
  return loadData().chainSessions;
}

export function getChainSession(sessionId: string): ChainSession | undefined {
  return getChainSessions().find((session) => session.id === sessionId);
}

export function saveChainSession(
  session: Omit<ChainSession, "id" | "startedAt"> &
    Partial<Pick<ChainSession, "id" | "startedAt">>,
): ChainSession {
  const data = loadData();
  const chainSession: ChainSession = {
    ...session,
    id: session.id ?? createId("session"),
    startedAt: session.startedAt ?? new Date().toISOString(),
  };
  const existingIndex = data.chainSessions.findIndex(
    (item) => item.id === chainSession.id,
  );
  const chainSessions =
    existingIndex >= 0
      ? data.chainSessions.map((item) =>
          item.id === chainSession.id ? chainSession : item,
        )
      : [chainSession, ...data.chainSessions];

  saveData({ ...data, chainSessions });
  return chainSession;
}

export function clearChainSessions(chainId?: string): void {
  const data = loadData();
  const chainSessions = chainId
    ? data.chainSessions.filter((session) => session.chainId !== chainId)
    : [];

  saveData({ ...data, chainSessions });
}
