import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSyncRef = useRef<number>(Date.now());

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
     FETCH TODAY'S LOGIN DATA - REALTIME SOURCE
  ---------------------------------------- */
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const { data: loginRecords = [], isLoading: isLoadingLogins, refetch: refetchLogins } = useQuery({
    queryKey: ['attendance-login-data', today],
    enabled: canView,
    staleTime: 5000,
    queryFn: async (): Promise<LoginRecord[]> => {
      const { data, error } = await supabase
        .from('user_login_activity')
        .select('user_id, login_time')
        .eq('login_date', today);

      if (error) {
        console.error('Login fetch error:', error.message);
        return [];
      }

      lastSyncRef.current = Date.now();
      return (data ?? []) as LoginRecord[];
    },
  });

  /* ---------------------------------------
     FETCH ALL PROFILES (non-test users)
  ---------------------------------------- */
  const { data: allProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['all-profiles-attendance'],
    enabled: canView,
    staleTime: 5 * 60 * 1000,
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
     REALTIME LISTENER - ROBUST IMPLEMENTATION
  ---------------------------------------- */
  useEffect(() => {
    if (!canView) return;

    // Setup realtime subscription
    const setupChannel = () => {
      // Cleanup existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel('attendance-realtime-v2')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_login_activity',
            filter: `login_date=eq.${today}`,
          },
          (payload) => {
            console.log('Realtime attendance update:', payload);
            // Immediately refetch on any change
            refetchLogins();
            lastSyncRef.current = Date.now();
          }
        )
        .on('system', { event: 'disconnect' }, () => {
          setIsRealtimeConnected(false);
        })
        .on('system', { event: 'reconnect' }, () => {
          setIsRealtimeConnected(true);
          refetchLogins();
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsRealtimeConnected(false);
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    // Fallback polling with exponential backoff
    let pollInterval = 10000; // Start at 10 seconds
    const maxInterval = 30000;

    const pollFn = () => {
      const timeSinceLastSync = Date.now() - lastSyncRef.current;
      
      // If no realtime update in 15 seconds, poll more frequently
      if (timeSinceLastSync > 15000) {
        refetchLogins();
        pollInterval = Math.min(pollInterval * 1.2, maxInterval);
      }
    };

    const intervalId = setInterval(pollFn, pollInterval);

    return () => {
      clearInterval(intervalId);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [canView, today, refetchLogins]);

  /* ---------------------------------------
     MANUAL REFRESH
  ---------------------------------------- */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchLogins();
    await queryClient.invalidateQueries({ queryKey: ['all-profiles-attendance'] });
    lastSyncRef.current = Date.now();
    setIsRefreshing(false);
  }, [queryClient, refetchLogins]);

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
  const isLoading = isLoadingLogins || isLoadingProfiles;

  if (!canView) return null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-semibold">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Users className="w-4 h-4 text-primary" />
            </div>
            Auto Attendance
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
            {isRealtimeConnected ? (
              <Wifi className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-red-500" />
            )}
          </span>

          <div className="flex gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle className="w-3 h-3 mr-1" />
              {presentCount}
            </Badge>
            <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20">
              <XCircle className="w-3 h-3 mr-1" />
              {absentCount}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : attendanceList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No users found.
          </p>
        ) : (
          <ScrollArea className="h-[320px]">
            <div className="divide-y divide-border">
              {attendanceList.map(user => (
                <div
                  key={user.user_id}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 transition-colors",
                    user.isLoggedIn 
                      ? "bg-emerald-500/5 hover:bg-emerald-500/10" 
                      : "bg-red-500/5 hover:bg-red-500/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {/* Status Indicator - Pulsing for online */}
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0",
                      user.isLoggedIn 
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" 
                        : "bg-red-500"
                    )} />
                    <span className="font-medium text-sm">{user.full_name}</span>
                  </div>
                  
                  {user.isLoggedIn ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      {user.login_time}
                    </span>
                  ) : (
                    <span className="text-red-500 text-xs font-medium uppercase tracking-wide">
                      Absent
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="px-4 py-2.5 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Live • {format(new Date(), 'dd MMM yyyy')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
