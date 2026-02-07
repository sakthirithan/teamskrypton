import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * LoginTracker
 * - Runs for ALL roles
 * - Waits until auth is READY
 * - Records / updates latest login per day
 * - Runs ONCE per session
 */
export function LoginTracker() {
  const { user, isLoading } = useAuth();

  // Prevent multiple writes
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    // 🔴 CRITICAL CONDITIONS
    if (isLoading) return;           // wait for auth
    if (!user?.id) return;           // must be authenticated
    if (hasRecordedRef.current) return; // run only once

    hasRecordedRef.current = true;

    const recordLogin = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentTime = format(new Date(), 'HH:mm');

      const { error } = await supabase
        .from('user_login_activity')
        .upsert(
          {
            user_id: user.id,
            login_date: today,
            login_time: currentTime,
          },
          {
            onConflict: 'user_id,login_date',
          }
        );

      if (error) {
        console.warn('LoginTracker failed:', error.message);
      }
    };

    recordLogin();
  }, [isLoading, user?.id]);

  return null;
}