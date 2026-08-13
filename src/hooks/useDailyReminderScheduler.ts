import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAggregatedMonitoringData } from '@/services/monitoringService';
import { format, getDay } from 'date-fns';

/**
 * Daily 6:30 PM Reminder Evaluator (Phase 9)
 * Checks weekdays (Mon-Fri) at 6:30 PM.
 * Evaluates missing Daily Survey & minimum PS for eligible members.
 * Sends reminders with idempotent notification key to prevent duplicates.
 */
export function useDailyReminderScheduler() {
  const hasEvaluatedRef = useRef<string | null>(null);

  useEffect(() => {
    const checkAndRun630PmReminder = async () => {
      const now = new Date();
      const dayOfWeek = getDay(now);

      // Skip Saturdays (6) and Sundays (0)
      if (dayOfWeek === 0 || dayOfWeek === 6) return;

      const dateStr = format(now, 'yyyy-MM-dd');
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      // Trigger window: 6:30 PM to 7:00 PM (18:30 to 18:59)
      if (currentHours !== 18 || currentMinutes < 30) return;

      // Prevent duplicate evaluation in same browser session
      if (hasEvaluatedRef.current === dateStr) return;
      hasEvaluatedRef.current = dateStr;

      try {
        const { members } = await fetchAggregatedMonitoringData(null);
        // Find incomplete members (missing Daily Survey AND missing PS)
        const pendingMembers = members.filter(
          (m) => !m.survey.criteriaMet || !m.ps.criteriaMet
        );

        if (pendingMembers.length === 0) return;

        for (const member of pendingMembers) {
          const idempotentKey = `630_pm_reminder_${member.userId}_${dateStr}`;

          // Try inserting alert log with UNIQUE idempotent_key constraint
          const { data: logEntry, error: logError } = await supabase
            .from('monitoring_alert_logs' as any)
            .insert({
              sender_id: member.userId, // system evaluation
              recipient_id: member.userId,
              alert_type: '630_pm_reminder',
              target_criteria: 'survey_or_ps_missing',
              idempotent_key: idempotentKey,
              sent_at: new Date().toISOString(),
              follow_up_status: 'pending',
            } as any)
            .select()
            .maybeSingle();

          if (logError && logError.code === '23505') {
            // Already sent today, skip silently
            continue;
          }

          if (logEntry) {
            // Dispatch in-app notification
            await supabase.from('grouping_notifications' as any).insert({
              sender_id: member.userId,
              recipient_id: member.userId,
              title: '⏰ 6:30 PM Daily Reminder',
              message:
                'Your Daily PCDP Survey or Personalized Skill requirement is still pending today. Please complete it now.',
              type: 'daily_reminder_630pm',
              is_broadcast: false,
              metadata: {
                idempotent_key: idempotentKey,
                actionable: true,
              },
            } as any);

            // Invoke FCM push notification for mobile platform
            try {
              await supabase.functions.invoke('send-push', {
                body: {
                  user_ids: [member.userId],
                  title: '⏰ 6:30 PM Daily Requirement Reminder',
                  body: 'Your Daily PCDP Survey or Personalized Skill requirement is still pending today. Please complete it now.',
                  data: { path: '/grouping/monitoring' },
                },
              });
            } catch (pushErr) {
              console.warn('6:30 PM FCM push notification warning:', pushErr);
            }
          }
        }
      } catch (err) {
        console.error('Error running 6:30 PM daily reminder evaluator:', err);
      }
    };

    // Run check immediately on load and every 60 seconds
    checkAndRun630PmReminder();
    const interval = setInterval(checkAndRun630PmReminder, 60000);
    return () => clearInterval(interval);
  }, []);
}
