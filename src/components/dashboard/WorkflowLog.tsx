import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, CalendarIcon, ExternalLink, Trash2, RotateCcw, Download, AlertCircle } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { validateExportDateRange, getTodayString } from '@/lib/exportValidation';
import * as XLSX from 'xlsx';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

const formatDuration = (minutes?: number | null) => {
  if (!minutes || minutes <= 0) return '-';
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`;
};

const isSameCalendarDay = (dateStr: string, day: Date) => {
  const date = new Date(dateStr);
  return isWithinInterval(date, {
    start: startOfDay(day),
    end: endOfDay(day),
  });
};


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
  status: string;
}

type StatusFilter = 'all' | 'completed' | 'pending';

export function WorkflowLog() {
  const { user, isLeadership, isCaptainOrVice } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteConfirmLog, setDeleteConfirmLog] = useState<LogEntry | null>(null);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const handleManualRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return;
    lastRefreshRef.current = now;
    
    setIsRefreshing(true);
    await fetchLogs();
    setIsRefreshing(false);
    toast({ title: 'Log refreshed' });
  }, []);

  const fetchLogs = async () => {
    // Fetch completed AND pending tasks
    let query = supabase
      .from('tasks')
      .select('id, title, accepted_at, completed_at, duration_minutes, assigned_to, assigner_name, assigner_role, status')
      .in('status', ['completed', 'pending'])
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(100);

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
    } else {
      setLogs([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [isLeadership]);

  // Reset task to Idle - TL/VC only
  const handleResetTask = async (log: LogEntry) => {
    if (!user) return;
    
    try {
      // Reset task to idle status
      await supabase
        .from('tasks')
        .update({ 
          status: 'idle',
          accepted_at: null,
          completed_at: null,
          duration_minutes: null
        })
        .eq('id', log.id);

      // Create alert to notify the assigned user
      await supabase
        .from('task_alerts')
        .insert({
          task_id: log.id,
          message: 'Your task was reset by leadership. Please accept and complete it again.',
          created_by: user.id
        });

      toast({ 
        title: 'Task Reset', 
        description: 'Task restored to Today\'s Task panel. User notified.' 
      });
      setDeleteConfirmLog(null);
      fetchLogs();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Delete task permanently - TL/VC only
  const handleDeleteTask = async (taskId: string) => {
    try {
      // Delete task documents first
      await supabase
        .from('task_documents')
        .delete()
        .eq('task_id', taskId);

      // Delete task alerts
      await supabase
        .from('task_alerts')
        .delete()
        .eq('task_id', taskId);

      // Delete the task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({ title: 'Task Deleted', description: 'Task permanently removed from log.' });
      setDeleteConfirmLog(null);
      fetchLogs();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Export logs to XLSX with date validation
  const handleExport = (exportFormat: 'csv' | 'xlsx') => {
    // Validate date range
    const validation = validateExportDateRange(fromDate, toDate);
    if (!validation.isValid) {
      setExportError(validation.error);
      return;
    }
    setExportError(null);

    let dataToExport = filteredLogs;

    // Apply date range filter if specified
    if (fromDate || toDate) {
      dataToExport = dataToExport.filter(log => {
        const logDate = log.completed_at ? new Date(log.completed_at) : null;
        if (!logDate) return false;
        
        if (fromDate && logDate < parseISO(fromDate)) return false;
        if (toDate && logDate > parseISO(toDate + 'T23:59:59')) return false;
        return true;
      });
    }

    if (dataToExport.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No logs match the selected filters.' });
      return;
    }

    const exportData = dataToExport.map(log => ({
      'Date': log.completed_at ? format(new Date(log.completed_at), 'yyyy-MM-dd') : 'Pending',
      'Task': log.title,
      'User': log.completed_by_name || '-',
      'Assigned By': log.assigner_name ? `${log.assigner_name}${log.assigner_role ? ` (${log.assigner_role})` : ''}` : '-',
      'Start Time': log.accepted_at ? format(new Date(log.accepted_at), 'HH:mm') : '-',
      'End Time': log.completed_at ? format(new Date(log.completed_at), 'HH:mm') : '-',
      'Duration (min)': log.duration_minutes || '-',
      'Status': log.status,
      'Documentation URL': log.github_url || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Krypton Log');

    const dateRange = fromDate && toDate 
      ? `${fromDate}_to_${toDate}` 
      : fromDate 
        ? `from_${fromDate}` 
        : toDate 
          ? `to_${toDate}` 
          : 'full_history';

    const filename = `Krypton_Log_${dateRange}.${exportFormat}`;
    XLSX.writeFile(wb, filename);

    toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
    setShowExportDialog(false);
    setFromDate('');
    setToDate('');
  };

  // Filter logs by selected date and status
 const today = new Date();

  const filteredLogs = logs.filter(log => {
  // Only completed tasks participate in date filtering
  if (log.status !== 'completed' || !log.completed_at) return false;

  const targetDate = selectedDate ?? today;

  const dateMatch = isSameCalendarDay(log.completed_at, targetDate);

  const statusMatch =
    statusFilter === 'all' ? true : log.status === statusFilter;

  return dateMatch && statusMatch;
});

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="status-badge status-completed">Completed</span>;
      case 'pending':
        return <span className="status-badge status-pending">Pending</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading log...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="flex flex-col gap-3 font-display">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span className="text-base sm:text-lg">Krypton Log</span>
              <RefreshButton onClick={handleManualRefresh} isRefreshing={isRefreshing} />
            </div>
            
            {/* Export Button - Leadership only */}
            {isLeadership && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setExportError(null);
                  setShowExportDialog(true);
                }}
                className="h-9 touch-target"
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            )}
          </div>
          
          {/* Filters - Scrollable on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
            {/* Status Filter */}
            <ToggleGroup 
              type="single" 
              value={statusFilter} 
              onValueChange={(value) => value && setStatusFilter(value as StatusFilter)}
              className="border rounded-md flex-shrink-0"
            >
              <ToggleGroupItem value="all" size="sm" className="text-xs px-2 sm:px-3 touch-target whitespace-nowrap">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="completed" size="sm" className="text-xs px-2 sm:px-3 touch-target whitespace-nowrap">
                Completed
              </ToggleGroupItem>
              <ToggleGroupItem value="pending" size="sm" className="text-xs px-2 sm:px-3 touch-target whitespace-nowrap">
                Pending
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Date Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn(
                  "justify-start text-left font-normal flex-shrink-0 touch-target",
                  !selectedDate && "text-muted-foreground"
                )}>
                  <CalendarIcon className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{selectedDate ? format(selectedDate, 'MMM dd') : 'Date'}</span>
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
                      className="w-full touch-target"
                      onClick={() => setSelectedDate(undefined)}
                    >
                      Clear filter
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {filteredLogs.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 sm:py-8 text-sm">
            {selectedDate || statusFilter !== 'all' 
              ? 'No tasks completed on this day'
              : 'No tasks in log yet'}
          </p>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{log.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.completed_by_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getStatusBadge(log.status)}
                      {isCaptainOrVice && (
                        <Button 
                          size="icon" 
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteConfirmLog(log)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                    <span>{log.completed_at ? format(new Date(log.completed_at), 'MMM dd') : 'Pending'}</span>
                    {log.accepted_at && <span>Start: {format(new Date(log.accepted_at), 'HH:mm')}</span>}
                    {log.completed_at && <span>End: {format(new Date(log.completed_at), 'HH:mm')}</span>}
                    <span>{formatDuration(log.duration_minutes)}</span>
                    {log.github_url && (
                      <a 
                        href={log.github_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Docs
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Assigned By</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Docs</TableHead>
                  {isCaptainOrVice && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.completed_at 
                        ? format(new Date(log.completed_at), 'MMM dd') 
                        : log.status === 'pending' ? 'Pending' : '-'}
                    </TableCell>
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
                    <TableCell>{formatDuration(log.duration_minutes)}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
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
                    {isCaptainOrVice && (
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                          onClick={() => setDeleteConfirmLog(log)}
                          title="Reset/Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
        
        {/* Delete/Reset Confirmation Dialog */}
        <Dialog open={!!deleteConfirmLog} onOpenChange={(open) => !open && setDeleteConfirmLog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Task Action</DialogTitle>
              <DialogDescription>
                Choose an action for this task.
              </DialogDescription>
            </DialogHeader>
            {deleteConfirmLog && (
              <div className="space-y-4 pt-4">
                <div className="p-3 rounded bg-muted">
                  <p className="font-medium">{deleteConfirmLog.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned to: {deleteConfirmLog.completed_by_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: {deleteConfirmLog.status}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => handleResetTask(deleteConfirmLog)}
                    className="w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset to Today's Task (User Notified)
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDeleteTask(deleteConfirmLog.id)}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Permanently
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setDeleteConfirmLog(null)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Krypton Log</DialogTitle>
              <DialogDescription>
                Select date range and format for export.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From Date</Label>
                  <Input 
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setExportError(null);
                    }}
                    max={getTodayString()}
                  />
                </div>
                <div>
                  <Label>To Date</Label>
                  <Input 
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setExportError(null);
                    }}
                    max={getTodayString()}
                  />
                </div>
              </div>
              {exportError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                  <AlertCircle className="w-4 h-4" />
                  {exportError}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Leave dates empty to export full history
              </p>
              <div className="flex gap-2">
                <Button onClick={() => handleExport('xlsx')} className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Export XLSX
                </Button>
                <Button onClick={() => handleExport('csv')} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
