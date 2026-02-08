import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

/* ---------------- TYPES ---------------- */

interface Profile {
  user_id: string;
  full_name: string;
}

interface LoginRecord {
  user_id: string;
  login_time: string;
}

interface AttendanceUser {
  user_id: string;
  full_name: string;
  login_time: string | null;
  isLoggedIn: boolean;
}

/* ---------------- COMPONENT ---------------- */

export function AttendancePanel() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Only Team Manager / Team Captain can view
  const canView = role === 'team_manager' || role === 'team_captain';

  /* ---------------------------------------
     RECORD / UPDATE LOGIN (LATEST PER DAY)
  ---------------------------------------- */
  useEffect(() => {
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
        console.warn('Login activity failed:', error.message);
      }
    };

    recordLogin();
  }, [user?.id]);

  /* ---------------------------------------
     REALTIME LISTENER (INSERT + UPDATE)
  ---------------------------------------- */
  useEffect(() => {
    if (!canView) return;

    const channel = supabase
      .channel('attendance-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT + UPDATE
          schema: 'public',
          table: 'user_login_activity',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
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
    await queryClient.invalidateQueries({ queryKey: ['attendance-data'] });
    setIsRefreshing(false);
  }, [queryClient]);

  /* ---------------------------------------
     FETCH ALL PROFILES (non-test users)
  ---------------------------------------- */
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles-attendance'],
    enabled: canView,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false)
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Profile fetch error:', error.message);
        return [];
      }

      return (data ?? []) as Profile[];
    },
  });

  /* ---------------------------------------
     FETCH TODAY'S LOGIN DATA
  ---------------------------------------- */
  const { data: loginRecords = [], isLoading } = useQuery({
    queryKey: ['attendance-data'],
    enabled: canView,
    refetchInterval: 30000, // Refresh every 30 seconds for accuracy
    queryFn: async (): Promise<LoginRecord[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('user_login_activity')
        .select('user_id, login_time')
        .eq('login_date', today);

      if (error) {
        console.error('Login fetch error:', error.message);
        return [];
      }

      return (data ?? []) as LoginRecord[];
    },
  });

  /* ---------------------------------------
     COMBINE PROFILES WITH LOGIN STATUS
  ---------------------------------------- */
  const attendanceList: AttendanceUser[] = useMemo(() => {
    const loginMap = new Map<string, string>();
    loginRecords.forEach(record => {
      loginMap.set(record.user_id, record.login_time);
    });

    return allProfiles.map(profile => ({
      user_id: profile.user_id,
      full_name: profile.full_name,
      login_time: loginMap.get(profile.user_id) || null,
      isLoggedIn: loginMap.has(profile.user_id),
    })).sort((a, b) => {
      // Logged in users first, then by name
      if (a.isLoggedIn && !b.isLoggedIn) return -1;
      if (!a.isLoggedIn && b.isLoggedIn) return 1;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [allProfiles, loginRecords]);

  const presentCount = attendanceList.filter(u => u.isLoggedIn).length;
  const absentCount = attendanceList.filter(u => !u.isLoggedIn).length;

  if (!canView) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4" />
            Auto Attendance
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </span>

          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
              <CheckCircle className="w-3 h-3 mr-1" />
              {presentCount} Present
            </Badge>
            <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20">
              <XCircle className="w-3 h-3 mr-1" />
              {absentCount} Absent
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : attendanceList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No users found.
          </p>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {attendanceList.map(user => (
              <div
                key={user.user_id}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-lg text-sm transition-colors",
                  user.isLoggedIn 
                    ? "bg-green-500/5 border border-green-500/20" 
                    : "bg-red-500/5 border border-red-500/20"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full flex-shrink-0",
                    user.isLoggedIn 
                      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" 
                      : "bg-red-500"
                  )} />
                  <span className="font-medium truncate">{user.full_name}</span>
                </div>
                
                {user.isLoggedIn ? (
                  <span className="flex items-center gap-1.5 text-green-600 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {user.login_time}
                  </span>
                ) : (
                  <span className="text-red-500 text-xs font-medium">
                    Not Logged In
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 text-center">
          Realtime • Auto-refresh every 30s • {format(new Date(), 'dd MMM yyyy')}
        </p>
      </CardContent>
    </Card>
  );
}
