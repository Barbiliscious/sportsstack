import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlayerPayload {
  email: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  date_of_birth: string | null;
  phone: string | null;
  suburb: string | null;
  hockey_vic_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  team_id: string;
  membership_type: "PRIMARY" | "PERMANENT" | "FILL_IN";
}

const ADMIN_ROLES = ["SUPER_ADMIN", "ASSOCIATION_ADMIN", "CLUB_ADMIN", "TEAM_MANAGER", "COACH"];

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

    // Verify caller
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

    // Parse body
    const payload: PlayerPayload = await req.json();

    if (!payload.email || !payload.first_name || !payload.last_name || !payload.team_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, first_name, last_name, team_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for admin operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Scope validation ---
    // Fetch caller's roles
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
      // Resolve target team's club and association
      const { data: targetTeam } = await serviceClient
        .from("teams")
        .select("id, club_id")
        .eq("id", payload.team_id)
        .single();

      if (!targetTeam) {
        return new Response(JSON.stringify({ error: "Team not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: targetClub } = await serviceClient
        .from("clubs")
        .select("id, association_id")
        .eq("id", targetTeam.club_id)
        .single();

      let hasScope = false;

      for (const cr of callerRoles) {
        if (!ADMIN_ROLES.includes(cr.role)) continue;

        if (cr.role === "ASSOCIATION_ADMIN" && cr.association_id && targetClub) {
          if (cr.association_id === targetClub.association_id) {
            hasScope = true;
            break;
          }
        }
        if (cr.role === "CLUB_ADMIN" && cr.club_id) {
          if (cr.club_id === targetTeam.club_id) {
            hasScope = true;
            break;
          }
        }
        if ((cr.role === "TEAM_MANAGER" || cr.role === "COACH") && cr.team_id) {
          if (cr.team_id === payload.team_id) {
            hasScope = true;
            break;
          }
        }
      }

      if (!hasScope) {
        return new Response(
          JSON.stringify({ error: "You do not have permission to add players to this team" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // --- Create auth user ---
    const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: payload.email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = newUser.user.id;

    // --- Update profile ---
    const { error: profileError } = await serviceClient
      .from("profiles")
      .update({
        first_name: payload.first_name,
        last_name: payload.last_name,
        gender: payload.gender || null,
        date_of_birth: payload.date_of_birth || null,
        phone: payload.phone || null,
        suburb: payload.suburb || null,
        hockey_vic_number: payload.hockey_vic_number || null,
        emergency_contact_name: payload.emergency_contact_name || null,
        emergency_contact_phone: payload.emergency_contact_phone || null,
        emergency_contact_relationship: payload.emergency_contact_relationship || null,
      })
      .eq("id", userId);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // --- Insert team membership ---
    const { error: membershipError } = await serviceClient.from("team_memberships").insert({
      user_id: userId,
      team_id: payload.team_id,
      membership_type: payload.membership_type || "PRIMARY",
      status: "APPROVED",
    });

    if (membershipError) {
      console.error("Membership insert error:", membershipError);
    }

    // --- Insert PLAYER role scoped to team ---
    const { error: roleError } = await serviceClient.from("user_roles").insert({
      user_id: userId,
      role: "PLAYER",
      team_id: payload.team_id,
    });

    if (roleError) {
      console.error("Role insert error:", roleError);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
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
