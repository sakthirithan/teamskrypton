import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<KryptonRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isLeadership = role ? LEADERSHIP_ROLES.includes(role) : false;
  const isCaptainOrVice = role ? CAPTAIN_ROLES.includes(role) : false;

  const active = isActiveNow(profile);
  const isDisabled = !!profile && !active;
  const disabledMode = isDisabled ? (profile?.disabled_mode ?? null) : null;
  const isReadOnly = disabledMode === 'read_only';
  const disabledReason = isDisabled ? (profile?.disabled_reason ?? null) : null;
  const disabledUntil = isDisabled ? (profile?.disabled_until ?? null) : null;

  const fetchUserData = async (userId: string) => {
    try {
      const fetchPromise = Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      const timeoutPromise = new Promise<{ data: null; error: any }[]>((resolve) =>
        setTimeout(() => resolve([{ data: null, error: 'timeout' }, { data: null, error: 'timeout' }]), 4000)
      );

      const [profileRes, roleRes] = (await Promise.race([fetchPromise, timeoutPromise])) as any[];

      if (profileRes?.data) {
        setProfile(profileRes.data as Profile);
      }
      if (roleRes?.data) {
        setRole(roleRes.data.role as KryptonRole);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    // Track whether the initial session check is still in progress.
    // onAuthStateChange fires INITIAL_SESSION immediately on subscribe, so we
    // need to prevent it from racing with initAuth.
    let initDone = false;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserData(session.user.id);
        }
      } catch (e) {
        console.warn('[auth] init error:', e);
      } finally {
        initDone = true;
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;

        // During the initial auth check, ignore the INITIAL_SESSION event that
        // Supabase fires synchronously — initAuth handles that path.
        if (!initDone && (_event === 'INITIAL_SESSION' || _event === 'TOKEN_REFRESHED')) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setProfile(null);
          setRole(null);
        }

        // After initAuth is done, subsequent events should clear loading if needed.
        if (isMounted && initDone) {
          setIsLoading(false);
        }
      },
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    localStorage.removeItem('krypton_session_info');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  };

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
