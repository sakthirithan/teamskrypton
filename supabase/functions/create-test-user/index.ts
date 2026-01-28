import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTestUserRequest {
  email: string;
  password: string;
  fullName: string;
  userType: 'primary_test' | 'secondary_test';
  assignedRole: string;
  expiresAt: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for user creation
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller is TL
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      throw new Error('Unauthorized');
    }

    // Check if caller is TL
    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    if (callerRole?.role !== 'team_captain') {
      throw new Error('Only Team Lead can create test users');
    }

    const body: CreateTestUserRequest = await req.json();
    
    // Validate email format
    if (!body.email.endsWith('@test.com')) {
      throw new Error('Test users must have @test.com email');
    }

    // Validate password length
    if (body.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Validate secondary test user has expiry
    if (body.userType === 'secondary_test' && !body.expiresAt) {
      throw new Error('Secondary test users must have an expiry date');
    }

    console.log(`Creating test user: ${body.email} as ${body.userType}`);

    // Create auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        full_name: body.fullName,
        role: body.assignedRole,
        department: 'Test Department',
      },
    });

    if (createError) {
      console.error('Error creating auth user:', createError);
      throw new Error(createError.message);
    }

    const newUserId = authData.user.id;
    console.log(`Auth user created: ${newUserId}`);

    // Update profile with test user fields
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        user_type: body.userType,
        simulated_role: body.assignedRole,
        expires_at: body.expiresAt,
        created_by_tl: caller.id,
        is_test: true,
      })
      .eq('user_id', newUserId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Rollback: delete the auth user
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to set up test user profile');
    }

    // Log the creation
    await supabaseAdmin.from('guest_audit_log').insert({
      guest_user_id: newUserId,
      action: 'created',
      details: {
        created_by: caller.id,
        user_type: body.userType,
        assigned_role: body.assignedRole,
        expires_at: body.expiresAt,
      },
    });

    console.log(`Test user created successfully: ${body.email}`);

    return new Response(
      JSON.stringify({ success: true, userId: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error in create-test-user:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
