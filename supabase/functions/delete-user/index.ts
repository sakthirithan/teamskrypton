import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Validate JWT from authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify JWT and get claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentUserId = claimsData.claims.sub as string;

    // Check if current user is TL or VC
    const { data: isCaptainOrVice } = await supabaseAdmin.rpc('is_captain_or_vice', { 
      _user_id: currentUserId 
    });

    if (!isCaptainOrVice) {
      return new Response(JSON.stringify({ error: "Only Team Captain or Vice Captain can delete users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "Target user ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion
    if (targetUserId === currentUserId) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Hard deleting user ${targetUserId} by ${currentUserId}`);

    // HARD DELETE - Delete ALL user data in correct order

    // 1. Delete approval votes by this user
    await supabaseAdmin
      .from('approval_votes')
      .delete()
      .eq('voter_id', targetUserId);

    // 2. Delete task documents for this user
    await supabaseAdmin
      .from('task_documents')
      .delete()
      .eq('user_id', targetUserId);

    // 3. Delete workflow logs for this user
    await supabaseAdmin
      .from('workflow_log')
      .delete()
      .eq('user_id', targetUserId);

    // 4. Delete approvals related to this user
    await supabaseAdmin
      .from('approvals')
      .delete()
      .or(`target_user_id.eq.${targetUserId},initiated_by.eq.${targetUserId}`);

    // 5. Delete tasks assigned to this user
    await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('assigned_to', targetUserId);

    // 6. Delete tasks assigned BY this user
    await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('assigned_by', targetUserId);

    // 7. Delete user roles
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId);

    // 8. Delete user profile
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', targetUserId);

    // 9. Delete from Supabase Auth (this logs them out immediately)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError);
      // Continue anyway - the user data is already deleted
    }

    console.log(`User ${targetUserId} hard deleted successfully`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in delete-user function:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
