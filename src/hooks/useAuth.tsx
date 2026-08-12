import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { KryptonRole, LEADERSHIP_ROLES, CAPTAIN_ROLES } from '@/lib/roles';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: KryptonRole | null;
  isLoading: boolean;
  isLeadership: boolean;
  isCaptainOrVice: boolean;
  isDisabled: boolean;
  isReadOnly: boolean;
  disabledMode: 'hidden' | 'read_only' | null;
  disabledReason: string | null;
  disabledUntil: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  avatar_url: string | null;
  phone_number?: string | null;
  current_status: string;
  created_at: string;
  is_direct_access: boolean;
  is_disabled?: boolean;
  disabled_mode?: 'hidden' | 'read_only' | null;
  disabled_reason?: string | null;
  disabled_until?: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isActiveNow(p: Profile | null): boolean {
  if (!p?.is_disabled) return true;
  if (p.disabled_until && new Date(p.disabled_until).getTime() <= Date.now()) return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const queryClient = useQueryClient();

  // Cached profile query
  const { data: profile = null, isLoading: isProfileLoading, refetch: refetchProfileData } = useQuery({
    queryKey: ['auth-user-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[auth] Error fetching profile:', error.message);
        return null;
      }
      return data as Profile;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Cached role query
  const { data: role = null, isLoading: isRoleLoading } = useQuery({
    queryKey: ['auth-user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[auth] Error fetching role:', error.message);
        return null;
      }
      return (data?.role as KryptonRole) ?? null;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const isLoading = isAuthInitializing || (!!user?.id && (isProfileLoading || isRoleLoading));

  const isLeadership = role ? LEADERSHIP_ROLES.includes(role) : false;
  const isCaptainOrVice = role ? CAPTAIN_ROLES.includes(role) : false;

  const active = isActiveNow(profile);
  const isDisabled = !!profile && !active;
  const disabledMode = isDisabled ? (profile?.disabled_mode ?? null) : null;
  const isReadOnly = disabledMode === 'read_only';
  const disabledReason = isDisabled ? (profile?.disabled_reason ?? null) : null;
  const disabledUntil = isDisabled ? (profile?.disabled_until ?? null) : null;

  useEffect(() => {
    let isMounted = true;
    let initDone = false;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
      } catch (e) {
        console.warn('[auth] init error:', e);
      } finally {
        initDone = true;
        if (isMounted) {
          setIsAuthInitializing(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;

        if (!initDone && (_event === 'INITIAL_SESSION' || _event === 'TOKEN_REFRESHED')) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (!session?.user) {
          queryClient.setQueryData(['auth-user-profile', null], null);
          queryClient.setQueryData(['auth-user-role', null], null);
        }

        if (isMounted && initDone) {
          setIsAuthInitializing(false);
        }
      },
    );

    // Silent background token re-validation on app resume / visibility change
    const handleVisibilityOrResume = async () => {
      if (!isMounted) return;
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error || !session) {
          if (user) {
            console.warn('[auth] session expired or invalid on resume');
            setUser(null);
            setSession(null);
          }
        } else {
          setSession(session);
          setUser(session.user);
        }
      } catch (e) {
        console.warn('[auth] background session check failed:', e);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrResume);

    let capacitorCleanup: (() => void) | null = null;
    import('@capacitor/core').then(({ Capacitor }) => {
      if (Capacitor.isNativePlatform()) {
        import('@capacitor/app').then(({ App }) => {
          const listener = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
              handleVisibilityOrResume();
            }
          });
          capacitorCleanup = () => {
            listener.then((l) => l.remove());
          };
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityOrResume);
      if (capacitorCleanup) capacitorCleanup();
    };
  }, [queryClient]);

  const signOut = async () => {
    try {
      localStorage.removeItem('krypton_session_info');
      localStorage.removeItem('krypton_app_mode');
      localStorage.removeItem('krypton_mode_selected');
      sessionStorage.clear();
      queryClient.clear();
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[auth] signOut warning:', e);
    } finally {
      setUser(null);
      setSession(null);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['auth-user-profile', user.id] }),
        queryClient.invalidateQueries({ queryKey: ['auth-user-role', user.id] }),
      ]);
    }
  }, [user?.id, queryClient]);

  return (
    <AuthContext.Provider value={{
      user, session, profile, role, isLoading,
      isLeadership, isCaptainOrVice,
      isDisabled, isReadOnly, disabledMode, disabledReason, disabledUntil,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

