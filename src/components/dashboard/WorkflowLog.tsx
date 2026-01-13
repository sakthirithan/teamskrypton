import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, CalendarIcon, ExternalLink } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  title: string;
  accepted_at: string;
  completed_at: string;
  duration_minutes: number;
  assigned_to: string;
  assigner_name: string | null;
  assigner_role: string | null;
  completed_by_name?: string;
  github_url?: string;
}

export function WorkflowLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    const fetchLogs = async () => {
      // Fetch completed tasks
      let query = supabase
        .from('tasks')
        .select('id, title, accepted_at, completed_at, duration_minutes, assigned_to, assigner_name, assigner_role')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50);

      const { data: tasksData } = await query;

      if (tasksData && tasksData.length > 0) {
        // Fetch user names
        const userIds = [...new Set(tasksData.map(t => t.assigned_to).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);

        const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        // Fetch documents
        const taskIds = tasksData.map(t => t.id);
        const { data: docs } = await supabase
          .from('task_documents')
          .select('task_id, github_url')
          .in('task_id', taskIds);

        const docsMap = new Map(docs?.map(d => [d.task_id, d.github_url]) || []);

        const enrichedLogs = tasksData.map(task => ({
          ...task,
          completed_by_name: task.assigned_to ? nameMap.get(task.assigned_to) : undefined,
          github_url: docsMap.get(task.id)
        }));

        setLogs(enrichedLogs);
      }
      setIsLoading(false);
    };
    fetchLogs();
  }, []);

  // Filter logs by selected date
  const filteredLogs = selectedDate
    ? logs.filter(log => log.completed_at && isSameDay(new Date(log.completed_at), selectedDate))
    : logs;

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading log...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Krypton Log (Completed Tasks)
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(
                "justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'MMM dd, yyyy') : 'Filter by date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
              {selectedDate && (
                <div className="p-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setSelectedDate(undefined)}
                  >
                    Clear filter
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {selectedDate ? 'No completed tasks on this date' : 'No completed tasks yet'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Completed By</TableHead>
                  <TableHead>Assigned By</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Docs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.completed_at ? format(new Date(log.completed_at), 'MMM dd') : '-'}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{log.title}</TableCell>
                    <TableCell>{log.completed_by_name || '-'}</TableCell>
                    <TableCell>
                      {log.assigner_name ? (
                        <span>
                          {log.assigner_name}
                          {log.assigner_role && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({log.assigner_role})
                            </span>
                          )}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{log.accepted_at ? format(new Date(log.accepted_at), 'HH:mm') : '-'}</TableCell>
                    <TableCell>{log.completed_at ? format(new Date(log.completed_at), 'HH:mm') : '-'}</TableCell>
                    <TableCell>{log.duration_minutes ? `${log.duration_minutes}m` : '-'}</TableCell>
                    <TableCell>
                      {log.github_url ? (
                        <a 
                          href={log.github_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Docs
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
