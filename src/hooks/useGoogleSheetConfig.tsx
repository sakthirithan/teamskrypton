import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface GoogleSheetConfig {
  id: string;
  sheet_id: string;
  sheet_name: string;
  sheet_url: string;
  tracked_columns: string[];
  row_logic_type: 'match_username' | 'fixed_row' | 'last_row';
  username_column: string | null;
  fixed_row_number: number | null;
  refresh_interval: number;
  enabled: boolean;
  configured_by: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useGoogleSheetConfig() {
  const { user, isLeadership, isCaptainOrVice } = useAuth();
  const queryClient = useQueryClient();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['google-sheet-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_sheet_configs' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as GoogleSheetConfig[];
    },
    enabled: !!user,
  });

  const activeConfig = configs.find(c => c.enabled);

  const createConfig = useMutation({
    mutationFn: async (config: Partial<GoogleSheetConfig>) => {
      const { error } = await supabase
        .from('google_sheet_configs' as any)
        .insert({
          ...config,
          configured_by: user!.id,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheet-configs'] });
      toast({ title: 'Sheet configured successfully' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GoogleSheetConfig> & { id: string }) => {
      const { error } = await supabase
        .from('google_sheet_configs' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheet-configs'] });
      toast({ title: 'Configuration updated' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('google_sheet_configs' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-sheet-configs'] });
      toast({ title: 'Configuration deleted' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  return {
    configs,
    activeConfig,
    isLoading,
    createConfig,
    updateConfig,
    deleteConfig,
    canConfigure: isLeadership,
    canToggleEnabled: isCaptainOrVice,
  };
}
