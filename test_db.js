const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const clientPath = './src/integrations/supabase/client.ts';
const clientContent = fs.readFileSync(clientPath, 'utf8');

const urlMatch = clientContent.match(/const supabaseUrl = ['"](.*?)['"]/);
const keyMatch = clientContent.match(/const supabaseAnonKey = ['"](.*?)['"]/);

if (urlMatch && keyMatch) {
  const url = urlMatch[1];
  const anonKey = keyMatch[1];
  const supabase = createClient(url, anonKey);
  
  async function run() {
    console.log('Querying profiles...');
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, register_number, department');
    
    console.log('Profiles found:', profiles ? profiles.length : 0);
    if (profiles && profiles.length > 0) {
      console.log('First profile:', JSON.stringify(profiles[0], null, 2));
      
      const userId = profiles[0].user_id;
      console.log(`\nQuerying completed ps_daily_entries for user ${userId}...`);
      const { data: psEntries } = await supabase
        .from('ps_daily_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed');
      console.log(`Completed entries count: ${psEntries ? psEntries.length : 0}`);
      if (psEntries) {
        console.log('Sum of completed reward_points:', psEntries.reduce((sum, e) => sum + (e.reward_points || 0), 0));
        console.log('Sample entries:', JSON.stringify(psEntries.slice(0, 3), null, 2));
      }
      
      console.log(`\nQuerying grouping_targets for user ${userId}...`);
      const { data: targets } = await supabase
        .from('grouping_targets')
        .select('*')
        .eq('user_id', userId);
      console.log('Targets:', JSON.stringify(targets, null, 2));
    }
  }
  
  run();
} else {
  console.log('Credentials not found');
}
