import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AppMode } from '@/lib/groupingConstants';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
  isPBLMode: boolean;
  isGroupingMode: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const MODE_STORAGE_KEY = 'krypton_app_mode';

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    // Initialize from session storage or default to PBL
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'grouping') return 'grouping';
    }
    return 'pbl';
  });

  // Persist mode to session storage
  useEffect(() => {
    sessionStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => prev === 'pbl' ? 'grouping' : 'pbl');
  }, []);

  const value: AppModeContextType = {
    mode,
    setMode,
    toggleMode,
    isPBLMode: mode === 'pbl',
    isGroupingMode: mode === 'grouping',
  };

  return (
    <AppModeContext.Provider value={value}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
