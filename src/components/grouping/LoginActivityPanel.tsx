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
 * Login Activity Panel - VISIBLE ONLY TO TEAM MANAGERS
 * 
 * Shows TODAY's latest login per user (HH:MM format).
 * Multiple logins overwrite same-day record.
 * Read-only insight - no actions.
 */
export function LoginActivityPanel() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Only Team Managers can see this
  const isTeamManager = role === 'team_manager';

  // Record current user's login when component mounts (for any user)
  useEffect(() => {
    const recordLogin = async () => {
      if (!user) return;
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentTime = format(new Date(), 'HH:mm');
      
      try {
        // Upsert login record
        await supabase
          .from('user_login_activity' as any)
          .upsert({
            user_id: user.id,
            login_date: today,
            login_time: currentTime,
          }, {
            onConflict: 'user_id,login_date',
          });
      } catch (error) {
        console.warn('Failed to record login activity:', error);
      }
    };
    
    recordLogin();
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['login-activity'] });
    await queryClient.invalidateQueries({ queryKey: ['team-members-login'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch today's login records using raw SQL query
  const { data: loginRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['login-activity'],
    queryFn: async (): Promise<LoginRecord[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .rpc('get_today_login_activity' as any, { target_date: today });
      
      if (error) {
        // Fallback: try direct table access
        const { data: directData, error: directError } = await supabase
          .from('user_login_activity' as any)
          .select('id, user_id, login_date, login_time, created_at')
          .eq('login_date', today)
          .order('login_time', { ascending: false });
        
        if (directError) {
          console.warn('Login activity error:', directError.message);
          return [];
        }
        
        return (directData || []) as unknown as LoginRecord[];
      }
      
      return (data || []) as unknown as LoginRecord[];
    },
    enabled: isTeamManager && !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch team members for names
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-login'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isTeamManager && !!user,
  });

  // Don't render for non-Team Managers
  if (!isTeamManager) return null;

  const getMemberName = (userId: string) => {
    return teamMembers.find(m => m.user_id === userId)?.full_name || 'Unknown';
  };

  const loggedInCount = loginRecords.length;
  const totalMembers = teamMembers.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <LogIn className="w-4 h-4" />
            Today's Login Activity
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </span>
          <Badge variant="secondary" className="ml-auto">
            <Users className="w-3 h-3 mr-1" />
            {loggedInCount}/{totalMembers}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loadingRecords ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        ) : loginRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No logins recorded today yet.
          </p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {loginRecords.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
              >
                <span className="font-medium truncate">
                  {getMemberName(record.user_id)}
                </span>
                <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{record.login_time}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 text-center">
          Read-only insight • Auto-refreshes every minute
        </p>
      </CardContent>
    </Card>
  );
}
