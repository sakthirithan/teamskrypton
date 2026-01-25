import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AppMode } from '@/lib/groupingConstants';

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isPBLMode: boolean;
  isGroupingMode: boolean;
  isModeSelected: boolean;
  clearMode: () => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const MODE_STORAGE_KEY = 'krypton_app_mode';
const MODE_SELECTED_KEY = 'krypton_mode_selected';

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    // Initialize from session storage or default to PBL
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'grouping') return 'grouping';
    }
    return 'pbl';
  });

  const [isModeSelected, setIsModeSelected] = useState<boolean>(() => {
    // Check if mode was already selected in this session
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(MODE_SELECTED_KEY) === 'true';
    }
    return false;
  });

  // Persist mode to session storage
  useEffect(() => {
    sessionStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [mode]);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    setIsModeSelected(true);
    sessionStorage.setItem(MODE_STORAGE_KEY, newMode);
    sessionStorage.setItem(MODE_SELECTED_KEY, 'true');
  }, []);

  const clearMode = useCallback(() => {
    // Called on logout to reset mode selection
    setIsModeSelected(false);
    setModeState('pbl');
    sessionStorage.removeItem(MODE_STORAGE_KEY);
    sessionStorage.removeItem(MODE_SELECTED_KEY);
  }, []);

  const value: AppModeContextType = {
    mode,
    setMode,
    isPBLMode: mode === 'pbl',
    isGroupingMode: mode === 'grouping',
    isModeSelected,
    clearMode,
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
