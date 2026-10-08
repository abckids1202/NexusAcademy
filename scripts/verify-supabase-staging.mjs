import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const password = process.env.SUPABASE_TEST_PASSWORD?.trim();

if (!url || !publishableKey || !serviceRoleKey || !password) {
  throw new Error("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_TEST_PASSWORD.");
}

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = [
  process.env.SUPABASE_TEST_EMAIL_A?.trim() || `wheelforge-a-${suffix}@example.test`,
  process.env.SUPABASE_TEST_EMAIL_B?.trim() || `wheelforge-b-${suffix}@example.test`,
];
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const payload = { version: 1, wheels: [], chains: [], spinResults: [], chainSessions: [], settings: {} };
const createdUserIds = [];

function userClient() {
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function createTestUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  assert.ok(data.user?.id, `Supabase did not return an ID for ${email}`);
  createdUserIds.push(data.user.id);
  const client = userClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function rowsFor(client, userId) {
  const { data, error } = await client.from("wheelforge_workspaces").select("user_id").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

try {
  const first = await createTestUser(emails[0]);
  const second = await createTestUser(emails[1]);

  for (const [owner, other] of [[first, second], [second, first]]) {
    const { error: insertError } = await owner.client.from("wheelforge_workspaces").insert({ user_id: owner.id, payload });
    if (insertError) throw insertError;
    assert.equal((await rowsFor(owner.client, owner.id)).length, 1, "Owner could not read its own workspace.");
    assert.equal((await rowsFor(owner.client, other.id)).length, 0, "A user can read another user's workspace.");

    const { data: updatedRows, error: updateError } = await owner.client
      .from("wheelforge_workspaces")
      .update({ payload: { ...payload, marker: "unauthorized" } })
      .eq("user_id", other.id)
      .select("user_id");
    if (updateError) throw updateError;
    assert.equal(updatedRows?.length ?? 0, 0, "A user can update another user's workspace.");

    const { data: deletedRows, error: deleteError } = await owner.client
      .from("wheelforge_workspaces")
      .delete()
      .eq("user_id", other.id)
      .select("user_id");
    if (deleteError) throw deleteError;
    assert.equal(deletedRows?.length ?? 0, 0, "A user can delete another user's workspace.");
  }

  console.log(`Supabase staging RLS verification passed for ${emails.join(" and ")}.`);
} finally {
  for (const userId of createdUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId, false);
    if (error) console.warn(`Could not clean up staging test user ${userId}: ${error.message}`);
  }
}
