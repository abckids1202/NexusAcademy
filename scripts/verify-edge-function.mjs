import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const source = await readFile("supabase/functions/delete-account/index.ts", "utf8");

assert.match(source, /withSupabase\(\{\s*auth:\s*["']user["']/,
  "The account-deletion function must require a verified user session.");
assert.match(source, /request\.method\s*!==\s*["']POST["']/,
  "The account-deletion function must reject non-POST requests.");
assert.match(source, /deleteUser\(userId,\s*false\)/,
  "The account-deletion function must permanently delete the authenticated user.");
assert.match(source, /["']Cache-Control["']\s*:\s*["']no-store["']/,
  "The account-deletion function must mark responses as non-cacheable.");

const responseCalls = [...source.matchAll(/Response\.json\(/g)].length;
assert.equal(responseCalls, 4, "The account-deletion function should define responses for method, auth, failure, and success paths.");
assert.ok((source.match(/headers:/g) ?? []).length >= responseCalls,
  "Every account-deletion response must include explicit headers.");

console.log("Account-deletion Edge Function security invariants verified.");
