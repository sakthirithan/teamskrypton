import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApproveRequest {
  requestId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client for user management
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create client with user's auth to verify permissions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify caller is TL or VC
    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check caller role
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (roleError || !roleData) {
      console.error("Role check error:", roleError);
      return new Response(
        JSON.stringify({ error: "Could not verify permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["team_captain", "vice_captain"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Only Team Captain or Vice Captain can approve registrations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { requestId }: ApproveRequest = await req.json();
    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "requestId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing approval for request: ${requestId}`);

    // Fetch the registration request
    const { data: request, error: fetchError } = await adminClient
      .from("registration_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      console.error("Fetch request error:", fetchError);
      return new Response(
        JSON.stringify({ error: "Registration request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already approved
    if (request.status === "approved") {
      console.log("Request already approved");
      return new Response(
        JSON.stringify({ success: true, message: "Already approved", userId: request.user_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists in auth (idempotent handling)
    let userId: string | null = null;
    
    // Try to find existing user by email
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (!listError && existingUsers?.users) {
      const existingUser = existingUsers.users.find(
        (u) => u.email?.toLowerCase() === request.email.toLowerCase()
      );
      if (existingUser) {
        console.log(`User already exists with ID: ${existingUser.id}`);
        userId = existingUser.id;
      }
    }

    // Create auth user if not exists
    if (!userId) {
      console.log("Creating new auth user...");
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: request.email,
        password: request.password_hash,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: request.full_name,
          department: request.department,
          role: request.requested_role,
        },
      });

      if (createError) {
        console.error("Create user error:", createError);
        return new Response(
          JSON.stringify({ error: `Failed to create user: ${createError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user!.id;
      console.log(`Created auth user with ID: ${userId}`);
    }

    // Check if profile exists
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

// ---------Remove this manual User creation ---------
    // if (!existingProfile) {
    //   console.log("Creating profile...");
    //   const { error: profileError } = await adminClient
    //     .from("profiles")
    //     .insert({
    //       user_id: userId,
    //       full_name: request.full_name,
    //       email: request.email,
    //       department: request.department,
    //       current_status: "idle",
    //       is_test: false,
    //     });

    // if (profileError) {
    //     console.error("Profile creation error:", profileError);
    //     // Don't fail - profile might be created by trigger
    //   }
    // } else {
    //   console.log("Profile already exists");
    // }

    // Check if role exists
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .single();

// ---------Remove this manual User creation ---------

    // if (!existingRole) {
    //   console.log("Assigning role...");
    //   const { error: roleInsertError } = await adminClient
    //     .from("user_roles")
    //     .insert({
    //       user_id: userId,
    //       role: request.requested_role,
    //     });

    //   if (roleInsertError) {
    //     console.error("Role assignment error:", roleInsertError);
    //     // Don't fail - role might be created by trigger
    //   }
    // } else {
    //   console.log("Role already assigned");
    // }

    // Update registration request status
    console.log("Updating request status to approved...");
    const { error: updateError } = await adminClient
      .from("registration_requests")
      .update({
        status: "approved",
        user_id: userId,
        reviewed_at: new Date().toISOString(),
        reviewed_by: caller.id,
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("Status update error:", updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update request status: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully approved registration for ${request.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User approved successfully",
        userId,
        email: request.email,
        fullName: request.full_name,
        role: request.requested_role,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
