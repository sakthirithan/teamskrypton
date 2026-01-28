import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteTestUserRequest {
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
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
      throw new Error('Only Team Lead can delete test users');
    }

    const body: DeleteTestUserRequest = await req.json();
    
    if (!body.userId) {
      throw new Error('User ID is required');
    }

    console.log(`Deleting test user: ${body.userId}`);

    // Verify the user is a test user
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_type, full_name, email')
      .eq('user_id', body.userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User not found');
    }

    if (profile.user_type !== 'primary_test' && profile.user_type !== 'secondary_test') {
      throw new Error('Can only delete test users');
    }

    // Delete all test data created by this user
    console.log('Deleting test data...');

    // Delete PS entries
    await supabaseAdmin
      .from('ps_daily_entries')
      .delete()
      .eq('user_id', body.userId)
      .eq('is_test', true);

    // Delete targets created by this user
    await supabaseAdmin
      .from('grouping_targets')
      .delete()
      .eq('created_by', body.userId)
      .eq('is_test', true);

    // Delete notes created by this user
    await supabaseAdmin
      .from('grouping_notes')
      .delete()
      .eq('created_by', body.userId)
      .eq('is_test', true);

    // Delete sessions created by this user
    await supabaseAdmin
      .from('grouping_sessions')
      .delete()
      .eq('created_by', body.userId)
      .eq('is_test', true);

    // Delete tasks
    await supabaseAdmin
      .from('tasks')
      .delete()
      .or(`assigned_to.eq.${body.userId},assigned_by.eq.${body.userId}`)
      .eq('is_test', true);

    // Delete workflow logs
    await supabaseAdmin
      .from('workflow_log')
      .delete()
      .eq('user_id', body.userId)
      .eq('is_test', true);

    // Log the deletion before removing audit logs
    await supabaseAdmin.from('guest_audit_log').insert({
      guest_user_id: body.userId,
      action: 'deleted',
      details: {
        deleted_by: caller.id,
        user_email: profile.email,
        user_name: profile.full_name,
      },
    });

    // Delete guest audit logs for this user
    await supabaseAdmin
      .from('guest_audit_log')
      .delete()
      .eq('guest_user_id', body.userId);

    // Delete user role
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', body.userId);

    // Delete profile
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', body.userId);

    // Delete auth user
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(body.userId);
    
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      throw new Error('Failed to delete auth user');
    }

    console.log(`Test user deleted successfully: ${body.userId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error in delete-test-user:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
