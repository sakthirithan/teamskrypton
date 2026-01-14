import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function handles user response to deletion request (accept/decline) 
// and leadership voting when user declines
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentUserId = claimsData.user.id;
    const { approvalId, action, voteType } = await req.json();

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

    // Get current user's role and profile
    const { data: currentUserRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUserId)
      .single();

    const { data: currentProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('user_id', currentUserId)
      .single();

    // ACTION: User accepting/declining their own deletion
    if (action === 'accept' || action === 'decline') {
      // Verify this is the target user
      if (approval.target_user_id !== currentUserId) {
        return new Response(JSON.stringify({ error: "You can only respond to your own deletion request" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (approval.status !== 'pending') {
        return new Response(JSON.stringify({ error: "This request is no longer pending" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === 'accept') {
        // User accepts - immediately delete them
        console.log(`User ${currentUserId} accepted deletion`);
        
        // Get user info before deletion
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', currentUserId)
          .single();

        // Get initiator info
        const { data: initiatorProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', approval.initiated_by)
          .single();

        // Update approval status
        await supabaseAdmin
          .from('approvals')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', approvalId);

        // Perform hard delete
        await performHardDelete(supabaseAdmin, currentUserId);

        // Create notification for team
        await supabaseAdmin
          .from('approvals')
          .insert({
            approval_type: 'deletion_request',
            target_user_id: null,
            initiated_by: approval.initiated_by,
            reason: `${targetProfile?.full_name || 'A user'} accepted deletion requested by ${initiatorProfile?.full_name || 'Leadership'}`,
            status: 'approved'
          });

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Your account has been deleted. You will be logged out." 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } else {
        // User declines - escalate to leadership voting
        console.log(`User ${currentUserId} declined deletion, escalating to leadership`);

        await supabaseAdmin
          .from('approvals')
          .update({ 
            approval_type: 'deletion_vote',
            updated_at: new Date().toISOString() 
          })
          .eq('id', approvalId);

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Deletion declined. The request has been escalated to leadership for voting." 
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ACTION: Leadership voting on escalated deletion
    if (action === 'vote') {
      // Check if user is leadership (but not the initiator - they already voted by initiating)
      const { data: isLeadership } = await supabaseAdmin.rpc('is_leadership', { 
        _user_id: currentUserId 
      });

      if (!isLeadership) {
        return new Response(JSON.stringify({ error: "Only leadership can vote on deletion requests" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cannot vote on your own deletion
      if (approval.target_user_id === currentUserId) {
        return new Response(JSON.stringify({ error: "Cannot vote on your own deletion" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cannot vote if you initiated the request
      if (approval.initiated_by === currentUserId) {
        return new Response(JSON.stringify({ error: "You initiated this request, you cannot vote again" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already voted
      const { data: existingVote } = await supabaseAdmin
        .from('approval_votes')
        .select('id')
        .eq('approval_id', approvalId)
        .eq('voter_id', currentUserId)
        .single();

      if (existingVote) {
        return new Response(JSON.stringify({ error: "You have already voted on this request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Record the vote
      await supabaseAdmin
        .from('approval_votes')
        .insert({
          approval_id: approvalId,
          voter_id: currentUserId,
          vote_type: voteType // 'approve' or 'reject'
        });

      console.log(`Leader ${currentUserId} voted ${voteType} on deletion of ${approval.target_user_id}`);

      // If anyone votes approve, execute the deletion immediately
      if (voteType === 'approve') {
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('user_id', approval.target_user_id)
          .single();

        // Update approval status
        await supabaseAdmin
          .from('approvals')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', approvalId);

        // Perform hard delete
        await performHardDelete(supabaseAdmin, approval.target_user_id);

        // Create notification for team
        await supabaseAdmin
          .from('approvals')
          .insert({
            approval_type: 'deletion_request',
            target_user_id: null,
            initiated_by: currentUserId,
            reason: `${targetProfile?.full_name || 'A user'} was removed after leadership approval by ${currentProfile?.full_name || 'Leadership'}`,
            status: 'approved'
          });

        return new Response(JSON.stringify({ 
          success: true, 
          message: `User ${targetProfile?.full_name || 'Unknown'} has been deleted after your approval vote.`,
          deleted: true
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Vote recorded but not approved yet
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Your vote has been recorded." 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in handle-deletion-response function:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function performHardDelete(supabaseAdmin: any, targetUserId: string) {
  // Delete in correct order to handle foreign keys
  await supabaseAdmin.from('approval_votes').delete().eq('voter_id', targetUserId);
  await supabaseAdmin.from('task_alerts').delete().eq('created_by', targetUserId);
  await supabaseAdmin.from('task_documents').delete().eq('user_id', targetUserId);
  await supabaseAdmin.from('workflow_log').delete().eq('user_id', targetUserId);
  await supabaseAdmin.from('approvals').delete().or(`target_user_id.eq.${targetUserId},initiated_by.eq.${targetUserId}`);
  await supabaseAdmin.from('tasks').delete().eq('assigned_to', targetUserId);
  await supabaseAdmin.from('tasks').delete().eq('assigned_by', targetUserId);
  await supabaseAdmin.from('user_roles').delete().eq('user_id', targetUserId);
  await supabaseAdmin.from('profiles').delete().eq('user_id', targetUserId);
  
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
  if (error) console.error('Error deleting auth user:', error);
  
  console.log(`User ${targetUserId} hard deleted successfully`);
}
