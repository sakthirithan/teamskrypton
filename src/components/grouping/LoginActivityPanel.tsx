import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogIn, Clock, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { format } from 'date-fns';

/* ---------------- TYPES ---------------- */

interface LoginRecord {
  id: string;
  login_time: string;
  profiles: {
    full_name: string;
  } | null;
}

/* ---------------- COMPONENT ---------------- */

export function LoginActivityPanel() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Only Team Manager / Team Captain
  const canView = role === 'team_manager' || role === 'team_captain';

  /* ---------------------------------------
     RECORD / UPDATE LOGIN (LATEST PER DAY)
  ---------------------------------------- */
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
        console.warn('Login activity failed:', error.message);
      }
    };

    recordLogin();
  }, [user]);

  /* ---------------------------------------
     REALTIME LISTENER (INSERT + UPDATE)
  ---------------------------------------- */
  useEffect(() => {
    if (!canView) return;

    const channel = supabase
      .channel('login-activity-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT + UPDATE
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

  /* ---------------------------------------
     MANUAL REFRESH
  ---------------------------------------- */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['login-activity'] });
    setIsRefreshing(false);
  }, [queryClient]);

  /* ---------------------------------------
     FETCH TODAY'S LOGIN DATA
     (FK JOIN + TS SAFE CAST)
  ---------------------------------------- */
  const { data: loginRecords = [], isLoading } = useQuery({
    queryKey: ['login-activity'],
    enabled: canView,
    refetchInterval: 60000,
    queryFn: async (): Promise<LoginRecord[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('user_login_activity')
        .select(
          `
          id,
          login_time,
          profiles:profiles!fk_user_login_profiles (
            full_name
          )
        `
        )
        .eq('login_date', today)
        .order('login_time', { ascending: false });

      if (error) {
        console.error('Login fetch error:', error.message);
        return [];
      }

      // Supabase TS safe cast
      return (data ?? []) as unknown as LoginRecord[];
    },
  });

  if (!canView) return null;

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
            {loginRecords.length}
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
            No users logged in today yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {loginRecords.map(record => (
              <div
                key={record.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
              >
                <span className="font-medium truncate">
                  {record.profiles?.full_name ?? 'Unknown User'}
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
          Read-only • Realtime • Latest login time per user (today)
        </p>
      </CardContent>
    </Card>
  );
}