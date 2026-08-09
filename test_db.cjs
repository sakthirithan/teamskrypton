const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kqguwponnyjhbgylpdss.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ3V3cG9ubnlqaGJneWxwZHNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNjgzODcsImV4cCI6MjA4Mzg0NDM4N30.mruYrFC8cS2qmqSz92dByXNer0p-ODfWK8b0hkmQpso';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // 1. Fetch all profiles
  const { data: profiles, error: pe } = await supabase
    .from('profiles')
    .select('user_id, full_name, email');
  if (pe) { console.error('profiles error:', pe.message); return; }
  console.log(`=== PROFILES (${profiles.length}) ===`);

  for (const p of profiles) {
    console.log(`\n--- ${p.full_name} (${p.user_id}) ---`);

    // 2. Completed PS entries for this user (ALL sessions)
    const { data: completed } = await supabase
      .from('ps_daily_entries')
      .select('reward_points, session_id')
      .eq('user_id', p.user_id)
      .eq('status', 'completed');
    const completedSum = (completed || []).reduce((s, e) => s + (e.reward_points || 0), 0);
    console.log(`  Completed entries: ${(completed || []).length}  |  Sum of reward_points: ${completedSum}`);

    // 3. Group by session
    const sessionTotals = {};
    for (const e of (completed || [])) {
      sessionTotals[e.session_id] = (sessionTotals[e.session_id] || 0) + (e.reward_points || 0);
    }
    if (Object.keys(sessionTotals).length) {
      console.log('  Per-session breakdown:', JSON.stringify(sessionTotals));
    }

    // 4. Grouping targets for this user
    const { data: targets } = await supabase
      .from('grouping_targets')
      .select('target_scope, session_id, target_points, achieved_points, balance_points')
      .eq('user_id', p.user_id);
    if (targets && targets.length) {
      for (const t of targets) {
        console.log(`  Target [${t.target_scope}] sess=${t.session_id}  target_pts=${t.target_points}  achieved_pts=${t.achieved_points}  balance_pts=${t.balance_points}`);
      }
    } else {
      console.log('  No targets found');
    }

    // 5. Activity points
    const { data: ap } = await supabase.from('activity_points').select('points').eq('user_id', p.user_id);
    const apSum = (ap || []).reduce((s, r) => s + (r.points || 0), 0);
    console.log(`  Activity points total: ${apSum}`);

    // 6. Golden/user points
    const { data: gp } = await supabase.from('user_points').select('points').eq('user_id', p.user_id);
    const gpSum = (gp || []).reduce((s, r) => s + (r.points || 0), 0);
    console.log(`  Golden points total: ${gpSum}`);
  }

  // 7. Sessions overview
  console.log('\n=== GROUPING SESSIONS ===');
  const { data: sessions } = await supabase.from('grouping_sessions').select('*').order('created_at', { ascending: false });
  for (const s of (sessions || [])) {
    console.log(`  [${s.status}] ${s.id}  ${s.start_date} -> ${s.end_date}  name=${s.name || 'N/A'}`);
  }
}

run().catch(console.error);
