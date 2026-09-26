import type { TemplatePack, WheelTemplate, ChainTemplate } from "../types";
import { wheelTemplates } from "./wheelTemplates";
import { chainTemplates } from "./chainTemplates";

const wheel = (id: string): WheelTemplate => {
  const found = wheelTemplates.find((item) => item.id === id);
  if (!found) throw new Error(`Missing built-in wheel template: ${id}`);
  return found;
};

const chain = (id: string): ChainTemplate => {
  const found = chainTemplates.find((item) => item.id === id);
  if (!found) throw new Error(`Missing built-in chain template: ${id}`);
  return found;
};

const pack = (
  id: string,
  title: string,
  description: string,
  category: TemplatePack["category"],
  tags: string[],
  wheels: string[],
  chains: string[] = [],
  tournamentPreset?: TemplatePack["tournamentPreset"],
): TemplatePack => ({
  id, title, description, category, tags, version: 1, source: "built-in",
  createdAt: "", updatedAt: "",
  wheels: wheels.map(wheel), chains: chains.map(chain), tournamentPreset,
});

export const templatePacks: TemplatePack[] = [
  pack("classroom-rotation", "Classroom Rotation", "Participation, selection, and quick classroom decisions in one ready-to-run kit.", "classroom", ["classroom", "students", "rotation"], ["classroom-picker", "food-picker"]),
  pack("giveaway-night", "Giveaway Night", "A prize wheel and supporting decision wheel for a smooth giveaway event.", "giveaway", ["giveaway", "prizes", "event"], ["giveaway-prize-wheel", "food-picker"]),
  pack("fantasy-story-lab", "Fantasy Story Lab", "A complete fantasy story generator plus its component worldbuilding wheels.", "creative", ["fantasy", "story", "worldbuilding"], ["fantasy-factions", "fantasy-characters", "fantasy-locations", "fantasy-conflicts"], ["fantasy-story-generator"]),
  pack("writing-prompt-lab", "Writing Prompt Lab", "A five-step writing prompt generator with reusable creative wheels.", "creative", ["writing", "prompt", "creative"], ["writing-genre", "writing-protagonist", "writing-setting", "writing-conflict", "writing-mood"], ["writing-prompt-generator"]),
  pack("tournament-night", "Tournament Night", "A host-ready kit for drawing conditions and running a single-elimination event.", "tournament", ["tournament", "bracket", "event"], ["giveaway-prize-wheel", "food-picker"], [], { format: "single-elimination", seeding: "random" }),
];
