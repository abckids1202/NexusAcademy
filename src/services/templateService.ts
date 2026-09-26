import { chainTemplates } from "../data/chainTemplates";
import { wheelTemplates } from "../data/wheelTemplates";
import type {
  ChainTemplate,
  SpinChain,
  UserChainTemplate,
  UserTemplate,
  UserWheelTemplate,
  Wheel,
  WheelTemplate,
} from "../types";
import { createId } from "../utils/ids";
import { validateChain, validateWheel } from "../utils/validation";
import { createChain, getChain } from "./chainService";
import { loadData, saveData } from "./storageService";
import { createWheel, getWheel, getWheels } from "./wheelService";

const MAX_RECENT_TEMPLATES = 8;

function rememberTemplate(templateId: string): void {
  const data = loadData();
  saveData({
    ...data,
    recentTemplateIds: [templateId, ...data.recentTemplateIds.filter((id) => id !== templateId)]
      .slice(0, MAX_RECENT_TEMPLATES),
  });
}

function copyWheel(source: Wheel, title: string, description: string): Wheel {
  return createWheel({
    ...source,
    title,
    description,
    options: source.options.map((option, index) => ({
      ...option,
      id: createId("option"),
      sortOrder: index,
      isRemoved: false,
    })),
  });
}

function saveUserTemplate(template: UserTemplate): void {
  const data = loadData();
  saveData({ ...data, userTemplates: [...data.userTemplates, template] });
}

function makeWheelSnapshot(source: Wheel): Wheel {
  return {
    ...source,
    options: source.options.map((option) => ({ ...option, isRemoved: false })),
  };
}

function makeChainSnapshot(source: SpinChain): { chain: SpinChain; wheels: Wheel[] } {
  const availableWheels = getWheels();
  const wheelIds = new Set(source.steps.flatMap((step) => [step.wheelId, ...(step.fallbackWheelId ? [step.fallbackWheelId] : [])]));
  const wheels = availableWheels.filter((wheel) => wheelIds.has(wheel.id)).map(makeWheelSnapshot);
  const errors = validateChain(source, wheels);
  if (errors.length) throw new Error(errors.join(" "));
  return {
    chain: { ...source, steps: source.steps.map((step) => ({ ...step })) },
    wheels,
  };
}

export function toggleTemplateFavorite(templateId: string): boolean {
  const exists = wheelTemplates.some((template) => template.id === templateId) ||
    chainTemplates.some((template) => template.id === templateId) ||
    loadData().userTemplates.some((template) => template.id === templateId);
  if (!exists) return false;

  const data = loadData();
  const isFavorite = data.favoriteTemplateIds.includes(templateId);
  const favoriteTemplateIds = isFavorite
    ? data.favoriteTemplateIds.filter((id) => id !== templateId)
    : [...data.favoriteTemplateIds, templateId];
  saveData({ ...data, favoriteTemplateIds });
  return !isFavorite;
}

export function getWheelTemplates(): WheelTemplate[] {
  return wheelTemplates;
}

export function getWheelTemplate(templateId: string): WheelTemplate | undefined {
  return wheelTemplates.find((template) => template.id === templateId);
}

export function getChainTemplates(): ChainTemplate[] {
  return chainTemplates;
}

export function getChainTemplate(templateId: string): ChainTemplate | undefined {
  return chainTemplates.find((template) => template.id === templateId);
}

export function getUserTemplates(): UserTemplate[] {
  return loadData().userTemplates;
}

export function saveWheelAsTemplate(wheelId: string, title: string): UserWheelTemplate {
  const source = getWheel(wheelId);
  if (!source) throw new Error("This wheel no longer exists.");
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Give this template a name.");

  const snapshot = makeWheelSnapshot(source);
  const errors = validateWheel(snapshot);
  if (errors.length) throw new Error(errors.join(" "));

  const now = new Date().toISOString();
  const template: UserWheelTemplate = {
    id: createId("user_template"),
    kind: "wheel",
    title: normalizedTitle,
    description: source.description,
    wheel: snapshot,
    createdAt: now,
    updatedAt: now,
  };
  saveUserTemplate(template);
  return template;
}

export function saveChainAsTemplate(chainId: string, title: string): UserChainTemplate {
  const source = getChain(chainId);
  if (!source) throw new Error("This generator no longer exists.");
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Give this template a name.");

  const snapshot = makeChainSnapshot(source);
  const now = new Date().toISOString();
  const template: UserChainTemplate = {
    id: createId("user_template"),
    kind: "chain",
    title: normalizedTitle,
    description: source.description,
    chain: snapshot.chain,
    wheels: snapshot.wheels,
    createdAt: now,
    updatedAt: now,
  };
  saveUserTemplate(template);
  return template;
}

export function replaceWheelTemplateFromSource(templateId: string, wheelId: string): UserWheelTemplate | undefined {
  const data = loadData();
  const template = data.userTemplates.find((item) => item.id === templateId);
  const source = data.wheels.find((wheel) => wheel.id === wheelId);
  if (!template || template.kind !== "wheel" || !source) return undefined;
  const snapshot = makeWheelSnapshot(source);
  const errors = validateWheel(snapshot);
  if (errors.length) throw new Error(errors.join(" "));
  const updated: UserWheelTemplate = {
    ...template,
    description: source.description,
    wheel: snapshot,
    updatedAt: new Date().toISOString(),
  };
  saveData({ ...data, userTemplates: data.userTemplates.map((item) => item.id === templateId ? updated : item) });
  return updated;
}

export function replaceChainTemplateFromSource(templateId: string, chainId: string): UserChainTemplate | undefined {
  const data = loadData();
  const template = data.userTemplates.find((item) => item.id === templateId);
  const source = data.chains.find((chain) => chain.id === chainId);
  if (!template || template.kind !== "chain" || !source) return undefined;
  const snapshot = makeChainSnapshot(source);
  const updated: UserChainTemplate = {
    ...template,
    description: source.description,
    chain: snapshot.chain,
    wheels: snapshot.wheels,
    updatedAt: new Date().toISOString(),
  };
  saveData({ ...data, userTemplates: data.userTemplates.map((item) => item.id === templateId ? updated : item) });
  return updated;
}

export function renameUserTemplate(templateId: string, title: string): UserTemplate | undefined {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("Give this template a name.");
  const data = loadData();
  const existing = data.userTemplates.find((item) => item.id === templateId);
  if (!existing) return undefined;
  const updated: UserTemplate = { ...existing, title: normalizedTitle, updatedAt: new Date().toISOString() };
  saveData({ ...data, userTemplates: data.userTemplates.map((item) => item.id === templateId ? updated : item) });
  return updated;
}

export function deleteUserTemplate(templateId: string): void {
  const data = loadData();
  saveData({
    ...data,
    userTemplates: data.userTemplates.filter((item) => item.id !== templateId),
    favoriteTemplateIds: data.favoriteTemplateIds.filter((id) => id !== templateId),
    recentTemplateIds: data.recentTemplateIds.filter((id) => id !== templateId),
  });
}

export function createWheelFromUserTemplate(templateId: string): Wheel | undefined {
  const template = loadData().userTemplates.find((item) => item.id === templateId);
  if (!template || template.kind !== "wheel") return undefined;
  const wheel = copyWheel(template.wheel, template.title, template.description);
  rememberTemplate(template.id);
  return wheel;
}

export function createChainFromUserTemplate(templateId: string): SpinChain | undefined {
  const template = loadData().userTemplates.find((item) => item.id === templateId);
  if (!template || template.kind !== "chain") return undefined;

  const wheelIds = new Map<string, string>();
  for (const sourceWheel of template.wheels) {
    const wheel = copyWheel(sourceWheel, sourceWheel.title, sourceWheel.description);
    wheelIds.set(sourceWheel.id, wheel.id);
  }

  const stepIds = new Map(template.chain.steps.map((step) => [step.id, createId("step")]));
  const steps = [];
  for (const step of template.chain.steps) {
    const wheelId = wheelIds.get(step.wheelId);
    const fallbackWheelId = step.fallbackWheelId ? wheelIds.get(step.fallbackWheelId) : undefined;
    if (!wheelId || (step.fallbackWheelId && !fallbackWheelId)) return undefined;
    steps.push({
      ...step,
      id: stepIds.get(step.id)!,
      chainId: "",
      wheelId,
      fallbackWheelId,
      dependsOnStepId: step.dependsOnStepId ? stepIds.get(step.dependsOnStepId) : undefined,
    });
  }

  const chain = createChain({ title: template.title, description: template.description, steps });
  rememberTemplate(template.id);
  return chain;
}

export function createWheelFromTemplate(templateId: string): Wheel | undefined {
  const template = getWheelTemplate(templateId);
  if (!template) return undefined;
  const source: Wheel = {
    ...template.wheel,
    id: "",
    createdAt: "",
    updatedAt: "",
  };
  const wheel = copyWheel(source, template.title, template.description);
  rememberTemplate(templateId);
  return wheel;
}

export function createChainFromTemplate(templateId: string): SpinChain | undefined {
  const template = getChainTemplate(templateId);
  if (!template) return undefined;

  const wheelsByTemplateId = new Map<string, Wheel>();
  for (const step of template.steps) {
    if (wheelsByTemplateId.has(step.wheelTemplateId)) continue;
    const wheelTemplate = getWheelTemplate(step.wheelTemplateId);
    if (!wheelTemplate) return undefined;
    const source: Wheel = {
      ...wheelTemplate.wheel,
      id: "",
      createdAt: "",
      updatedAt: "",
    };
    wheelsByTemplateId.set(step.wheelTemplateId, copyWheel(source, wheelTemplate.title, wheelTemplate.description));
  }

  const chainId = createId("chain");
  const steps = template.steps.map((step) => {
    const wheel = wheelsByTemplateId.get(step.wheelTemplateId);
    if (!wheel) throw new Error(`Missing wheel for chain template step: ${step.title}`);
    return {
      id: createId("step"),
      chainId,
      title: step.title,
      wheelId: wheel.id,
      order: step.order,
      isRequired: step.isRequired,
      autoSpinAfterPrevious: step.autoSpinAfterPrevious,
      delayBeforeSpinMs: step.delayBeforeSpinMs,
    };
  });
  const chain = createChain({ title: template.title, description: template.description, steps });
  rememberTemplate(templateId);
  return chain;
}
