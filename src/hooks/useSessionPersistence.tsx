import { useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';

const SESSION_KEY = 'krypton_session_info';

interface SessionInfo {
  user_id: string;
  role: string | null;
  login_time: number;
}

export function useSessionPersistence() {
  const { user, role } = useAuth();

  // Save persistent session info on login/auth change
  useEffect(() => {
    if (user && role) {
      const stored = localStorage.getItem(SESSION_KEY);
      let loginTime = Date.now();
      
      if (stored) {
        try {
          const existing: SessionInfo = JSON.parse(stored);
          if (existing.user_id === user.id && existing.login_time) {
            loginTime = existing.login_time;
          }
        } catch (e) {
          console.warn('Failed to parse existing session info:', e);
        }
      }

      const sessionInfo: SessionInfo = {
        user_id: user.id,
        role: role,
        login_time: loginTime,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionInfo));
    }
  }, [user, role]);

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

  return {
    clearSession,
    getSessionInfo,
  };
}
