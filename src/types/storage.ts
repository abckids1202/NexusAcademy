import type { SpinChain, ChainSession } from "./chain";
import type { SpinResult } from "./history";
import type { UserSettings } from "./settings";
import type { Wheel } from "./wheel";
import type { Tournament } from "./tournament";
import type { TemplatePack, UserTemplate } from "./templates";
import type { ParticipantProfile } from "./participant";

export type WheelForgeData = {
  version: 1;
  wheels: Wheel[];
  chains: SpinChain[];
  spinResults: SpinResult[];
  chainSessions: ChainSession[];
  tournaments: Tournament[];
  participants: ParticipantProfile[];
  favoriteTemplateIds: string[];
  recentTemplateIds: string[];
  userTemplates: UserTemplate[];
  userTemplatePacks: TemplatePack[];
  favoritePackIds: string[];
  recentPackIds: string[];
  settings: UserSettings;
};
