export type SpecialType =
  | "normal"
  | "uncommon"
  | "rare"
  | "legendary"
  | "jackpot"
  | "danger"
  | "mystery"
  | "bonus";

export type VisualMode = "equal" | "weighted";

export type SpinMode = "normal" | "elimination" | "no-repeat" | "accumulation";

export type WheelOption = {
  id: string;
  label: string;
  color: string;
  textColor: string;
  weight: number;
  isActive: boolean;
  isRemoved?: boolean;
  isSpecial?: boolean;
  specialType: SpecialType;
  sortOrder: number;
};

export type Wheel = {
  id: string;
  title: string;
  description: string;
  options: WheelOption[];
  visualMode: VisualMode;
  spinMode: SpinMode;
  removeWinnerAfterSpin: boolean;
  spinDurationMs: number;
  theme: string;
  createdAt: string;
  updatedAt: string;
};
