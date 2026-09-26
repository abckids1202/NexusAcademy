# Optional Cloud Backup Setup

WheelForge stays usable without an account. The Supabase integration adds email/password authentication and an explicit, per-account cloud backup. It does not silently sync, merge simultaneous edits, or share projects with other users.

## Configure Supabase

1. Create a Supabase project and open its SQL Editor.
2. Run the migration in `supabase/migrations/202609220001_wheelforge_private_workspaces.sql`.
3. In Authentication settings, enable email/password sign-in and choose whether sign-up requires email confirmation. Configure SMTP/email delivery for confirmation and password reset messages. Add the local URL (`http://localhost:5173/**`) and the production Settings callback URL (`https://your-domain/settings?password-reset=1`) as allowed redirect URLs.
4. Copy the project URL and publishable key from the Supabase project Connect/API settings into a local `.env.local` file using `.env.example` as the template:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

5. Restart Vite after changing environment variables. The Settings page should now show the account form.
6. Create an account or sign in. Upload, restore, and delete cloud backups are separate, confirmed actions. Restoring replaces the current browser workspace; it never merges. Password recovery sends a generic response and returns through `/settings?password-reset=1`; the user must choose and confirm a new password there.
7. Keep the `[functions.delete-account]` setting in `supabase/config.toml` when deploying the function: it disables the legacy gateway JWT check so the current `@supabase/server` SDK can verify the user's JWT itself. The function explicitly requires `auth: "user"`; do not change it to `none`. Deploy from the repository root with `supabase functions deploy delete-account`. The Settings page requires password re-entry and typing `DELETE` before it invokes this endpoint.

The publishable key is expected in browser code. Row Level Security (RLS) and least-privilege grants protect each row. A secret or service-role key must never be added to `VITE_*` variables or committed to this repository.

## Data and Security Model

`public.wheelforge_workspaces` stores one JSONB backup per authenticated user. The primary key is the Auth user ID, user deletion cascades the backup row, and policies restrict select/insert/update/delete to `auth.uid() = user_id`. Anonymous database grants are revoked. The database checks that payloads are objects with WheelForge data version 1; the client also runs imported cloud payloads through the same complete backup validator used for file imports.

The browser never receives a service-role credential. Account deletion uses a signed-in Edge Function; it derives the target only from the verified JWT and uses the server-side admin client. Never accept a user ID from the browser or expose a service-role credential. Do not weaken RLS to make a failed request work. Fix missing grants or the owner policy in a reviewed migration instead.

## Test and Release Checks

Install the Supabase CLI and a Docker-compatible runtime. The repository already contains `supabase/config.toml`, migrations, and RLS tests; keep those files and start the local stack from the repository root:

```bash
supabase start
supabase db reset
supabase test db
```

Review the generated `supabase/config.toml` and set its Auth site URL and allowed redirect list for Vite's local origin (`http://localhost:5173`). For local app development, use the API URL and publishable key printed by `supabase status` in `.env.local` instead of the hosted project values. See the [Supabase CLI guide](https://supabase.com/docs/guides/local-development/cli/getting-started) for Windows CLI/container setup.

Before production, verify email delivery and confirmation, allowed redirect URLs, per-user isolation, account recovery, database backup/restore, account deletion, and the deployment's environment-variable configuration. Test a signed-in user against two separate accounts and verify neither can read, replace, or delete the other's row. Deleting the Auth user cascades its workspace row, but existing access tokens may remain valid until they expire; the UI clears this browser's local session. Local WheelForge data is intentionally unaffected. This app currently stores no user-owned Supabase Storage objects.

Automatic sync, collaboration, shared links, and server-side audit proofs are not provided by this integration.
