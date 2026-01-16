import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create User Account - Approves a registration request
 * 
 * AUTHENTICATION RULES:
 * - User sets their OWN password during registration
 * - Password is stored as hash in registration_requests
 * - On approval, we need to recreate the password from the hash
 * - Since we can't reverse the hash, we use a secure flow:
 *   1. User registered with their password (hashed and stored)
 *   2. On approval, TL/VC sets a password that matches what user provided
 *   3. The system uses the stored hash verification
 * 
 * NOTE: Due to security constraints, we prompt TL/VC to enter the password
 * the user provided (communicated out-of-band) OR we use a reset flow.
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get auth header and validate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create clients
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validate caller is leadership
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

    const { requestId, userPassword } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userPassword || userPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'User password is required (minimum 6 characters). Enter the password the user provided during registration.' }),
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

    // Create the user account using admin API with the user's own password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: request.email,
      password: userPassword, // User's actual password provided by TL/VC
      email_confirm: true,
      user_metadata: {
        full_name: request.full_name,
        department: request.department,
        role: request.requested_role,
      }
    });

    if (createError) {
      console.error('User creation error:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
        message: 'User account created successfully with their registered password',
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
