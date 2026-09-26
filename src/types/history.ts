import type { SpecialType, SpinMode } from "./wheel";

export type SpinResult = {
  id: string;
  wheelId: string;
  wheelTitle: string;
  optionId: string;
  resultLabel: string;
  resultColor: string;
  resultWeight: number;
  resultChance: number;
  specialType: SpecialType;
  spinMode?: SpinMode;
  removedOptionAfterSpin?: boolean;
  drawId?: string;
  drawPosition?: number;
  drawSize?: number;
  chainId?: string;
  chainStepId?: string;
  createdAt: string;
  spinIndex: number;
};
