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
  resetModeSelection: () => void; // For Switch Mode feature
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const MODE_STORAGE_KEY = 'krypton_app_mode';
const MODE_SELECTED_KEY = 'krypton_mode_selected';

export function AppModeProvider({ children }: { children: ReactNode }) {
  // Initialize from session storage
  const [mode, setModeState] = useState<AppMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(MODE_STORAGE_KEY);
      if (stored === 'pbl') return 'pbl';
    }
    return 'grouping';
  });

  // Mode selected tracks if user has actively chosen a mode this session
  const [isModeSelected, setIsModeSelected] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(MODE_SELECTED_KEY) === 'true';
    }
    return false;
  });

  // Persist mode to session storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MODE_STORAGE_KEY, mode);
    }
  }, [mode]);

  // Persist mode selected status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MODE_SELECTED_KEY, isModeSelected.toString());
    }
  }, [isModeSelected]);

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode);
    setIsModeSelected(true);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(MODE_STORAGE_KEY, newMode);
      sessionStorage.setItem(MODE_SELECTED_KEY, 'true');
    }
  }, []);

  // Clear mode on logout
  const clearMode = useCallback(() => {
    setModeState('grouping');
    setIsModeSelected(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(MODE_STORAGE_KEY);
      sessionStorage.removeItem(MODE_SELECTED_KEY);
    }
  }, []);

  // Reset mode selection to show dialog again (for Switch Mode)
  const resetModeSelection = useCallback(() => {
    setIsModeSelected(false);
    if (typeof window !== 'undefined') {
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
    resetModeSelection,
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