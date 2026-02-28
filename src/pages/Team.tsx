import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { Header } from '@/components/layout/Header';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { KryptonRole, TaskStatus, LEADERSHIP_ROLES, ROLE_LABELS } from '@/lib/constants';
import { Users, Download, Search, AlertCircle, Target, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { validateExportDateRange, getTodayString } from '@/lib/exportValidation';
import { calculateTargetStatus, calculateDaysRemaining, calculateSessionDays, TARGET_STATUS_LABELS } from '@/lib/groupingConstants';
import * as XLSX from 'xlsx';

interface TeamMember {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    department: string;
    avatar_url: string | null;
    current_status: TaskStatus | null;
    created_at: string;
    phone_number: string | null;
    register_number: string | null;
  };
  role: KryptonRole | null;
  taskStats: {
    total: number;
    completed: number;
    inProgress: boolean;
  };
}

const Team = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice, role } = useAuth();
  const { mode, isGroupingMode } = useAppMode();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const handleManualRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return;
    lastRefreshRef.current = now;
    
    setIsRefreshing(true);
    await fetchMembers();
    setIsRefreshing(false);
    toast({ title: 'Team data refreshed' });
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  const fetchMembers = async () => {
    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_test', false)
      .order('full_name');

    // Fetch roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    // Fetch task stats for each user (only for PBL mode display)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('assigned_to, status')
      .eq('is_test', false);

    if (profiles) {
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role as KryptonRole]) || []);
      
      // Build task stats map
      const taskStatsMap = new Map<string, { total: number; completed: number; inProgress: boolean }>();
      tasks?.forEach(t => {
        const userId = t.assigned_to;
        if (!taskStatsMap.has(userId)) {
          taskStatsMap.set(userId, { total: 0, completed: 0, inProgress: false });
        }
        const stats = taskStatsMap.get(userId)!;
        stats.total++;
        if (t.status === 'completed') stats.completed++;
        if (t.status === 'working') stats.inProgress = true;
      });

      const teamMembers: TeamMember[] = profiles.map(p => ({
        profile: {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          department: p.department,
          avatar_url: p.avatar_url,
          current_status: p.current_status as TaskStatus | null,
          created_at: p.created_at,
          phone_number: p.phone_number,
          register_number: p.register_number,
        },
        role: roleMap.get(p.user_id) || null,
        taskStats: taskStatsMap.get(p.user_id) || { total: 0, completed: 0, inProgress: false },
      }));

      // Sort: Leadership first, then alphabetically
      teamMembers.sort((a, b) => {
        const aIsLeadership = a.role && LEADERSHIP_ROLES.includes(a.role);
        const bIsLeadership = b.role && LEADERSHIP_ROLES.includes(b.role);
        if (aIsLeadership && !bIsLeadership) return -1;
        if (!aIsLeadership && bIsLeadership) return 1;
        return a.profile.full_name.localeCompare(b.profile.full_name);
      });

      setMembers(teamMembers);
    }
    setIsFetching(false);
  };

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  // Update phone number - TL/VC only
  const handleUpdatePhone = async (userId: string, phone: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: phone })
      .eq('user_id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update phone number' });
    } else {
      toast({ title: 'Phone Updated' });
      fetchMembers();
    }
  };

  const handleUpdateRegisterNumber = async (userId: string, registerNumber: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ register_number : registerNumber })
      .eq('user_id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update register number' });
    } else {
      toast({ title: 'Register Number Updated' });
      fetchMembers();
    }
  };

  // =================== GROUPING MODE EXPORT ===================
  const handleGroupingExport = async (exportFormat: 'csv' | 'xlsx') => {
    setIsExporting(true);
    setExportError(null);

    try {
      // 1. Get active session
      const { data: sessions, error: sessionError } = await supabase
        .from('grouping_sessions')
        .select('*')
        .eq('status', 'active')
        .eq('is_test', false)
        .order('session_number', { ascending: false })
        .limit(1);

      if (sessionError) throw sessionError;
      
      if (!sessions || sessions.length === 0) {
        setExportError('No active session found. Please create an active session first.');
        setIsExporting(false);
        return;
      }

      const activeSession = sessions[0];

      // 2. Fetch ALL targets for this session
      const { data: targets, error: targetsError } = await supabase
        .from('grouping_targets')
        .select('*')
        .eq('session_id', activeSession.id)
        .eq('is_test', false);

      if (targetsError) throw targetsError;

      // 3. Fetch ALL PS entries for this session
      const { data: psEntries, error: entriesError } = await supabase
        .from('ps_daily_entries')
        .select('*')
        .eq('session_id', activeSession.id)
        .eq('is_test', false);

      if (entriesError) throw entriesError;

      // 4. Build per-member data
      const roleMap = new Map(members.map(m => [m.profile.user_id, m.role]));
      const groupTarget = targets?.find(t => t.target_scope === 'group');
      
      // Calculate session metrics
      const totalDays = calculateSessionDays(activeSession.start_date, activeSession.end_date);
      const daysRemaining = calculateDaysRemaining(activeSession.end_date);

      const exportData = members.map(member => {
        const userId = member.profile.user_id;
        
        // Get individual target for this user
        const individualTarget = targets?.find(t => t.target_scope === 'individual' && t.user_id === userId);
        
        // Filter entries for this user
        const userEntries = psEntries?.filter(e => e.user_id === userId) || [];
        const completedEntries = userEntries.filter(e => e.status === 'completed');
        const pendingEntries = userEntries.filter(e => e.status === 'pending');
        
        // Calculate totals
        const totalPoints = completedEntries.reduce((sum, e) => sum + e.reward_points, 0);
        const totalAttempts = userEntries.reduce((sum, e) => sum + e.attempt_count, 0);
        
        // Last activity
        const lastEntry = userEntries.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];

        // Target status calculation
        const targetPoints = individualTarget?.target_points || 0;
        const targetStatus = targetPoints > 0 
          ? calculateTargetStatus(totalPoints, targetPoints, daysRemaining, totalDays)
          : 'on_track';

        // Progress percentage
        const progressPercent = targetPoints > 0 
          ? Math.min(100, Math.round((totalPoints / targetPoints) * 100))
          : 0;

        return {
          'Name': member.profile.full_name,
          'Role': member.role ? ROLE_LABELS[member.role] : '-',
          'Department': member.profile.department,
          'Session ID': activeSession.id,
          'Session Name': activeSession.name,
          'Session Start': activeSession.start_date,
          'Session End': activeSession.end_date,
          'Days Remaining': daysRemaining,
          // Group Target Info
          'Group Target (Points)': groupTarget?.target_points || 0,
          'Group Target Achieved': groupTarget?.achieved_points || 0,
          // Individual Target Info
          'Individual Target (Points)': individualTarget?.target_points || 0,
          'Individual Achieved (Points)': totalPoints,
          'Progress (%)': progressPercent,
          'Target Status': TARGET_STATUS_LABELS[targetStatus],
          // PS Entry Stats
          'Total PS Entries': userEntries.length,
          'Completed Entries': completedEntries.length,
          'Pending Entries': pendingEntries.length,
          'Total Reward Points': totalPoints,
          'Total Attempts': totalAttempts,
          'Last Activity': lastEntry ? format(new Date(lastEntry.updated_at), 'yyyy-MM-dd HH:mm') : '-',
        };
      });

      // 5. Generate file
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Grouping Team Report');

      const timestamp = format(new Date(), 'yyyy-MM-dd');
      const sessionName = activeSession.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Grouping_Team_Report_Session_${sessionName}_${timestamp}.${exportFormat}`;
      
      XLSX.writeFile(wb, filename);
      toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
      setShowExportDialog(false);

    } catch (error: any) {
      setExportError(error.message || 'Export failed');
      toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  // =================== PBL MODE EXPORT ===================
  const handlePBLExport = async (exportFormat: 'csv' | 'xlsx') => {
    const validation = validateExportDateRange(fromDate, toDate);
    if (!validation.isValid) {
      setExportError(validation.error);
      return;
    }
    setExportError(null);
    setIsExporting(true);

    try {
      // Fetch all completed tasks with date filter
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'completed')
        .eq('is_test', false);

      const { data: allTasks } = await query;

      let filteredTasks = allTasks || [];
      if (fromDate || toDate) {
        filteredTasks = filteredTasks.filter(task => {
          const taskDate = task.completed_at ? new Date(task.completed_at) : null;
          if (!taskDate) return false;
          if (fromDate && taskDate < parseISO(fromDate)) return false;
          if (toDate && taskDate > parseISO(toDate + 'T23:59:59')) return false;
          return true;
        });
      }

      // Build user map
      const userMap = new Map(members.map(m => [m.profile.user_id, m]));

      const exportData = filteredTasks.map(task => {
        const member = userMap.get(task.assigned_to);
        return {
          'User': member?.profile.full_name || 'Unknown',
          'Role': member?.role ? ROLE_LABELS[member.role] : '-',
          'Department': member?.profile.department || '-',
          'Task': task.title,
          'Date Completed': task.completed_at ? format(new Date(task.completed_at), 'yyyy-MM-dd') : '-',
          'Duration (min)': task.duration_minutes || '-',
          'Start Time': task.accepted_at ? format(new Date(task.accepted_at), 'HH:mm') : '-',
          'End Time': task.completed_at ? format(new Date(task.completed_at), 'HH:mm') : '-',
        };
      });

      if (exportData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'No completed tasks in the selected range.' });
        setIsExporting(false);
        return;
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Team Task History');

      const dateRange = fromDate && toDate 
        ? `${fromDate}_to_${toDate}` 
        : fromDate 
          ? `from_${fromDate}` 
          : toDate 
            ? `to_${toDate}` 
            : 'full_history';

      const filename = `Krypton_Team_History_${dateRange}.${exportFormat}`;
      XLSX.writeFile(wb, filename);

      toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
      setShowExportDialog(false);
    } catch (error: any) {
      setExportError(error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Filter members by search
  const filteredMembers = members.filter(m => 
    m.profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.profile.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.profile.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Users className="w-6 h-6" />
              Team Directory
            </h2>
            <RefreshButton onClick={handleManualRefresh} isRefreshing={isRefreshing} />
            <p className="text-muted-foreground mt-1 hidden sm:block">
              ({members.length} members)
            </p>
          </div>
          
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            
            {isLeadership && (
              <Button variant="outline" onClick={() => {
                setExportError(null);
                setShowExportDialog(true);
              }}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>

        {isFetching ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading team members...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? 'No members match your search' : 'No team members found'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredMembers.map((member) => (
              <KryptonIdCard
                key={member.profile.user_id}
                profile={member.profile}
                role={member.role}
                taskStats={member.taskStats}
                canEditPhone={isCaptainOrVice}
                onUpdatePhone={isCaptainOrVice ? (phone) => handleUpdatePhone(member.profile.user_id, phone) : undefined}
                onUpdateRegisterNumber={isCaptainOrVice ? (registerNumber) => handleUpdateRegisterNumber(member.profile.user_id, registerNumber) : undefined}
                onClick={() => {
                  // Grouping mode navigation
                  if (mode === 'grouping') {
                    if (member.profile.user_id === user.id) {
                      navigate('/grouping/me');
                    } else {
                      navigate(`/grouping/me?userId=${member.profile.user_id}`);
                    }
                    return;
                  }
                  // PBL mode navigation (unchanged)
                  if (member.profile.user_id === user.id) {
                    navigate('/my-space');
                  } else if (isLeadership) {
                    navigate(`/member/${member.profile.user_id}`);
                  } else {
                    navigate(`/profile/${member.profile.user_id}`);
                  }
                }}
                onViewProfile={
                  member.profile.user_id !== user.id
                    ? () => {
                        if (mode === 'grouping') {
                          navigate(`/grouping/me?userId=${member.profile.user_id}`);
                        } else {
                          navigate(isLeadership ? `/member/${member.profile.user_id}` : `/profile/${member.profile.user_id}`);
                        }
                      }
                    : undefined
                }
                showProfileIcon={member.profile.user_id !== user.id}
              />
            ))}
          </div>
        )}

        {/* Export Dialog - Mode-Aware */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isGroupingMode ? (
                  <>
                    <Target className="w-5 h-5" />
                    Export Grouping Session Report
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-5 h-5" />
                    Export Team Task History
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {isGroupingMode 
                  ? 'Export team performance data for the current active session only.'
                  : 'Export completed task history for all team members.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {isGroupingMode ? (
                // GROUPING MODE EXPORT
                <>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Export includes:</p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>Member identity (name, role, department)</li>
                      <li>Session details (name, dates, days remaining)</li>
                      <li>Group & individual target progress</li>
                      <li>PS daily entries (completed, pending counts)</li>
                      <li>Total reward points & attempts</li>
                      <li>Target status & completion projection</li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <strong>Note:</strong> Only data from the current active session will be exported. 
                      PBL task data is excluded.
                    </p>
                  </div>
                </>
              ) : (
                // PBL MODE EXPORT
                <>
                  <p className="text-sm text-muted-foreground">
                    Export completed task history for all team members. States, durations, and dates included.
                  </p>
                  
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
                  
                  <p className="text-xs text-muted-foreground">
                    Leave dates empty for full history export.
                  </p>
                </>
              )}
              
              {exportError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {exportError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => isGroupingMode ? handleGroupingExport('csv') : handlePBLExport('csv')}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Download CSV'}
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => isGroupingMode ? handleGroupingExport('xlsx') : handlePBLExport('xlsx')}
                  disabled={isExporting}
                >
                  {isExporting ? 'Exporting...' : 'Download Excel'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default Team;
