import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { WheelForgeData } from "../types";
import { loadData, parseImportData } from "./storageService";

export type CloudBackup = {
  data: WheelForgeData;
  updatedAt: string;
};

let client: SupabaseClient | undefined;

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : undefined;
}

export function isCloudBackupConfigured(): boolean {
  return Boolean(getConfig());
}

export function getCloudClient(): SupabaseClient | undefined {
  if (client) return client;
  const config = getConfig();
  if (!config) return undefined;
  client = createClient(config.url, config.publishableKey, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

function requireCloudClient(): SupabaseClient {
  const configuredClient = getCloudClient();
  if (!configuredClient) throw new Error("Cloud backup is not configured for this app.");
  return configuredClient;
}

export async function getCloudUser(): Promise<User | null> {
  const configuredClient = getCloudClient();
  if (!configuredClient) return null;
  const { data, error } = await configuredClient.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user;
}

export function subscribeToCloudUserChanges(onUser: (user: User | null) => void): () => void {
  const configuredClient = getCloudClient();
  if (!configuredClient) return () => undefined;
  const { data } = configuredClient.auth.onAuthStateChange((_event, session) => onUser(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await requireCloudClient().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await requireCloudClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function requestCloudPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await requireCloudClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updateCloudPassword(password: string): Promise<User> {
  const configuredClient = requireCloudClient();
  await requireUser();
  const { data, error } = await configuredClient.auth.updateUser({ password });
  if (error) throw error;
  return data.user;
}

export async function signOutCloudUser(): Promise<void> {
  const { error } = await requireCloudClient().auth.signOut();
  if (error) throw error;
}

export async function deleteCloudAccount(): Promise<void> {
  const configuredClient = requireCloudClient();
  const { data, error } = await configuredClient.functions.invoke("delete-account", { body: {} });
  if (error) throw error;
  if (!data?.deleted) throw new Error("Account deletion was not confirmed by the server.");

  await configuredClient.auth.signOut({ scope: "local" });
}

async function requireUser() {
  const user = await getCloudUser();
  if (!user) throw new Error("Sign in to manage your cloud backup.");
  return user;
}

export async function readCloudBackup(): Promise<CloudBackup | null> {
  const configuredClient = requireCloudClient();
  const user = await requireUser();
  const { data, error } = await configuredClient
    .from("wheelforge_workspaces")
    .select("payload, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    data: parseImportData(JSON.stringify(data.payload)),
    updatedAt: data.updated_at,
  };
}

export async function writeCloudBackup(workspace: WheelForgeData = loadData()): Promise<string> {
  const configuredClient = requireCloudClient();
  const user = await requireUser();
  const validatedWorkspace = parseImportData(JSON.stringify(workspace));
  const updatedAt = new Date().toISOString();
  const { error } = await configuredClient.from("wheelforge_workspaces").upsert({
    user_id: user.id,
    payload: validatedWorkspace,
    updated_at: updatedAt,
  }, { onConflict: "user_id" });
  if (error) throw error;
  return updatedAt;
}

export async function deleteCloudBackup(): Promise<void> {
  const configuredClient = requireCloudClient();
  const user = await requireUser();
  const { error } = await configuredClient.from("wheelforge_workspaces").delete().eq("user_id", user.id);
  if (error) throw error;
}
