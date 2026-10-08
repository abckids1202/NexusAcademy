import { describe, expect, it } from "vitest";
import { templatePacks } from "../data/templatePacks";
import { getTemplatePackValidationErrors, isValidTemplatePack } from "./templatePackValidation";

describe("template pack validation", () => {
  it("accepts the built-in packs and their complete wheel definitions", () => {
    expect(templatePacks.every(isValidTemplatePack)).toBe(true);
  });

  it("rejects malformed wheel definitions and missing chain references", () => {
    const source = structuredClone(templatePacks.find((pack) => pack.id === "fantasy-story-lab")!);
    source.wheels[0].wheel.options = [];
    source.chains[0].steps[0].wheelTemplateId = "missing-wheel";

    const errors = getTemplatePackValidationErrors(source);
    expect(errors).toEqual(expect.arrayContaining([
      "Wheel template 1 needs at least two options.",
      "Chain template 1 step 1 is invalid or references a missing wheel.",
    ]));
    expect(isValidTemplatePack(source)).toBe(false);
  });
});
