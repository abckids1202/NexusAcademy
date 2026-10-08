import type { ParticipantProfile } from "../types";
import { createDataSelector } from "./useDataSelector";

const useParticipantSnapshot = createDataSelector((data) => data.participants, [] as ParticipantProfile[]);

export function useParticipants(includeArchived = true): ParticipantProfile[] {
  const participants = useParticipantSnapshot();
  return includeArchived ? participants : participants.filter((participant) => participant.status === "active");
}
