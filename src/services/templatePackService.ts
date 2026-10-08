import { templatePacks } from "../data/templatePacks";
import type { ChainTemplate, TemplatePack, TemplatePackRevision, Wheel, WheelTemplate, SpinChain } from "../types";
import { createId } from "../utils/ids";
import { loadData, saveData } from "./storageService";
import { getTemplatePackValidationErrors } from "../utils/templatePackValidation";

const MAX_RECENT = 8;

export type TemplatePackInstallPreview = {
  pack: TemplatePack;
  wheelCount: number;
  chainCount: number;
  warnings: string[];
};

export type TemplatePackDiff = {
  fromVersion: number;
  toVersion: number;
  addedWheels: string[];
  removedWheels: string[];
  changedWheels: string[];
  addedChains: string[];
  removedChains: string[];
  changedChains: string[];
};

function cloneWheel(source: WheelTemplate["wheel"] | Wheel, title: string, description: string): Wheel {
  const now = new Date().toISOString();
  return {
    ...(source as Wheel), id: createId("wheel"), title, description, createdAt: now, updatedAt: now,
    options: source.options.map((option, index) => ({ ...option, id: createId("option"), sortOrder: index, isRemoved: false })),
  };
}

function snapshotWheel(wheel: Wheel): WheelTemplate {
  return {
    id: createId("pack_wheel"), title: wheel.title, description: wheel.description,
    category: "creative", wheel: { ...wheel, id: undefined, createdAt: undefined, updatedAt: undefined } as unknown as WheelTemplate["wheel"],
  };
}

function snapshotRevision(pack: TemplatePack): TemplatePackRevision {
  return {
    version: pack.version,
    createdAt: pack.updatedAt,
    wheels: pack.wheels.map((wheel) => ({ ...wheel, wheel: { ...wheel.wheel, options: wheel.wheel.options.map((option) => ({ ...option })) } })),
    chains: pack.chains.map((chain) => ({ ...chain, steps: chain.steps.map((step) => ({ ...step })) })),
    ...(pack.tournamentPreset ? { tournamentPreset: { ...pack.tournamentPreset, scoring: pack.tournamentPreset.scoring ? { ...pack.tournamentPreset.scoring } : undefined } } : {}),
  };
}

function snapshotSelection(data: ReturnType<typeof loadData>, wheelIds: string[], chainIds: string[]): Pick<TemplatePack, "wheels" | "chains"> {
  const wheels = data.wheels.filter((item) => wheelIds.includes(item.id));
  const chains = data.chains.filter((item) => chainIds.includes(item.id));
  if (wheels.length !== new Set(wheelIds).size || chains.length !== new Set(chainIds).size) throw new Error("One or more selected pack items no longer exists.");
  const wheelTemplates = wheels.map(snapshotWheel);
  const wheelMap = new Map(wheels.map((item, index) => [item.id, wheelTemplates[index].id]));
  const chainTemplates: ChainTemplate[] = chains.map((source) => ({
    id: createId("pack_chain"), title: source.title, description: source.description, category: "creative",
    steps: source.steps.map((step) => ({ ...step, id: undefined, chainId: undefined, wheelId: undefined, wheelTemplateId: wheelMap.get(step.wheelId) ?? "" })) as unknown as ChainTemplate["steps"],
  }));
  if (chainTemplates.some((chain) => chain.steps.some((step) => !step.wheelTemplateId))) throw new Error("Every selected generator must include its referenced wheels.");
  return { wheels: wheelTemplates, chains: chainTemplates };
}

function preservePackComponentIds(existing: TemplatePack, selection: Pick<TemplatePack, "wheels" | "chains">): Pick<TemplatePack, "wheels" | "chains"> {
  const existingWheelsByTitle = new Map(existing.wheels.map((wheel) => [wheel.title, wheel.id]));
  const wheelIdMap = new Map<string, string>();
  const wheels = selection.wheels.map((wheel) => {
    const id = existingWheelsByTitle.get(wheel.title) ?? wheel.id;
    wheelIdMap.set(wheel.id, id);
    return { ...wheel, id };
  });
  const existingChainsByTitle = new Map(existing.chains.map((chain) => [chain.title, chain.id]));
  const chains = selection.chains.map((chain) => ({
    ...chain,
    id: existingChainsByTitle.get(chain.title) ?? chain.id,
    steps: chain.steps.map((step) => ({ ...step, wheelTemplateId: wheelIdMap.get(step.wheelTemplateId) ?? step.wheelTemplateId })),
  }));
  return { wheels, chains };
}

function namesById(items: Array<{ id: string; title: string }>): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.title]));
}

function changedIds<T extends { id: string }>(before: T[], after: T[]): string[] {
  const previous = new Map(before.map((item) => [item.id, JSON.stringify(item)]));
  return after.filter((item) => previous.has(item.id) && previous.get(item.id) !== JSON.stringify(item)).map((item) => item.id);
}

export function getTemplatePackDiff(before: TemplatePack, after: Pick<TemplatePack, "wheels" | "chains"> & { version: number }): TemplatePackDiff {
  const beforeWheels = namesById(before.wheels);
  const afterWheels = namesById(after.wheels);
  const beforeChains = namesById(before.chains);
  const afterChains = namesById(after.chains);
  return {
    fromVersion: before.version,
    toVersion: after.version,
    addedWheels: after.wheels.filter((item) => !beforeWheels.has(item.id)).map((item) => item.title),
    removedWheels: before.wheels.filter((item) => !afterWheels.has(item.id)).map((item) => item.title),
    changedWheels: changedIds(before.wheels, after.wheels).map((id) => afterWheels.get(id) ?? id),
    addedChains: after.chains.filter((item) => !beforeChains.has(item.id)).map((item) => item.title),
    removedChains: before.chains.filter((item) => !afterChains.has(item.id)).map((item) => item.title),
    changedChains: changedIds(before.chains, after.chains).map((id) => afterChains.get(id) ?? id),
  };
}

export function getTemplatePacks(): TemplatePack[] { return [...templatePacks, ...loadData().userTemplatePacks]; }
export function getTemplatePack(packId: string): TemplatePack | undefined { return getTemplatePacks().find((pack) => pack.id === packId); }

export function togglePackFavorite(packId: string): boolean {
  if (!getTemplatePack(packId)) return false;
  const data = loadData();
  const active = data.favoritePackIds.includes(packId);
  saveData({ ...data, favoritePackIds: active ? data.favoritePackIds.filter((id) => id !== packId) : [...data.favoritePackIds, packId] });
  return !active;
}

export function previewTemplatePackInstall(packId: string): TemplatePackInstallPreview | undefined {
  const pack = getTemplatePack(packId);
  if (!pack) return undefined;
  const warnings: string[] = getTemplatePackValidationErrors(pack);
  const missing = pack.chains.flatMap((item) => item.steps.map((step) => step.wheelTemplateId)).filter((id) => !pack.wheels.some((item) => item.id === id));
  if (missing.length) warnings.push(`Missing wheel references: ${[...new Set(missing)].join(", ")}.`);
  return { pack, wheelCount: pack.wheels.length, chainCount: pack.chains.length, warnings };
}

export function installTemplatePack(packId: string): { wheels: Wheel[]; chains: SpinChain[]; tournamentPreset?: TemplatePack["tournamentPreset"] } | undefined {
  const pack = getTemplatePack(packId);
  if (!pack) return undefined;
  const validationErrors = getTemplatePackValidationErrors(pack);
  if (validationErrors.length > 0) throw new Error(`Cannot install ${pack.title}: ${validationErrors.join(" ")}`);
  const data = loadData();
  const wheelIds = new Map<string, string>();
  const wheels: Wheel[] = [];
  for (const source of pack.wheels) {
    const created = cloneWheel(source.wheel, source.title, source.description);
    wheels.push(created); wheelIds.set(source.id, created.id);
  }
  const chains: SpinChain[] = [];
  for (const source of pack.chains) {
    const chainId = createId("chain");
    const stepIds = new Map(source.steps.map((step) => [step.title + step.order, createId("step")]));
    const steps = source.steps.map((step) => {
      const wheelId = wheelIds.get(step.wheelTemplateId);
      if (!wheelId) throw new Error(`Pack ${pack.title} has an unresolved wheel reference.`);
      return {
        ...step, id: stepIds.get(step.title + step.order)!, chainId, wheelId,
        fallbackWheelId: step.fallbackWheelId ? wheelIds.get(step.fallbackWheelId) : undefined,
        dependsOnStepId: step.dependsOnStepId ? stepIds.get(step.dependsOnStepId) : undefined,
      };
    });
    const now = new Date().toISOString();
    chains.push({ id: chainId, title: source.title, description: source.description, steps, createdAt: now, updatedAt: now });
  }
  const recentPackIds = [pack.id, ...data.recentPackIds.filter((id) => id !== pack.id)].slice(0, MAX_RECENT);
  saveData({ ...data, wheels: [...wheels, ...data.wheels], chains: [...chains, ...data.chains], recentPackIds });
  return { wheels, chains, tournamentPreset: pack.tournamentPreset };
}

export function saveSelectionAsTemplatePack(title: string, description: string, wheelIds: string[], chainIds: string[]): TemplatePack {
  const data = loadData();
  if (!title.trim()) throw new Error("Give this pack a name.");
  const selection = snapshotSelection(data, wheelIds, chainIds);
  const now = new Date().toISOString();
  const pack: TemplatePack = { id: createId("pack"), title: title.trim(), description: description.trim(), category: "creative", tags: [], version: 1, source: "user", createdAt: now, updatedAt: now, ...selection, history: [] };
  saveData({ ...data, userTemplatePacks: [pack, ...data.userTemplatePacks] });
  return pack;
}

export function updateTemplatePackFromSelection(packId: string, wheelIds: string[], chainIds: string[]): { pack: TemplatePack; diff: TemplatePackDiff } | undefined {
  const data = loadData();
  const existing = data.userTemplatePacks.find((pack) => pack.id === packId);
  if (!existing) return undefined;
  const selection = preservePackComponentIds(existing, snapshotSelection(data, wheelIds, chainIds));
  const nextVersion = existing.version + 1;
  const updated: TemplatePack = {
    ...existing,
    ...selection,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    history: [...(existing.history ?? []), snapshotRevision(existing)],
  };
  const diff = getTemplatePackDiff(existing, { ...selection, version: nextVersion });
  saveData({ ...data, userTemplatePacks: data.userTemplatePacks.map((pack) => pack.id === packId ? updated : pack) });
  return { pack: updated, diff };
}

export function restoreTemplatePackVersion(packId: string, version: number): TemplatePack | undefined {
  const data = loadData();
  const existing = data.userTemplatePacks.find((pack) => pack.id === packId);
  const revision = existing?.history?.find((item) => item.version === version);
  if (!existing || !revision) return undefined;
  const restored: TemplatePack = {
    ...existing,
    wheels: revision.wheels.map((wheel) => ({ ...wheel, wheel: { ...wheel.wheel, options: wheel.wheel.options.map((option) => ({ ...option })) } })),
    chains: revision.chains.map((chain) => ({ ...chain, steps: chain.steps.map((step) => ({ ...step })) })),
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
    history: [...(existing.history ?? []), snapshotRevision(existing)],
  };
  saveData({ ...data, userTemplatePacks: data.userTemplatePacks.map((pack) => pack.id === packId ? restored : pack) });
  return restored;
}

export function renameTemplatePack(packId: string, title: string): TemplatePack | undefined {
  const data = loadData(); const existing = data.userTemplatePacks.find((pack) => pack.id === packId);
  if (!existing) return undefined; if (!title.trim()) throw new Error("Give this pack a name.");
  const updated = { ...existing, title: title.trim(), updatedAt: new Date().toISOString() };
  saveData({ ...data, userTemplatePacks: data.userTemplatePacks.map((pack) => pack.id === packId ? updated : pack) }); return updated;
}

export function deleteTemplatePack(packId: string): void {
  const data = loadData(); saveData({ ...data, userTemplatePacks: data.userTemplatePacks.filter((pack) => pack.id !== packId), favoritePackIds: data.favoritePackIds.filter((id) => id !== packId), recentPackIds: data.recentPackIds.filter((id) => id !== packId) });
}

export function exportTemplatePack(packId: string): string {
  const pack = loadData().userTemplatePacks.find((item) => item.id === packId) ?? templatePacks.find((item) => item.id === packId);
  if (!pack) throw new Error("Template pack not found."); return JSON.stringify(pack, null, 2);
}

export function importTemplatePack(json: string): TemplatePack {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error("This is not valid pack JSON."); }
  const validationErrors = getTemplatePackValidationErrors(parsed);
  if (validationErrors.length > 0) throw new Error(`This file is not a supported WheelForge template pack. ${validationErrors.join(" ")}`);
  const source = parsed as TemplatePack;
  const now = new Date().toISOString();
  const imported: TemplatePack = { ...source, id: createId("pack"), source: "user", version: source.version, createdAt: now, updatedAt: now };
  const data = loadData(); saveData({ ...data, userTemplatePacks: [imported, ...data.userTemplatePacks] });
  return imported;
}
