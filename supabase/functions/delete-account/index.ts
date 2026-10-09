import { withSupabase } from "npm:@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (request, ctx) => {
    if (request.method !== "POST") {
      return Response.json({ error: "Only POST requests are supported." }, { status: 405, headers: { Allow: "POST" } });
    }

    const userId = ctx.userClaims?.sub ?? ctx.userClaims?.id;
    if (!userId) return Response.json({ error: "Sign-in is required." }, { status: 401 });

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId, false);
    if (error) {
      return Response.json({ error: "Account deletion failed." }, { status: 500 });
    }

    return Response.json({ deleted: true });
  }),
};
