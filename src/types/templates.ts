import type { SpinChainStep } from "./chain";
import type { Wheel, WheelOption } from "./wheel";
import type { SpinChain } from "./chain";

export type UserTemplateBase = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type UserWheelTemplate = UserTemplateBase & {
  kind: "wheel";
  wheel: Wheel;
};

export type UserChainTemplate = UserTemplateBase & {
  kind: "chain";
  chain: SpinChain;
  wheels: Wheel[];
};

export type UserTemplate = UserWheelTemplate | UserChainTemplate;

export type WheelTemplate = {
  id: string;
  title: string;
  description: string;
  category: "decision" | "giveaway" | "classroom" | "creative" | "game";
  wheel: Omit<Wheel, "id" | "createdAt" | "updatedAt">;
};

export type ChainTemplateStep = Omit<SpinChainStep, "id" | "chainId" | "wheelId"> & {
  wheelTemplateId: string;
};

export type ChainTemplate = {
  id: string;
  title: string;
  description: string;
  category: "creative" | "giveaway" | "classroom" | "game";
  steps: ChainTemplateStep[];
};

export type TournamentPreset = {
  format: "single-elimination" | "round-robin";
  seeding: "entry-order" | "random" | "manual";
  roundRobinTiebreaker?: "seed" | "head-to-head";
  scoring?: { winPoints: number; drawPoints: number; lossPoints: number };
};

export type TemplatePackCategory = "classroom" | "giveaway" | "creative" | "game" | "tournament";

export type TemplatePackRevision = {
  version: number;
  createdAt: string;
  wheels: WheelTemplate[];
  chains: ChainTemplate[];
  tournamentPreset?: TournamentPreset;
};

export type TemplatePack = {
  id: string;
  title: string;
  description: string;
  category: TemplatePackCategory;
  tags: string[];
  version: number;
  source: "built-in" | "user";
  createdAt: string;
  updatedAt: string;
  wheels: WheelTemplate[];
  chains: ChainTemplate[];
  tournamentPreset?: TournamentPreset;
  history?: TemplatePackRevision[];
};

export type WheelOptionTemplate = Omit<WheelOption, "id" | "sortOrder"> & {
  sortOrder?: number;
};
