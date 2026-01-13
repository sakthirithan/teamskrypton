import { useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

const SESSION_KEY = 'krypton_session_info';
const SESSION_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

interface SessionInfo {
  user_id: string;
  role: string | null;
  login_time: number;
}

export function useSessionPersistence() {
  const { user, role, signOut } = useAuth();

  // Save session info on login
  useEffect(() => {
    if (user && role) {
      const sessionInfo: SessionInfo = {
        user_id: user.id,
        role: role,
        login_time: Date.now(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionInfo));
    }
  }, [user, role]);

  // Check session expiry
  useEffect(() => {
    const checkSession = () => {
      const storedSession = localStorage.getItem(SESSION_KEY);
      if (storedSession) {
        try {
          const sessionInfo: SessionInfo = JSON.parse(storedSession);
          const elapsed = Date.now() - sessionInfo.login_time;
          
          if (elapsed > SESSION_EXPIRY_MS) {
            // Session expired - clear and sign out
            clearSession();
            signOut();
          }
        } catch (error) {
          console.error('Error parsing session:', error);
          clearSession();
        }
      }
    };

    // Check immediately and then every minute
    checkSession();
    const interval = setInterval(checkSession, 60000);
    
    return () => clearInterval(interval);
  }, [signOut]);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
  }, []);

  const getSessionInfo = useCallback((): SessionInfo | null => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const getRemainingTime = useCallback((): number => {
    const sessionInfo = getSessionInfo();
    if (!sessionInfo) return 0;
    
    const elapsed = Date.now() - sessionInfo.login_time;
    const remaining = SESSION_EXPIRY_MS - elapsed;
    return Math.max(0, remaining);
  }, [getSessionInfo]);

  return {
    clearSession,
    getSessionInfo,
    getRemainingTime,
  };
}
