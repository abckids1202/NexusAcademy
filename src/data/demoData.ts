import type { SpinChain, Wheel, WheelForgeData } from "../types";
import { createId } from "../utils/ids";
import { defaultSettings } from "./settingsDefaults";
import { wheelTemplates } from "./wheelTemplates";

const DEMO_CREATED_AT = "2026-01-01T00:00:00.000Z";

function wheelFromTemplate(templateId: string, id: string): Wheel {
  const template = wheelTemplates.find((item) => item.id === templateId);

  if (!template) {
    throw new Error(`Missing demo wheel template: ${templateId}`);
  }

  return {
    ...template.wheel,
    id,
    options: template.wheel.options.map((option, index) => ({
      ...option,
      id: `${id}_option_${index + 1}`,
    })),
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
  };
}

export function createDemoData(): WheelForgeData {
  const foodWheel = wheelFromTemplate("food-picker", "demo_wheel_food_picker");
  const giveawayWheel = wheelFromTemplate(
    "giveaway-prize-wheel",
    "demo_wheel_giveaway_prizes",
  );
  const fantasyFactionWheel = wheelFromTemplate(
    "fantasy-factions",
    "demo_wheel_fantasy_factions",
  );
  const fantasyCharacterWheel = wheelFromTemplate(
    "fantasy-characters",
    "demo_wheel_fantasy_characters",
  );
  const fantasyLocationWheel = wheelFromTemplate(
    "fantasy-locations",
    "demo_wheel_fantasy_locations",
  );
  const fantasyConflictWheel = wheelFromTemplate(
    "fantasy-conflicts",
    "demo_wheel_fantasy_conflicts",
  );

  const fantasyChainId = "demo_chain_fantasy_story";
  const fantasyChain: SpinChain = {
    id: fantasyChainId,
    title: "Fantasy Story Generator",
    description: "A sample chain that spins from faction to conflict.",
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
    steps: [
      {
        id: createId("demo_step"),
        chainId: fantasyChainId,
        title: "Faction",
        wheelId: fantasyFactionWheel.id,
        order: 0,
        isRequired: true,
        autoSpinAfterPrevious: false,
        delayBeforeSpinMs: 700,
      },
      {
        id: createId("demo_step"),
        chainId: fantasyChainId,
        title: "Character",
        wheelId: fantasyCharacterWheel.id,
        order: 1,
        isRequired: true,
        autoSpinAfterPrevious: false,
        delayBeforeSpinMs: 700,
      },
      {
        id: createId("demo_step"),
        chainId: fantasyChainId,
        title: "Location",
        wheelId: fantasyLocationWheel.id,
        order: 2,
        isRequired: true,
        autoSpinAfterPrevious: false,
        delayBeforeSpinMs: 700,
      },
      {
        id: createId("demo_step"),
        chainId: fantasyChainId,
        title: "Conflict",
        wheelId: fantasyConflictWheel.id,
        order: 3,
        isRequired: true,
        autoSpinAfterPrevious: false,
        delayBeforeSpinMs: 700,
      },
    ],
  };

  return {
    version: 1,
    revision: 0,
    wheels: [
      foodWheel,
      giveawayWheel,
      fantasyFactionWheel,
      fantasyCharacterWheel,
      fantasyLocationWheel,
      fantasyConflictWheel,
    ],
    chains: [fantasyChain],
    spinResults: [],
    chainSessions: [],
    tournaments: [],
    participants: [],
    favoriteTemplateIds: [],
    recentTemplateIds: [],
    userTemplates: [],
    userTemplatePacks: [],
    favoritePackIds: [],
    recentPackIds: [],
    settings: { ...defaultSettings },
  };
}
