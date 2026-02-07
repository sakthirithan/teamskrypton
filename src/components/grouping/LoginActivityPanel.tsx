import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogIn, Clock, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { format } from 'date-fns';

interface LoginRecord {
  id: string;
  user_id: string;
  login_date: string;
  login_time: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

/**
 * LOGIN ACTIVITY PANEL
 * Visible to: Team Manager, TL
 * Realtime, read-only, safe
 */
export function LoginActivityPanel() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  // TL and TM both have access
  const canView = role === 'team_manager' || role === 'team_captain';

  /* ---------------------------
     RECORD LOGIN (ONCE PER LOAD)
  ---------------------------- */
  useEffect(() => {
    if (!user) return;

    const recordLogin = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentTime = format(new Date(), 'HH:mm');

      try {
        await supabase
          .from('user_login_activity')
          .upsert(
            {
              user_id: user.id,
              login_date: today,
              login_time: currentTime,
            },
            { onConflict: 'user_id,login_date' }
          );
      } catch (err) {
        console.warn('Login activity tracking failed:', err);
      }
    };

    recordLogin();
  }, [user]);

  /* ---------------------------
     REALTIME SUBSCRIPTION
  ---------------------------- */
  useEffect(() => {
    if (!canView) return;

    const channel = supabase
      .channel('login-activity-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_login_activity',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['login-activity'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canView, queryClient]);

  /* ---------------------------
     MANUAL REFRESH
  ---------------------------- */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['login-activity'] });
    await queryClient.invalidateQueries({ queryKey: ['team-members-login'] });
    setIsRefreshing(false);
  }, [queryClient]);

  /* ---------------------------
     FETCH LOGIN RECORDS (TODAY)
  ---------------------------- */
  const { data: loginRecords = [], isLoading } = useQuery({
    queryKey: ['login-activity'],
    queryFn: async (): Promise<LoginRecord[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('user_login_activity')
        .select('id, user_id, login_date, login_time, created_at')
        .eq('login_date', today)
        .order('login_time', { ascending: false });

      if (error) {
        console.warn('Login fetch error:', error.message);
        return [];
      }

      return data as LoginRecord[];
    },
    enabled: canView && !!user,
    refetchInterval: 60000, // fallback polling
  });

  /* ---------------------------
     FETCH TEAM MEMBERS
  ---------------------------- */
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-login'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);

      if (error) throw error;
      return data;
    },
    enabled: canView,
  });

  if (!canView) return null;

  const getName = (userId: string) =>
    teamMembers.find(m => m.user_id === userId)?.full_name || 'Unknown';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <LogIn className="w-4 h-4" />
            Today’s Login Activity
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </span>
          <Badge variant="secondary">
            <Users className="w-3 h-3 mr-1" />
            {loginRecords.length}/{teamMembers.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : loginRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No logins recorded today yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {loginRecords.map(record => (
              <div
                key={record.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
              >
                <span className="font-medium truncate">
                  {getName(record.user_id)}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {record.login_time}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 text-center">
          Read-only • Updates in real time • Latest login per user today
        </p>
      </CardContent>
    </Card>
  );
}
