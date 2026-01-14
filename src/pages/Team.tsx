import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KryptonRole, TaskStatus, LEADERSHIP_ROLES } from '@/lib/constants';
import { Users, Download, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { validateExportDateRange, getTodayString } from '@/lib/exportValidation';
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
  };
  role: KryptonRole | null;
  taskStats: {
    total: number;
    completed: number;
    inProgress: boolean;
  };
}

const Team = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice } = useAuth();
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

    // Fetch task stats for each user
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

  // Export team directory with task history and validation
  const handleExport = async (exportFormat: 'csv' | 'xlsx') => {
    const validation = validateExportDateRange(fromDate, toDate);
    if (!validation.isValid) {
      setExportError(validation.error);
      return;
    }
    setExportError(null);

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
        'Role': member?.role ? member.role : '-',
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
                onClick={() => {
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
                    ? () => navigate(isLeadership ? `/member/${member.profile.user_id}` : `/profile/${member.profile.user_id}`)
                    : undefined
                }
                showProfileIcon={member.profile.user_id !== user.id}
              />
            ))}
          </div>
        )}

        {/* Export Dialog */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Export Team Task History
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Export completed task history for all team members. States, durations, and dates included. Alerts and reasons are excluded.
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
              
              {exportError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                  <AlertCircle className="w-4 h-4" />
                  {exportError}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Leave dates empty for full history export.
              </p>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => handleExport('csv')}>
                  Download CSV
                </Button>
                <Button className="flex-1" onClick={() => handleExport('xlsx')}>
                  Download Excel
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
