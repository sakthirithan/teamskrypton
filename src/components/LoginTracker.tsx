import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * LoginTracker
 * - Runs for ALL roles
 * - Updates login_time on every app load / refresh
 * - One row per user per day (UPSERT)
 */
export function LoginTracker() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user?.id) return;

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