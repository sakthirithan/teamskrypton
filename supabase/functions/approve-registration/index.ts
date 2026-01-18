import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Create client with user's token for auth verification
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData?.user) {
      console.error('Auth error:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const callerUserId = userData.user.id

    // Create admin client for privileged operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if caller is captain or vice captain
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUserId)
      .maybeSingle()

    if (roleError || !roleData || !['team_captain', 'vice_captain'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Only Team Captain or Vice Captain can approve registrations' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const { requestId } = await req.json()
    if (!requestId) {
      return new Response(JSON.stringify({ error: 'Request ID is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Fetch the registration request
    const { data: request, error: fetchError } = await adminClient
      .from('registration_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .maybeSingle()

    if (fetchError || !request) {
      return new Response(JSON.stringify({ error: 'Registration request not found or already processed' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Create the auth user using admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: request.email,
      password: request.password_hash,
      email_confirm: true,
      user_metadata: {
        full_name: request.full_name,
        department: request.department,
        role: request.requested_role,
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      return new Response(JSON.stringify({ error: authError.message }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const newUserId = authData.user.id

    // Create profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        user_id: newUserId,
        full_name: request.full_name,
        email: request.email,
        department: request.department,
        current_status: 'idle',
        is_direct_access: false,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(newUserId)
      return new Response(JSON.stringify({ error: 'Failed to create profile' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Create user role
    const { error: roleInsertError } = await adminClient
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role: request.requested_role,
      })

    if (roleInsertError) {
      console.error('Role creation error:', roleInsertError)
    }

    // Update registration request status
    await adminClient
      .from('registration_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: callerUserId,
        user_id: newUserId,
      })
      .eq('id', requestId)

    return new Response(JSON.stringify({ 
      success: true, 
      userId: newUserId,
      message: `User ${request.full_name} has been approved and can now log in`
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
