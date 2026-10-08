import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoData } from "../data/demoData";
import { STORAGE_KEY, importData, loadData, saveData } from "./storageService";
import {
  createChainFromUserTemplate,
  createWheelFromUserTemplate,
  deleteUserTemplate,
  renameUserTemplate,
  replaceChainTemplateFromSource,
  replaceWheelTemplateFromSource,
  saveChainAsTemplate,
  saveWheelAsTemplate,
  toggleTemplateFavorite,
} from "./templateService";
import { validateChain } from "../utils/validation";
import { getTemplatePacks, installTemplatePack, previewTemplatePackInstall, restoreTemplatePackVersion, saveSelectionAsTemplatePack, togglePackFavorite, updateTemplatePackFromSelection } from "./templatePackService";

function installWorkspace() {
  const values = new Map<string, string>([[STORAGE_KEY, JSON.stringify(createDemoData())]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  } as unknown as Window);
  return values;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("user-created templates", () => {
  it("saves an independent wheel snapshot and restores eliminated options in new copies", () => {
    installWorkspace();
    const source = loadData().wheels[0];
    source.spinMode = "elimination";
    source.options[0].isRemoved = true;
    saveData({ ...loadData(), wheels: [source, ...loadData().wheels.slice(1)] });

    const template = saveWheelAsTemplate(source.id, "Classroom Choices");
    expect(template.wheel.options.every((option) => !option.isRemoved)).toBe(true);
    source.title = "Changed original";
    saveData({ ...loadData(), wheels: [source, ...loadData().wheels.slice(1)] });

    const copy = createWheelFromUserTemplate(template.id)!;
    expect(copy.title).toBe("Classroom Choices");
    expect(copy.id).not.toBe(source.id);
    expect(copy.options.map((option) => option.id)).not.toEqual(template.wheel.options.map((option) => option.id));
    expect(copy.options.every((option) => !option.isRemoved)).toBe(true);
    expect(loadData().userTemplates[0].kind).toBe("wheel");
  });

  it("remaps generator wheel and step dependencies when creating a reusable copy", () => {
    installWorkspace();
    const data = loadData();
    const source = data.chains[0];
    source.steps[1] = {
      ...source.steps[1],
      conditionType: "equals",
      dependsOnStepId: source.steps[0].id,
      dependsOnResultValue: "Avery",
      fallbackWheelId: source.steps[2].wheelId,
    };
    saveData({ ...data, chains: [source] });

    const template = saveChainAsTemplate(source.id, "Saved Story Flow");
    expect(template.wheels).toHaveLength(4);
    const copy = createChainFromUserTemplate(template.id)!;
    const updated = loadData();
    const copiedConditional = copy.steps[1];
    expect(copiedConditional.id).not.toBe(source.steps[1].id);
    expect(copiedConditional.dependsOnStepId).toBe(copy.steps[0].id);
    expect(copiedConditional.fallbackWheelId).not.toBe(source.steps[2].wheelId);
    expect(updated.wheels.some((wheel) => wheel.id === copiedConditional.fallbackWheelId)).toBe(true);
    expect(validateChain(copy, updated.wheels)).toEqual([]);
    expect(importData(JSON.stringify(updated)).userTemplates).toEqual(updated.userTemplates);

    expect(toggleTemplateFavorite(template.id)).toBe(true);
    expect(renameUserTemplate(template.id, "Renamed Flow")?.title).toBe("Renamed Flow");
    deleteUserTemplate(template.id);
    expect(loadData().userTemplates).toEqual([]);
    expect(loadData().favoriteTemplateIds).not.toContain(template.id);
    expect(loadData().recentTemplateIds).not.toContain(template.id);
  });

  it("replaces saved template snapshots while preserving their identity and existing copies", () => {
    installWorkspace();
    const wheel = loadData().wheels[0];
    const wheelTemplate = saveWheelAsTemplate(wheel.id, "Lunch Template");
    const oldWheelCopy = createWheelFromUserTemplate(wheelTemplate.id)!;
    const updatedWheel = { ...wheel, options: wheel.options.map((option, index) => index === 0 ? { ...option, label: "Updated lunch choice" } : option) };
    saveData({ ...loadData(), wheels: loadData().wheels.map((item) => item.id === wheel.id ? updatedWheel : item) });

    const replacedWheelTemplate = replaceWheelTemplateFromSource(wheelTemplate.id, wheel.id)!;
    expect(replacedWheelTemplate.id).toBe(wheelTemplate.id);
    expect(replacedWheelTemplate.title).toBe("Lunch Template");
    expect(replacedWheelTemplate.wheel.options[0].label).toBe("Updated lunch choice");
    expect(oldWheelCopy.options[0].label).not.toBe("Updated lunch choice");

    const chain = loadData().chains[0];
    const chainTemplate = saveChainAsTemplate(chain.id, "Story Template");
    const changedChain = { ...chain, steps: chain.steps.map((step, index) => index === 0 ? { ...step, title: "Opening scene" } : step) };
    saveData({ ...loadData(), chains: loadData().chains.map((item) => item.id === chain.id ? changedChain : item) });
    const replacedChainTemplate = replaceChainTemplateFromSource(chainTemplate.id, chain.id)!;
    expect(replacedChainTemplate.id).toBe(chainTemplate.id);
    expect(replacedChainTemplate.title).toBe("Story Template");
    expect(replacedChainTemplate.chain.steps[0].title).toBe("Opening scene");
  });

  it("rejects user generator templates with a missing saved wheel dependency", () => {
    installWorkspace();
    const template = saveChainAsTemplate("demo_chain_fantasy_story", "Story");
    const data = loadData();
    data.userTemplates = [{ ...template, wheels: template.wheels.slice(1) }];
    expect(() => importData(JSON.stringify(data))).toThrow("Invalid or unsupported WheelForge backup.");
  });
});

describe("template packs", () => {
  it("previews and installs a built-in generator kit with fresh dependencies", () => {
    installWorkspace();
    const preview = previewTemplatePackInstall("fantasy-story-lab")!;
    expect(preview.wheelCount).toBe(4);
    expect(preview.chainCount).toBe(1);
    const result = installTemplatePack("fantasy-story-lab")!;
    expect(result.chains).toHaveLength(1);
    expect(result.wheels).toHaveLength(4);
    expect(result.chains[0].steps.every((step) => result.wheels.some((wheel) => wheel.id === step.wheelId))).toBe(true);
    expect(result.wheels.map((wheel) => wheel.id)).not.toContain("template_wheel_fantasy-factions");
    expect(loadData().recentPackIds[0]).toBe("fantasy-story-lab");
  });

  it("keeps pack favorites and built-in catalog separate from stored user packs", () => {
    installWorkspace();
    expect(getTemplatePacks().some((pack) => pack.id === "tournament-night")).toBe(true);
    expect(togglePackFavorite("tournament-night")).toBe(true);
    expect(loadData().favoritePackIds).toContain("tournament-night");
    expect(loadData().userTemplatePacks).toEqual([]);
  });

  it("versions custom packs independently and can restore a prior snapshot", () => {
    installWorkspace();
    const data = loadData();
    const initial = saveSelectionAsTemplatePack("My kit", "A test kit", [data.wheels[0].id], []);
    expect(initial.version).toBe(1);
    const updated = updateTemplatePackFromSelection(initial.id, [data.wheels[1].id], [])!;
    expect(updated.pack.version).toBe(2);
    expect(updated.pack.history?.map((revision) => revision.version)).toEqual([1]);
    expect(updated.diff.addedWheels).toHaveLength(1);
    expect(updated.diff.removedWheels).toHaveLength(1);

    const restored = restoreTemplatePackVersion(initial.id, 1)!;
    expect(restored.version).toBe(3);
    expect(restored.wheels[0].title).toBe(data.wheels[0].title);
    expect(restored.history?.map((revision) => revision.version)).toEqual([1, 2]);
    expect(loadData().userTemplatePacks[0].version).toBe(3);
  });
});
