import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Approve User Account
 * 
 * Flow:
 * 1. User registers → auth account created immediately with their password
 * 2. Registration request stored (pending)
 * 3. TL/VC approves → this function creates the role, enabling login
 * 
 * No temporary passwords. User logs in with their registered password.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate caller is TL/VC
    const { data: { user: caller } } = await supabaseUser.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    if (!callerRole || !['team_captain', 'vice_captain'].includes(callerRole.role)) {
      return new Response(
        JSON.stringify({ error: 'Only Team Captain or Vice Captain can approve users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the registration request
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !request) {
      return new Response(
        JSON.stringify({ error: 'Registration request not found or already processed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user_id exists (user was created during registration)
    if (!request.user_id) {
      return new Response(
        JSON.stringify({ error: 'User account not found. User may need to re-register.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the user role (this enables login)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: request.user_id,
        role: request.requested_role
      });

    if (roleError) {
      console.error('Role creation error:', roleError);
      // Check if role already exists
      if (roleError.code !== '23505') { // Not a duplicate key error
        return new Response(
          JSON.stringify({ error: 'Failed to assign role: ' + roleError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update registration request status
    await supabaseAdmin
      .from('registration_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: caller.id
      })
      .eq('id', requestId);

    console.log(`User ${request.email} approved by ${caller.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User approved successfully',
        email: request.email,
        fullName: request.full_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
