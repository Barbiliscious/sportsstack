import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlayerRow {
  first_name: string;
  last_name: string;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  hockey_vic_number: string | null;
  phone: string | null;
  suburb: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  team_id: string;
  row_number: number;
}

interface Payload {
  association_id: string;
  players: PlayerRow[];
}

const ADMIN_ROLES = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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
    const payload: Payload = await req.json();

    if (!payload.association_id || !payload.players || payload.players.length === 0) {
      return new Response(
        JSON.stringify({ error: "association_id and at least one player required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller has admin role with scope over this association
    const { data: callerRoles } = await serviceClient
      .from("user_roles")
      .select("role, association_id, club_id, team_id")
      .eq("user_id", callerId);

    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "No admin roles found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = callerRoles.some((r) => r.role === "SUPER_ADMIN");

    if (!isSuperAdmin) {
      // Check caller has scope over the association
      const hasAssocScope = callerRoles.some(
        (r) =>
          ADMIN_ROLES.includes(r.role) &&
          r.role === "ASSOCIATION_ADMIN" &&
          r.association_id === payload.association_id
      );

      if (!hasAssocScope) {
        // Check if caller has club/team scope within this association
        const { data: assocClubs } = await serviceClient
          .from("clubs")
          .select("id")
          .eq("association_id", payload.association_id);
        const assocClubIds = new Set((assocClubs || []).map((c) => c.id));

        const hasClubScope = callerRoles.some(
          (r) => r.role === "CLUB_ADMIN" && r.club_id && assocClubIds.has(r.club_id)
        );

        if (!hasClubScope) {
          const { data: assocTeams } = await serviceClient
            .from("teams")
            .select("id, club_id")
            .in("club_id", Array.from(assocClubIds));
          const assocTeamIds = new Set((assocTeams || []).map((t) => t.id));

          const hasTeamScope = callerRoles.some(
            (r) =>
              (r.role === "TEAM_MANAGER" || r.role === "COACH") &&
              r.team_id &&
              assocTeamIds.has(r.team_id)
          );

          if (!hasTeamScope) {
            return new Response(
              JSON.stringify({ error: "You do not have permission for this association" }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Process each player
    const created: number[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    for (const player of payload.players) {
      try {
        if (!player.first_name || !player.last_name) {
          errors.push({ row: player.row_number, error: "Missing first or last name" });
          continue;
        }

        if (!player.team_id) {
          errors.push({ row: player.row_number, error: "No team resolved" });
          continue;
        }

        // Email is required — skip rows without one
        if (!player.email) {
          errors.push({ row: player.row_number, error: "Email is required (skipped)" });
          continue;
        }

        // Invite user by email — player sets their own password via the link
        const { data: newUser, error: createError } =
          await serviceClient.auth.admin.inviteUserByEmail(
            player.email,
            { data: { first_name: player.first_name, last_name: player.last_name } }
          );

        if (createError) {
          errors.push({ row: player.row_number, error: createError.message });
          continue;
        }

        const userId = newUser.user.id;

        // Update profile
        await serviceClient.from("profiles").update({
          first_name: player.first_name,
          last_name: player.last_name,
          gender: player.gender || null,
          date_of_birth: player.date_of_birth || null,
          phone: player.phone || null,
          suburb: player.suburb || null,
          hockey_vic_number: player.hockey_vic_number || null,
          emergency_contact_name: player.emergency_contact_name || null,
          emergency_contact_phone: player.emergency_contact_phone || null,
          emergency_contact_relationship: player.emergency_contact_relationship || null,
        }).eq("id", userId);

        // Insert team membership (PRIMARY)
        await serviceClient.from("team_memberships").insert({
          user_id: userId,
          team_id: player.team_id,
          membership_type: "PRIMARY",
          status: "APPROVED",
        });

        // Insert player role
        await serviceClient.from("user_roles").insert({
          user_id: userId,
          role: "PLAYER",
          team_id: player.team_id,
        });

        created.push(player.row_number);
      } catch (err) {
        console.error(`Row ${player.row_number} error:`, err);
        errors.push({ row: player.row_number, error: "Unexpected error" });
      }
    }

    return new Response(
      JSON.stringify({ created: created.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
