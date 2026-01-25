import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from 'react';

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
  // ✅ DEFAULT MODE = GROUPING
  const [mode, setModeState] = useState<AppMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'pbl') return 'pbl';
    }
    return 'grouping';
  });

  // ✅ MODE ALWAYS CONSIDERED SELECTED
  const [isModeSelected] = useState<boolean>(true);

  // Persist mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MODE_STORAGE_KEY, mode);
      sessionStorage.setItem(MODE_SELECTED_KEY, 'true');
    }
  }, [mode]);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MODE_STORAGE_KEY, newMode);
      sessionStorage.setItem(MODE_SELECTED_KEY, 'true');
    }
  }, []);

  const clearMode = useCallback(() => {
    // On logout → reset cleanly to Grouping
    setModeState('grouping');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(MODE_STORAGE_KEY);
      sessionStorage.removeItem(MODE_SELECTED_KEY);
    }
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