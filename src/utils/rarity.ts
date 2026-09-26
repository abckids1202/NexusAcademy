import type { SpecialType, WheelOption } from "../types";

export type RarityBand = "common" | "uncommon" | "rare" | "legendary" | "jackpot";

export function getRarityFromChance(chance: number): RarityBand {
  if (chance >= 0.2) {
    return "common";
  }

  if (chance >= 0.08) {
    return "uncommon";
  }

  if (chance >= 0.03) {
    return "rare";
  }

  if (chance >= 0.01) {
    return "legendary";
  }

  return "jackpot";
}

export function getSpecialAnimationType(
  option: WheelOption,
  chance: number,
): SpecialType {
  if (option.isSpecial && option.specialType !== "normal") {
    return option.specialType;
  }

  const rarity = getRarityFromChance(chance);

  return rarity === "common" ? "normal" : rarity;
}

export function getRarityLabel(type: SpecialType): string {
  const labels: Record<SpecialType, string> = {
    normal: "Result",
    uncommon: "Uncommon Result",
    rare: "Rare Result",
    legendary: "Legendary Hit",
    jackpot: "Jackpot",
    danger: "Danger Result",
    mystery: "Mystery Result",
    bonus: "Bonus Result",
  };

  return labels[type];
}
