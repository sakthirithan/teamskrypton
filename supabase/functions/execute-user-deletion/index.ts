import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function is called when a deletion is approved (either by user or by leadership vote)
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

    // Verify JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { approvalId } = await req.json();

    if (!approvalId) {
      return new Response(JSON.stringify({ error: "Approval ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the approval record
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('approvals')
      .select('*')
      .eq('id', approvalId)
      .single();

    if (approvalError || !approval) {
      return new Response(JSON.stringify({ error: "Approval not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (approval.status !== 'approved') {
      return new Response(JSON.stringify({ error: "Approval is not in approved status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUserId = approval.target_user_id;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "No target user ID in approval" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get target user info for notification
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', targetUserId)
      .single();

    // Get initiator info
    const { data: initiatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', approval.initiated_by)
      .single();

    console.log(`Executing deletion of user ${targetUserId}`);

    // Perform the hard delete
    await performHardDelete(supabaseAdmin, targetUserId);

    // Create a notification approval for all team members (read-only, auto-deletes after 24h)
    await supabaseAdmin
      .from('approvals')
      .insert({
        approval_type: 'deletion_request',
        target_user_id: null, // No target since user is deleted
        initiated_by: approval.initiated_by,
        reason: `${targetProfile?.full_name || 'A user'} was removed from the team by ${initiatorProfile?.full_name || 'Leadership'}. ${approval.reason || ''}`,
        status: 'approved' // Completed
      });

    return new Response(JSON.stringify({ 
      success: true, 
      message: `User ${targetProfile?.full_name || 'Unknown'} has been permanently deleted` 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in execute-user-deletion function:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function performHardDelete(supabaseAdmin: any, targetUserId: string) {
  // HARD DELETE - Delete ALL user data in correct order

  // 1. Delete approval votes by this user
  await supabaseAdmin
    .from('approval_votes')
    .delete()
    .eq('voter_id', targetUserId);

  // 2. Delete task alerts created by this user
  await supabaseAdmin
    .from('task_alerts')
    .delete()
    .eq('created_by', targetUserId);

  // 3. Delete task documents for this user
  await supabaseAdmin
    .from('task_documents')
    .delete()
    .eq('user_id', targetUserId);

  // 4. Delete workflow logs for this user
  await supabaseAdmin
    .from('workflow_log')
    .delete()
    .eq('user_id', targetUserId);

  // 5. Delete approvals related to this user
  await supabaseAdmin
    .from('approvals')
    .delete()
    .or(`target_user_id.eq.${targetUserId},initiated_by.eq.${targetUserId}`);

  // 6. Delete tasks assigned to this user
  await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('assigned_to', targetUserId);

  // 7. Delete tasks assigned BY this user
  await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('assigned_by', targetUserId);

  // 8. Delete user roles
  await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId);

  // 9. Delete user profile
  await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('user_id', targetUserId);

  // 10. Delete from Supabase Auth
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
  
  if (deleteError) {
    console.error('Error deleting auth user:', deleteError);
  }

  console.log(`User ${targetUserId} hard deleted successfully`);
}
