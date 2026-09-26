import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyData } from "./storageService";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  invoke: vi.fn(),
  onAuthStateChange: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
  deleteEq: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const user = { id: "account-1", email: "owner@example.test" };
const selectQuery = {
  select: mocks.select,
  eq: vi.fn(),
  maybeSingle: mocks.maybeSingle,
};
const deleteQuery = { eq: mocks.deleteEq };

async function loadCloudService() {
  vi.resetModules();
  return import("./cloudBackupService");
}

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.createClient.mockReturnValue({
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    functions: { invoke: mocks.invoke },
    from: mocks.from,
  });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.select.mockReturnValue(selectQuery);
  selectQuery.eq = vi.fn().mockReturnValue(selectQuery);
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.deleteEq.mockResolvedValue({ error: null });
  mocks.invoke.mockResolvedValue({ data: { deleted: true }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ data: { user }, error: null });
  mocks.from.mockImplementation(() => ({
    select: mocks.select,
    upsert: mocks.upsert,
    delete: () => deleteQuery,
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("cloud backup adapter", () => {
  it("stays disabled until both public Supabase settings are present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    const cloud = await loadCloudService();
    expect(cloud.isCloudBackupConfigured()).toBe(false);
    expect(cloud.getCloudClient()).toBeUndefined();
    expect(await cloud.getCloudUser()).toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("stores a validated workspace under the authenticated account only", async () => {
    const cloud = await loadCloudService();
    const workspace = createEmptyData();
    const updatedAt = await cloud.writeCloudBackup(workspace);

    expect(updatedAt).toEqual(expect.any(String));
    expect(mocks.from).toHaveBeenCalledWith("wheelforge_workspaces");
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: user.id,
      payload: workspace,
    }), { onConflict: "user_id" });
  });

  it("validates downloaded payloads before exposing them to the app", async () => {
    const cloud = await loadCloudService();
    mocks.maybeSingle.mockResolvedValueOnce({
      data: { payload: createEmptyData(), updated_at: "2026-09-22T00:00:00.000Z" },
      error: null,
    });
    const backup = await cloud.readCloudBackup();
    expect(backup?.data).toEqual(createEmptyData());

    mocks.maybeSingle.mockResolvedValueOnce({
      data: { payload: { version: 900 }, updated_at: "2026-09-22T00:00:00.000Z" },
      error: null,
    });
    await expect(cloud.readCloudBackup()).rejects.toThrow("Invalid or unsupported WheelForge backup");
  });

  it("refuses to upload malformed workspaces", async () => {
    const cloud = await loadCloudService();
    await expect(cloud.writeCloudBackup({ version: 900 } as never)).rejects.toThrow("Invalid or unsupported WheelForge backup");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("requests deletion for the verified session and clears only the local auth session", async () => {
    const cloud = await loadCloudService();
    await cloud.deleteCloudAccount();

    expect(mocks.invoke).toHaveBeenCalledWith("delete-account", { body: {} });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not clear the session when server-side deletion fails", async () => {
    mocks.invoke.mockResolvedValueOnce({ data: null, error: new Error("Deletion failed") });
    const cloud = await loadCloudService();

    await expect(cloud.deleteCloudAccount()).rejects.toThrow("Deletion failed");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("requests password recovery only for the supplied email and exact redirect", async () => {
    const cloud = await loadCloudService();
    const redirectTo = "https://wheel.example/settings?password-reset=1";
    await cloud.requestCloudPasswordReset("owner@example.test", redirectTo);

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("owner@example.test", { redirectTo });
  });

  it("updates a password only while an authenticated cloud user is present", async () => {
    const cloud = await loadCloudService();
    await expect(cloud.updateCloudPassword("strong-password")).resolves.toEqual(user);
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "strong-password" });

    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(cloud.updateCloudPassword("another-password")).rejects.toThrow("Sign in to manage your cloud backup.");
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });
});
