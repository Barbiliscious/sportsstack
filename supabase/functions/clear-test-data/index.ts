import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const { association_id } = await req.json();

    if (!association_id) {
      return new Response(JSON.stringify({ error: "association_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is SUPER_ADMIN
    const { data: callerRoles } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "SUPER_ADMIN");

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Only Super Admins can clear test data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all clubs and teams in this association
    const { data: assocClubs } = await serviceClient
      .from("clubs")
      .select("id")
      .eq("association_id", association_id);
    const clubIds = (assocClubs || []).map((c) => c.id);

    if (clubIds.length === 0) {
      return new Response(
        JSON.stringify({ deleted_users: 0, deleted_memberships: 0, deleted_roles: 0, deleted_profiles: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: assocTeams } = await serviceClient
      .from("teams")
      .select("id")
      .in("club_id", clubIds);
    const teamIds = (assocTeams || []).map((t) => t.id);

    if (teamIds.length === 0) {
      return new Response(
        JSON.stringify({ deleted_users: 0, deleted_memberships: 0, deleted_roles: 0, deleted_profiles: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find all user IDs with memberships on these teams
    const { data: memberships } = await serviceClient
      .from("team_memberships")
      .select("user_id")
      .in("team_id", teamIds);
    const userIds = [...new Set((memberships || []).map((m) => m.user_id))];

    if (userIds.length === 0) {
      return new Response(
        JSON.stringify({ deleted_users: 0, deleted_memberships: 0, deleted_roles: 0, deleted_profiles: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete user_roles for these users scoped to these teams
    let deletedRoles = 0;
    for (const userId of userIds) {
      const { count } = await serviceClient
        .from("user_roles")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .in("team_id", teamIds);
      deletedRoles += count || 0;
      // Also delete association-scoped and club-scoped roles for these users
      const { count: c2 } = await serviceClient
        .from("user_roles")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .eq("association_id", association_id);
      deletedRoles += c2 || 0;
      const { count: c3 } = await serviceClient
        .from("user_roles")
        .delete({ count: "exact" })
        .eq("user_id", userId)
        .in("club_id", clubIds);
      deletedRoles += c3 || 0;
    }

    // Delete team_memberships for these teams
    const { count: deletedMemberships } = await serviceClient
      .from("team_memberships")
      .delete({ count: "exact" })
      .in("team_id", teamIds);

    // Now check which users have NO remaining memberships anywhere
    let deletedUsers = 0;
    let deletedProfiles = 0;
    for (const userId of userIds) {
      // Skip the caller
      if (userId === callerId) continue;

      const { data: remaining } = await serviceClient
        .from("team_memberships")
        .select("id")
        .eq("user_id", userId)
        .limit(1);

      if (!remaining || remaining.length === 0) {
        // No remaining memberships — delete remaining roles, profile, and auth user
        await serviceClient.from("user_roles").delete().eq("user_id", userId);
        await serviceClient.from("profiles").delete().eq("id", userId);
        deletedProfiles++;
        const { error: delErr } = await serviceClient.auth.admin.deleteUser(userId);
        if (!delErr) deletedUsers++;
      }
    }

    return new Response(
      JSON.stringify({
        deleted_users: deletedUsers,
        deleted_memberships: deletedMemberships || 0,
        deleted_roles: deletedRoles,
        deleted_profiles: deletedProfiles,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Clear test data error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
