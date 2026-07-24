import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LogRow {
  id: string;
  recipient_email: string;
  title: string;
  type: string;
  status: string;
  error_message: string | null;
  attempts: number;
  created_at: string;
}

export function EmailDeliveryLogPanel() {
  const { isLeadership } = useAuth();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['email-delivery-log', 'issues-only'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_delivery_log')
        .select('id, recipient_email, title, type, status, error_message, attempts, created_at')
        .in('status', ['failed', 'pending'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as LogRow[];
    },
    refetchInterval: 15000,
    enabled: isLeadership,
  });

  if (!isLeadership) return null;

  const rows = data || [];
  const stats = {
    failed: rows.filter(r => r.status === 'failed').length,
    pending: rows.filter(r => r.status === 'pending').length,
    retries: rows.filter(r => (r.attempts ?? 0) > 1).length,
  };

  const statusBadge = (s: string) => {
    if (s === 'sent') return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Sent</Badge>;
    if (s === 'failed') return <Badge className="bg-red-500/15 text-red-600 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 font-display">
          <Mail className="w-5 h-5" />
          Email Delivery Log
        </CardTitle>
        <button
          onClick={() => refetch()}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="rounded-lg border bg-card/50 p-3 text-center">
            <div className="text-xl font-bold">{stats.total}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          </div>
          <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 p-3 text-center">
            <div className="text-xl font-bold text-emerald-600">{stats.sent}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sent</div>
          </div>
          <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-3 text-center">
            <div className="text-xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Failed</div>
          </div>
          <div className="rounded-lg border bg-amber-500/5 border-amber-500/20 p-3 text-center">
            <div className="text-xl font-bold text-amber-600">{stats.pending}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No email deliveries yet.
          </div>
        ) : (
          <ScrollArea className="h-[420px] pr-2">
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="p-3 rounded-lg border bg-card/40 hover:bg-card/70 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(r.status)}
                        <span className="text-sm font-medium truncate">{r.title}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        → {r.recipient_email}
                      </div>
                      {r.error_message && (
                        <div className="text-[11px] text-red-600 mt-1 font-mono line-clamp-2">
                          {r.error_message}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </div>
                      {r.attempts > 1 && (
                        <div className="text-[10px] text-amber-600 mt-1">
                          {r.attempts} attempts
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
