import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check Day of Week (0 = Sunday, 6 = Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(
        JSON.stringify({ message: 'Skipped: Weekend (Saturday/Sunday)', sentCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const todayStr = now.toISOString().split('T')[0];

    // 1. Get targets
    const { data: targetData } = await supabase
      .from('monitoring_targets')
      .select('*')
      .limit(1)
      .maybeSingle();

    const reqPsTarget = targetData?.required_ps_target ?? 1;

    // 2. Fetch eligible profiles (exclude hidden / disabled)
    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .or('is_disabled.is.null,is_disabled.eq.false');

    if (profileErr) throw profileErr;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sentCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = profiles.map((p) => p.user_id);

    // 3. Fetch today's survey responses
    const { data: surveyResponses } = await supabase
      .from('daily_survey_responses')
      .select('user_id')
      .eq('survey_date', todayStr)
      .in('user_id', userIds);

    const completedSurveyUserIds = new Set((surveyResponses || []).map((r) => r.user_id));

    // 4. Fetch today's completed PS entries
    const { data: psEntries } = await supabase
      .from('ps_daily_entries')
      .select('user_id')
      .eq('entry_date', todayStr)
      .eq('status', 'completed')
      .in('user_id', userIds);

    const psCounts = new Map<string, number>();
    (psEntries || []).forEach((e) => {
      psCounts.set(e.user_id, (psCounts.get(e.user_id) || 0) + 1);
    });

    // 5. Find members missing survey & missing PS
    const targetUserIdsToRemind: string[] = [];

    for (const p of profiles) {
      const surveyDone = completedSurveyUserIds.has(p.user_id);
      const psDone = (psCounts.get(p.user_id) || 0) >= reqPsTarget;

      // Only remind if BOTH Daily Survey remains incomplete & minimum PS not completed
      if (!surveyDone && !psDone) {
        targetUserIdsToRemind.push(p.user_id);
      }
    }

    if (targetUserIdsToRemind.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All eligible members completed requirements', sentCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Idempotent check & notification insertion
    const notificationsToInsert = [];
    const alertsToLog = [];
    const pushRecipientIds = [];

    for (const uid of targetUserIdsToRemind) {
      const idempotentKey = `daily_630pm_reminder_${todayStr}_${uid}`;

      // Check existing alert log
      const { data: existingLog } = await supabase
        .from('monitoring_alerts_log')
        .select('id')
        .eq('idempotent_key', idempotentKey)
        .maybeSingle();

      if (!existingLog) {
        pushRecipientIds.push(uid);

        notificationsToInsert.push({
          sender_id: '00000000-0000-0000-0000-000000000000', // System sender
          recipient_id: uid,
          title: '⏰ Daily 6:30 PM Reminder',
          message: 'Your Daily Survey and Minimum PS requirement remain incomplete for today. Please submit your updates!',
          type: 'monitoring_reminder',
          is_read: false,
          metadata: { idempotent_key: idempotentKey, action_required: true },
        });

        alertsToLog.push({
          sender_id: '00000000-0000-0000-0000-000000000000',
          recipient_id: uid,
          alert_type: 'daily_630pm_reminder',
          status: 'pending',
          idempotent_key: idempotentKey,
        });
      }
    }

    if (notificationsToInsert.length > 0) {
      await supabase.from('grouping_notifications').insert(notificationsToInsert as any);
      await supabase.from('monitoring_alerts_log').insert(alertsToLog as any);

      // Invoke FCM push
      await supabase.functions.invoke('send-push', {
        body: {
          user_ids: pushRecipientIds,
          title: '⏰ Daily 6:30 PM Reminder',
          body: 'Your Daily Survey and Minimum PS requirement remain incomplete for today.',
          data: { type: 'monitoring_reminder', path: '/grouping/monitoring' },
        },
      });
    }

    return new Response(
      JSON.stringify({ sentCount: notificationsToInsert.length, recipientIds: pushRecipientIds }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('evaluate-daily-reminders error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
