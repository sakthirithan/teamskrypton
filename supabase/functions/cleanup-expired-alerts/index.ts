import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function runs on a schedule to clean up expired alerts
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

    const now = new Date().toISOString();

    // Delete expired task_alerts
    const { data: deletedAlerts, error: alertsError } = await supabaseAdmin
      .from('task_alerts')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (alertsError) {
      console.error('Error deleting expired alerts:', alertsError);
    } else {
      console.log(`Deleted ${deletedAlerts?.length || 0} expired task alerts`);
    }

    // Delete expired approvals (system notifications)
    const { data: deletedApprovals, error: approvalsError } = await supabaseAdmin
      .from('approvals')
      .delete()
      .lt('expires_at', now)
      .not('expires_at', 'is', null)
      .select('id');

    if (approvalsError) {
      console.error('Error deleting expired approvals:', approvalsError);
    } else {
      console.log(`Deleted ${deletedApprovals?.length || 0} expired approval notifications`);
    }

    // Delete expired grouping notes (48 hour expiry)
    const { data: deletedNotes, error: notesError } = await supabaseAdmin
      .from('grouping_notes')
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (notesError) {
      console.error('Error deleting expired notes:', notesError);
    } else {
      console.log(`Deleted ${deletedNotes?.length || 0} expired grouping notes`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      deletedAlerts: deletedAlerts?.length || 0,
      deletedApprovals: deletedApprovals?.length || 0,
      deletedNotes: deletedNotes?.length || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in cleanup-expired-alerts:", error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
