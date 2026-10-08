import type { ParticipantProfile } from "../types";
import { createId } from "../utils/ids";
import { loadData, saveData } from "./storageService";

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function participantKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase();
}

export function getParticipants(includeArchived = true): ParticipantProfile[] {
  const participants = loadData().participants;
  return includeArchived ? participants : participants.filter((participant) => participant.status === "active");
}

export function createParticipant(input: Pick<ParticipantProfile, "name" | "email" | "group" | "notes">): ParticipantProfile {
  const name = normalizeName(input.name);
  if (!name) throw new Error("Participant name is required.");
  if (getParticipants().some((participant) => participant.status === "active" && participantKey(participant.name) === participantKey(name))) {
    throw new Error("An active participant with that name already exists.");
  }
  const now = new Date().toISOString();
  const participant: ParticipantProfile = {
    id: createId("participant"),
    name,
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.group?.trim() ? { group: input.group.trim() } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  saveData({ ...loadData(), participants: [participant, ...getParticipants()] });
  return participant;
}

export function updateParticipant(id: string, input: Pick<ParticipantProfile, "name" | "email" | "group" | "notes">): ParticipantProfile {
  const current = getParticipants().find((participant) => participant.id === id);
  if (!current) throw new Error("Participant not found.");
  const name = normalizeName(input.name);
  if (!name) throw new Error("Participant name is required.");
  if (getParticipants().some((participant) => participant.id !== id && participant.status === "active" && participantKey(participant.name) === participantKey(name))) {
    throw new Error("An active participant with that name already exists.");
  }
  const updated: ParticipantProfile = {
    ...current,
    name,
    ...(input.email?.trim() ? { email: input.email.trim() } : { email: undefined }),
    ...(input.group?.trim() ? { group: input.group.trim() } : { group: undefined }),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : { notes: undefined }),
    updatedAt: new Date().toISOString(),
  };
  saveData({ ...loadData(), participants: getParticipants().map((participant) => participant.id === id ? updated : participant) });
  return updated;
}

export function setParticipantStatus(id: string, status: ParticipantProfile["status"]): ParticipantProfile {
  const current = getParticipants().find((participant) => participant.id === id);
  if (!current) throw new Error("Participant not found.");
  const updated = { ...current, status, updatedAt: new Date().toISOString() };
  saveData({ ...loadData(), participants: getParticipants().map((participant) => participant.id === id ? updated : participant) });
  return updated;
}

export function deleteParticipant(id: string): void {
  if (!getParticipants().some((participant) => participant.id === id)) throw new Error("Participant not found.");
  saveData({ ...loadData(), participants: getParticipants().filter((participant) => participant.id !== id) });
}
