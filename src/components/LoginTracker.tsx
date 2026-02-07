import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * LoginTracker
 * - Runs for ALL users
 * - Records / updates latest login time per day
 * - Has NO UI
 */
export function LoginTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

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
        console.warn('Login tracking failed:', error.message);
      }
    };

    recordLogin();
  }, [user]);

  return null; // No UI
}