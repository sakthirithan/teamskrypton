import { useState, useEffect, useCallback } from 'react';

export interface RecentItem {
  id: string;
  type: 'member' | 'chat' | 'activity';
  title: string;
  subtitle?: string;
  path: string;
  timestamp: number;
}

const STORAGE_KEY = 'teams_krypton_recently_visited';
const MAX_RECENTS = 8;

export function useRecentlyVisited() {
  const [recents, setRecents] = useState<RecentItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
    } catch (e) {
      console.warn('Failed to save recent items:', e);
    }
  }, [recents]);

  const addRecent = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.id !== item.id);
      const updated = [{ ...item, timestamp: Date.now() }, ...filtered];
      return updated.slice(0, MAX_RECENTS);
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recents, addRecent, clearRecents };
}
