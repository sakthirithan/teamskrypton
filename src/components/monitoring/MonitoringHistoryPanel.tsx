import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MonitoringAuditEntry, MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { Search, History, Filter, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MonitoringHistoryPanelProps {
  auditLog: MonitoringAuditEntry[];
  members: MemberMonitoringStatus[];
}

export function MonitoringHistoryPanel({ auditLog, members }: MonitoringHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');

  const membersMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.userId, m.fullName));
    return map;
  }, [members]);

  const filteredLogs = useMemo(() => {
    return auditLog.filter((entry) => {
      const actorName = entry.actor_id ? membersMap.get(entry.actor_id) || entry.actor_id : 'System';
      const targetName = entry.target_user_id ? membersMap.get(entry.target_user_id) || entry.target_user_id : 'Team Target';

      if (fieldFilter !== 'all') {
        if (!entry.field.toLowerCase().includes(fieldFilter.toLowerCase())) return false;
      }

      if (memberFilter !== 'all') {
        if (entry.target_user_id !== memberFilter && entry.actor_id !== memberFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesField = entry.field.toLowerCase().includes(q);
        const matchesNote = (entry.note || '').toLowerCase().includes(q);
        const matchesActor = actorName.toLowerCase().includes(q);
        const matchesTarget = targetName.toLowerCase().includes(q);
        const matchesVal = (entry.new_value || '').toLowerCase().includes(q);
        if (!matchesField && !matchesNote && !matchesActor && !matchesTarget && !matchesVal) return false;
      }

      return true;
    });
  }, [auditLog, fieldFilter, memberFilter, searchQuery, membersMap]);

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <Card className="p-3 bg-card border shadow-xs space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search history by actor, member, or change detail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background/80"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={fieldFilter} onValueChange={setFieldFilter}>
              <SelectTrigger className="h-8 text-xs bg-background/80 w-36">
                <SelectValue placeholder="Criterion / Field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fields</SelectItem>
                <SelectItem value="ap">AP Changes</SelectItem>
                <SelectItem value="ps">PS Entry</SelectItem>
                <SelectItem value="survey">Daily Survey</SelectItem>
                <SelectItem value="meeting">Group Meeting</SelectItem>
                <SelectItem value="target">Target Override</SelectItem>
              </SelectContent>
            </Select>

            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="h-8 text-xs bg-background/80 w-44">
                <SelectValue placeholder="Member / Actor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Audit History Log Table */}
      {filteredLogs.length === 0 ? (
        <Card className="p-8 text-center space-y-2 bg-card border border-dashed">
          <History className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-bold text-foreground">No Audit Logs Found</h3>
          <p className="text-xs text-muted-foreground">No monitoring changes match your filter query.</p>
        </Card>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-xs">
          <div className="overflow-x-auto max-h-[500px]">
            <Table className="relative w-full text-xs">
              <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 border-b">
                <TableRow>
                  <TableHead className="font-bold py-2.5">When</TableHead>
                  <TableHead className="font-bold py-2.5">Actor (Who)</TableHead>
                  <TableHead className="font-bold py-2.5">Target Member</TableHead>
                  <TableHead className="font-bold py-2.5">Field / Action</TableHead>
                  <TableHead className="font-bold py-2.5">Old Value</TableHead>
                  <TableHead className="font-bold py-2.5">New Value</TableHead>
                  <TableHead className="font-bold py-2.5">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const actorName = log.actor_id ? membersMap.get(log.actor_id) || 'Lead' : 'System';
                  const targetName = log.target_user_id ? membersMap.get(log.target_user_id) || 'Member' : 'Global Target';

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/40">
                      <TableCell className="py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="py-2 font-semibold text-foreground">{actorName}</TableCell>
                      <TableCell className="py-2 font-medium text-foreground">{targetName}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[10px] font-mono capitalize px-1.5 py-0 bg-muted/40">
                          {log.field.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 font-mono text-muted-foreground">{log.old_value || '—'}</TableCell>
                      <TableCell className="py-2 font-mono font-bold text-foreground">{log.new_value || '—'}</TableCell>
                      <TableCell className="py-2 text-muted-foreground text-[11px] italic">{log.note || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
