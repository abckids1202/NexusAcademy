import { templatePacks } from "../data/templatePacks";
import type { ChainTemplate, TemplatePack, Wheel, WheelTemplate, SpinChain } from "../types";
import { createId } from "../utils/ids";
import { loadData, saveData } from "./storageService";

const MAX_RECENT = 8;

export type TemplatePackInstallPreview = {
  pack: TemplatePack;
  wheelCount: number;
  chainCount: number;
  warnings: string[];
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
  const warnings: string[] = [];
  const missing = pack.chains.flatMap((item) => item.steps.map((step) => step.wheelTemplateId)).filter((id) => !pack.wheels.some((item) => item.id === id));
  if (missing.length) warnings.push(`Missing wheel references: ${[...new Set(missing)].join(", ")}.`);
  return { pack, wheelCount: pack.wheels.length, chainCount: pack.chains.length, warnings };
}

export function installTemplatePack(packId: string): { wheels: Wheel[]; chains: SpinChain[]; tournamentPreset?: TemplatePack["tournamentPreset"] } | undefined {
  const pack = getTemplatePack(packId);
  if (!pack) return undefined;
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
  const wheels = data.wheels.filter((item) => wheelIds.includes(item.id));
  const chains = data.chains.filter((item) => chainIds.includes(item.id));
  if (!title.trim()) throw new Error("Give this pack a name.");
  const wheelTemplates = wheels.map(snapshotWheel);
  const wheelMap = new Map(wheels.map((item, index) => [item.id, wheelTemplates[index].id]));
  const chainTemplates: ChainTemplate[] = chains.map((source) => ({
    id: createId("pack_chain"), title: source.title, description: source.description, category: "creative",
    steps: source.steps.map((step) => ({ ...step, id: undefined, chainId: undefined, wheelId: undefined, wheelTemplateId: wheelMap.get(step.wheelId) ?? "" })) as unknown as ChainTemplate["steps"],
  }));
  const now = new Date().toISOString();
  const pack: TemplatePack = { id: createId("pack"), title: title.trim(), description: description.trim(), category: "creative", tags: [], version: 1, source: "user", createdAt: now, updatedAt: now, wheels: wheelTemplates, chains: chainTemplates };
  saveData({ ...data, userTemplatePacks: [pack, ...data.userTemplatePacks] });
  return pack;
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
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { wheels?: unknown }).wheels) || !Array.isArray((parsed as { chains?: unknown }).chains)) {
    throw new Error("This file is not a supported WheelForge template pack.");
  }
  const source = parsed as TemplatePack;
  const now = new Date().toISOString();
  const imported: TemplatePack = { ...source, id: createId("pack"), source: "user", version: source.version || 1, createdAt: now, updatedAt: now };
  const data = loadData(); saveData({ ...data, userTemplatePacks: [imported, ...data.userTemplatePacks] });
  return imported;
}
