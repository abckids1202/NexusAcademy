import type { SpinResult } from "./history";

export type ChainConditionType = "always" | "equals" | "notEquals" | "contains";

export type SpinChainStep = {
  id: string;
  chainId: string;
  title: string;
  wheelId: string;
  order: number;
  isRequired: boolean;
  autoSpinAfterPrevious: boolean;
  delayBeforeSpinMs: number;
  conditionType?: ChainConditionType;
  dependsOnStepId?: string;
  dependsOnResultValue?: string;
  fallbackWheelId?: string;
};

export type SpinChain = {
  id: string;
  title: string;
  description: string;
  steps: SpinChainStep[];
  createdAt: string;
  updatedAt: string;
};

export type ChainSessionResult = {
  stepId: string;
  stepTitle: string;
  wheelId: string;
  wheelTitle: string;
  result: SpinResult;
};

export type ChainSession = {
  status?: "in_progress" | "completed" | "abandoned";
  id: string;
  chainId: string;
  chainTitle: string;
  results: ChainSessionResult[];
  startedAt: string;
  completedAt?: string;
};
