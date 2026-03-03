import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { GoogleSheetConfig } from './useGoogleSheetConfig';

export interface SheetRow {
  [key: string]: string;
  __rowIndex: string;
}

interface SheetFetchResult {
  headers: string[];
  rows: SheetRow[];
}

export function useGoogleSheetData(config: GoogleSheetConfig | undefined) {
  const { user, profile } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<SheetFetchResult>({
    queryKey: ['google-sheet-data', config?.id, config?.sheet_id],
    queryFn: async () => {
      if (!config) throw new Error('No config');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-google-sheet`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sheetId: config.sheet_id,
            sheetName: config.sheet_name,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Fetch failed: ${res.status}`);
      }

      return res.json();
    },
    enabled: !!config?.enabled && !!user,
    refetchInterval: config ? config.refresh_interval * 60 * 1000 : false,
    staleTime: config ? (config.refresh_interval * 60 * 1000) / 2 : undefined,
  });

  // Apply mapping logic
  const getMappedData = (): {
    userRow: SheetRow | null;
    allRows: SheetRow[];
    trackedData: Record<string, string>;
  } => {
    if (!data || !config) return { userRow: null, allRows: [], trackedData: {} };

    const { rows } = data;
    let userRow: SheetRow | null = null;

    if (config.row_logic_type === 'match_username' && config.username_column && profile) {
      userRow = rows.find(r => {
        const cellVal = (r[config.username_column!] || '').toLowerCase().trim();
        const userName = (profile.full_name || '').toLowerCase().trim();
        return cellVal === userName;
      }) || null;
    } else if (config.row_logic_type === 'fixed_row' && config.fixed_row_number) {
      userRow = rows[config.fixed_row_number - 2] || null; // -2 because row 1 is header
    } else if (config.row_logic_type === 'last_row') {
      userRow = rows[rows.length - 1] || null;
    }

    const trackedData: Record<string, string> = {};
    if (userRow && config.tracked_columns.length > 0) {
      config.tracked_columns.forEach(col => {
        trackedData[col] = userRow![col] || 'No Data';
      });
    }

    return { userRow, allRows: rows, trackedData };
  };

  return {
    rawData: data,
    isLoading,
    error,
    refetch,
    ...getMappedData(),
    headers: data?.headers || [],
  };
}
