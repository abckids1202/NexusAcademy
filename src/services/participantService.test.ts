import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoData } from "../data/demoData";
import { createParticipant, deleteParticipant, setParticipantStatus, updateParticipant } from "./participantService";
import { loadData, resetData, saveData } from "./storageService";

beforeEach(() => {
  const values = new Map<string, string>([["wheelforge_data_v1", JSON.stringify(createDemoData())]]);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  } as unknown as Window);
  resetData();
  saveData(createDemoData());
});

afterEach(() => vi.unstubAllGlobals());

describe("participant directory", () => {
  it("creates normalized profiles and rejects active duplicate names", () => {
    const participant = createParticipant({ name: "  Avery   Chen ", email: "avery@example.com", group: "Blue", notes: "Captain" });
    expect(participant.name).toBe("Avery Chen");
    expect(loadData().participants).toHaveLength(1);
    expect(() => createParticipant({ name: "avery chen", email: "" })).toThrow("already exists");
  });

  it("archives and restores a profile without deleting its identity", () => {
    const participant = createParticipant({ name: "Jordan", email: "" });
    setParticipantStatus(participant.id, "archived");
    expect(loadData().participants[0].status).toBe("archived");
    setParticipantStatus(participant.id, "active");
    expect(loadData().participants[0]).toMatchObject({ id: participant.id, name: "Jordan", status: "active" });
  });

  it("updates optional fields and deletes a profile", () => {
    const participant = createParticipant({ name: "Sam", email: "sam@example.com" });
    const updated = updateParticipant(participant.id, { name: "Sam Rivera", email: "", group: "Green", notes: "" });
    expect(updated).toMatchObject({ name: "Sam Rivera", group: "Green" });
    expect(updated.email).toBeUndefined();
    deleteParticipant(participant.id);
    expect(loadData().participants).toEqual([]);
  });
});
