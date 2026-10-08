export type ParticipantStatus = "active" | "archived";

export type ParticipantProfile = {
  id: string;
  name: string;
  email?: string;
  group?: string;
  notes?: string;
  status: ParticipantStatus;
  createdAt: string;
  updatedAt: string;
};
