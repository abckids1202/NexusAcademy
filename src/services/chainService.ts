import { createId } from "../utils/ids";
import type { SpinChain, SpinChainStep } from "../types";
import { loadData, saveData, StaleEditError } from "./storageService";

export type CreateChainInput = Partial<Pick<SpinChain, "title" | "description" | "steps">>;

export function getChains(): SpinChain[] {
  return loadData().chains;
}

export function getChain(chainId: string): SpinChain | undefined {
  return getChains().find((chain) => chain.id === chainId);
}

export function createChainStep(
  chainId: string,
  title: string,
  wheelId: string,
  order: number,
  overrides: Partial<SpinChainStep> = {},
): SpinChainStep {
  return {
    id: overrides.id ?? createId("step"),
    chainId,
    title,
    wheelId,
    order,
    isRequired: overrides.isRequired ?? true,
    autoSpinAfterPrevious: overrides.autoSpinAfterPrevious ?? false,
    delayBeforeSpinMs: overrides.delayBeforeSpinMs ?? 700,
    conditionType: overrides.conditionType,
    dependsOnStepId: overrides.dependsOnStepId,
    dependsOnResultValue: overrides.dependsOnResultValue,
    fallbackWheelId: overrides.fallbackWheelId,
  };
}

export function createChain(input: CreateChainInput = {}): SpinChain {
  const now = new Date().toISOString();
  const chainId = createId("chain");
  const chain: SpinChain = {
    id: chainId,
    title: input.title?.trim() || "Untitled Chain",
    description: input.description ?? "",
    steps: (input.steps ?? []).map((step) => ({
      ...step,
      chainId,
    })),
    createdAt: now,
    updatedAt: now,
  };

  const data = loadData();
  saveData({ ...data, chains: [...data.chains, chain] });

  return chain;
}

export function saveChain(chain: SpinChain, expectedUpdatedAt?: string): SpinChain {
  const data = loadData();
  const existingChain = data.chains.find((item) => item.id === chain.id);
  if (expectedUpdatedAt !== undefined && existingChain?.updatedAt !== expectedUpdatedAt) {
    throw new StaleEditError("generator");
  }
  const updatedChain = {
    ...chain,
    steps: chain.steps.map((step) => ({ ...step, chainId: chain.id })),
    updatedAt: new Date().toISOString(),
  };
  const existingIndex = data.chains.findIndex((item) => item.id === chain.id);
  const chains =
    existingIndex >= 0
      ? data.chains.map((item) => (item.id === chain.id ? updatedChain : item))
      : [...data.chains, updatedChain];

  saveData({ ...data, chains });
  return updatedChain;
}

export function updateChain(
  chainId: string,
  updates: Partial<Omit<SpinChain, "id" | "createdAt">>,
): SpinChain | undefined {
  const existingChain = getChain(chainId);

  if (!existingChain) {
    return undefined;
  }

  return saveChain({
    ...existingChain,
    ...updates,
    id: existingChain.id,
    createdAt: existingChain.createdAt,
  });
}

export function duplicateChain(chainId: string): SpinChain | undefined {
  const chain = getChain(chainId);

  if (!chain) {
    return undefined;
  }

  const nextChainId = createId("chain");

  return createChain({
    title: `${chain.title} Copy`,
    description: chain.description,
    steps: chain.steps.map((step) => ({
      ...step,
      id: createId("step"),
      chainId: nextChainId,
    })),
  });
}

export function deleteChain(chainId: string): void {
  const data = loadData();

  saveData({
    ...data,
    chains: data.chains.filter((chain) => chain.id !== chainId),
    chainSessions: data.chainSessions.filter((session) => session.chainId !== chainId),
  });
}
