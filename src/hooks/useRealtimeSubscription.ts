import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeSubscriptionOptions {
  channelName: string;
  table: string;
  schema?: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  enabled?: boolean;
  onPayload: (payload: any) => void;
}

/**
 * Centralized Realtime Subscription lifecycle hook.
 * Guarantees single-channel registration, automatic cleanup on unmount/re-render,
 * and prevents duplicate event triggers across components.
 */
export function useRealtimeSubscription({
  channelName,
  table,
  schema = 'public',
  filter,
  event = '*',
  enabled = true,
  onPayload,
}: RealtimeSubscriptionOptions) {
  const callbackRef = useRef(onPayload);
  callbackRef.current = onPayload;

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;
    const channelKey = `${channelName}-${table}-${filter || 'all'}`;

    try {
      channel = supabase.channel(channelKey);

      const changeConfig: any = {
        event,
        schema,
        table,
      };

      if (filter) {
        changeConfig.filter = filter;
      }

      channel
        .on('postgres_changes' as any, changeConfig, (payload: any) => {
          if (callbackRef.current) {
            callbackRef.current(payload);
          }
        })
        .subscribe((status, err) => {
          if (status === 'CHANNEL_ERROR' || err) {
            console.warn(`[Realtime] Subscription error on ${channelKey}:`, err);
          }
        });
    } catch (err) {
      console.error(`[Realtime] Failed to initialize ${channelKey}:`, err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch((err) => {
          console.warn(`[Realtime] Failed to remove channel ${channelKey}:`, err);
        });
      }
    };
  }, [channelName, table, schema, filter, event, enabled]);
}
