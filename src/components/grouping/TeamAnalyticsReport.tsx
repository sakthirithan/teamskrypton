import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart3, Download, Users, BookOpen, Target, TrendingUp, 
  AlertTriangle, CheckCircle, Clock, Calendar 
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { format, subDays, isToday, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { calculateTargetStatus, calculateSessionDays, calculateDaysRemaining } from '@/lib/groupingConstants';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

interface TeamAnalyticsReportProps {
  session: GroupingSession;
}

interface MemberReport {
  userId: string;
  fullName: string;
  skillTracks: number;
  flowchartSteps: number;
  completedSteps: number;
  devLinks: number;
  reflections: number;
  psEntries: number;
  completedPoints: number;
  pendingPoints: number;
  targetPoints: number;
  targetStatus: string;
  activityCount: number;
  lastActive: string | null;
}

export function TeamAnalyticsReport({ session }: TeamAnalyticsReportProps) {
  const { toast } = useToast();
  const { targets } = useGroupingTargets(session.id);
  const [reportTab, setReportTab] = useState('overview');

  // Fetch all profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-analytics'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false)
        .eq('user_type', 'real');
      return data || [];
    },
  });

  // Fetch all skill tracks for session
  const { data: allTracks = [] } = useQuery({
    queryKey: ['analytics-tracks', session.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('skill_tracks')
        .select('*')
        .eq('session_id', session.id);
      return data || [];
    },
    enabled: !!session.id,
  });

  // Fetch all flowchart blocks
  const { data: allBlocks = [] } = useQuery({
    queryKey: ['analytics-blocks', session.id],
    queryFn: async () => {
      const trackIds = allTracks.map(t => t.id);
      if (trackIds.length === 0) return [];
      const { data } = await supabase
        .from('skill_flowchart_blocks')
        .select('*')
        .in('skill_track_id', trackIds);
      return data || [];
    },
    enabled: allTracks.length > 0,
  });

  // Fetch all dev links
  const { data: allLinks = [] } = useQuery({
    queryKey: ['analytics-links', session.id],
    queryFn: async () => {
      const trackIds = allTracks.map(t => t.id);
      if (trackIds.length === 0) return [];
      const { data } = await supabase
        .from('skill_dev_links')
        .select('*')
        .in('skill_track_id', trackIds);
      return data || [];
    },
    enabled: allTracks.length > 0,
  });

  // Fetch all reflections
  const { data: allReflections = [] } = useQuery({
    queryKey: ['analytics-reflections', session.id],
    queryFn: async () => {
      const trackIds = allTracks.map(t => t.id);
      if (trackIds.length === 0) return [];
      const { data } = await supabase
        .from('skill_reflections')
        .select('*')
        .in('skill_track_id', trackIds);
      return data || [];
    },
    enabled: allTracks.length > 0,
  });

  // Fetch all PS entries
  const { data: allEntries = [] } = useQuery({
    queryKey: ['analytics-entries', session.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('ps_daily_entries')
        .select('*')
        .eq('session_id', session.id)
        .eq('is_test', false);
      return data || [];
    },
    enabled: !!session.id,
  });

  // Fetch activity logs
  const { data: activityLogs = [] } = useQuery({
    queryKey: ['analytics-activity', session.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('skill_activity_log')
        .select('*')
        .eq('session_id', session.id);
      return data || [];
    },
    enabled: !!session.id,
  });

  const totalDays = calculateSessionDays(session.start_date, session.end_date);
  const daysRemaining = calculateDaysRemaining(session.end_date);

  // Build per-member reports
  const memberReports: MemberReport[] = useMemo(() => {
    return profiles.map(p => {
      const userTracks = allTracks.filter(t => t.user_id === p.user_id);
      const trackIds = userTracks.map(t => t.id);
      const userBlocks = allBlocks.filter(b => trackIds.includes(b.skill_track_id));
      const userLinks = allLinks.filter(l => trackIds.includes(l.skill_track_id));
      const userReflections = allReflections.filter(r => r.user_id === p.user_id);
      const userEntries = allEntries.filter(e => e.user_id === p.user_id);
      const userActivity = activityLogs.filter(a => a.user_id === p.user_id);
      const completedEntries = userEntries.filter(e => e.status === 'completed');
      const pendingEntries = userEntries.filter(e => e.status === 'pending');
      const target = targets.find(t => t.target_scope === 'individual' && t.user_id === p.user_id);

      const completedPoints = completedEntries.reduce((sum, e) => sum + e.reward_points, 0);
      const pendingPoints = pendingEntries.reduce((sum, e) => sum + e.reward_points, 0);
      const targetPoints = target?.target_points || 0;
      const status = calculateTargetStatus(completedPoints, targetPoints, daysRemaining, totalDays);

      const lastActivityDate = userActivity.length > 0
        ? userActivity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
        : null;

      return {
        userId: p.user_id,
        fullName: p.full_name,
        skillTracks: userTracks.length,
        flowchartSteps: userBlocks.length,
        completedSteps: userBlocks.filter(b => b.status === 'completed').length,
        devLinks: userLinks.length,
        reflections: userReflections.length,
        psEntries: userEntries.length,
        completedPoints,
        pendingPoints,
        targetPoints,
        targetStatus: status,
        activityCount: userActivity.length,
        lastActive: lastActivityDate,
      };
    }).sort((a, b) => b.activityCount - a.activityCount);
  }, [profiles, allTracks, allBlocks, allLinks, allReflections, allEntries, activityLogs, targets, daysRemaining, totalDays]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalSkillTracks = allTracks.length;
    const totalBlocks = allBlocks.length;
    const completedBlocks = allBlocks.filter(b => b.status === 'completed').length;
    const totalLinks = allLinks.length;
    const totalReflections = allReflections.length;
    const activeLearners = new Set(allTracks.map(t => t.user_id)).size;
    const atRisk = memberReports.filter(m => m.targetStatus === 'behind' || m.targetStatus === 'at_risk').length;
    const onTrack = memberReports.filter(m => m.targetStatus === 'on_track').length;
    const stagnant = memberReports.filter(m => {
      if (!m.lastActive) return true;
      return new Date(m.lastActive) < subDays(new Date(), 7);
    }).length;

    // This week's activity
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeekActivity = activityLogs.filter(a => 
      isWithinInterval(new Date(a.created_at), { start: weekStart, end: weekEnd })
    ).length;

    // Today's activity
    const todayActivity = activityLogs.filter(a => isToday(new Date(a.created_at))).length;

    return {
      totalSkillTracks, totalBlocks, completedBlocks, totalLinks, totalReflections,
      activeLearners, atRisk, onTrack, stagnant, thisWeekActivity, todayActivity,
      totalMembers: profiles.length,
      blockCompletionRate: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0,
    };
  }, [allTracks, allBlocks, allLinks, allReflections, activityLogs, memberReports, profiles]);

  // Export functions
  const exportReport = (exportFormat: 'csv' | 'xlsx', reportType: 'full' | 'weekly' | 'daily') => {
    let exportData: any[];
    let sheetName: string;
    let filename: string;
    const sessionName = session.name.replace(/\s+/g, '_');
    const dateStr = format(new Date(), 'yyyy-MM-dd');

    if (reportType === 'full') {
      exportData = memberReports.map((m, idx) => ({
        '#': idx + 1,
        'Member': m.fullName,
        'Skill Tracks': m.skillTracks,
        'Flowchart Steps': m.flowchartSteps,
        'Completed Steps': m.completedSteps,
        'Step Completion %': m.flowchartSteps > 0 ? Math.round((m.completedSteps / m.flowchartSteps) * 100) + '%' : 'N/A',
        'Dev Links': m.devLinks,
        'Reflections': m.reflections,
        'PS Entries': m.psEntries,
        'Completed Pts': m.completedPoints,
        'Pending Pts': m.pendingPoints,
        'Target Pts': m.targetPoints,
        'Target Status': m.targetStatus.replace('_', ' ').toUpperCase(),
        'Activity Count': m.activityCount,
        'Last Active': m.lastActive ? format(new Date(m.lastActive), 'yyyy-MM-dd HH:mm') : 'Never',
      }));
      sheetName = 'Full Report';
      filename = `Skill_Report_${sessionName}_${dateStr}.${exportFormat}`;
    } else if (reportType === 'weekly') {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      const weeklyActivity = activityLogs.filter(a =>
        isWithinInterval(new Date(a.created_at), { start: weekStart, end: weekEnd })
      );
      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
      
      exportData = weeklyActivity.map((a, idx) => ({
        '#': idx + 1,
        'Member': profileMap.get(a.user_id) || 'Unknown',
        'Activity': a.activity_type.replace('_', ' '),
        'Description': a.description,
        'Date': format(new Date(a.created_at), 'yyyy-MM-dd'),
        'Time': format(new Date(a.created_at), 'HH:mm'),
      }));
      sheetName = 'Weekly Report';
      filename = `Weekly_Skill_Report_${sessionName}_${format(weekStart, 'MMM-dd')}_to_${format(weekEnd, 'MMM-dd')}.${exportFormat}`;
    } else {
      // Daily
      const todayLogs = activityLogs.filter(a => isToday(new Date(a.created_at)));
      const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
      
      exportData = todayLogs.map((a, idx) => ({
        '#': idx + 1,
        'Member': profileMap.get(a.user_id) || 'Unknown',
        'Activity': a.activity_type.replace('_', ' '),
        'Description': a.description,
        'Time': format(new Date(a.created_at), 'HH:mm'),
      }));
      sheetName = 'Daily Report';
      filename = `Daily_Skill_Report_${sessionName}_${dateStr}.${exportFormat}`;
    }

    if (exportData.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No data available for this report.' });
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
    toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Team Analytics & Reports
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => exportReport('xlsx', 'daily')}>
                <Download className="w-3 h-3" /> Daily
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => exportReport('xlsx', 'weekly')}>
                <Download className="w-3 h-3" /> Weekly
              </Button>
              <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={() => exportReport('xlsx', 'full')}>
                <Download className="w-3 h-3" /> Full Report
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <BookOpen className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{aggregateStats.totalSkillTracks}</p>
            <p className="text-[10px] text-muted-foreground">Skill Tracks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{aggregateStats.blockCompletionRate}%</p>
            <p className="text-[10px] text-muted-foreground">Steps Done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{aggregateStats.thisWeekActivity}</p>
            <p className="text-[10px] text-muted-foreground">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold">{aggregateStats.stagnant}</p>
            <p className="text-[10px] text-muted-foreground">Stagnant (7d+)</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Indicators */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-green-600">{aggregateStats.onTrack}</p>
            <p className="text-[10px] text-muted-foreground">On Track</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-red-600">{aggregateStats.atRisk}</p>
            <p className="text-[10px] text-muted-foreground">At Risk</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{aggregateStats.activeLearners}/{aggregateStats.totalMembers}</p>
            <p className="text-[10px] text-muted-foreground">Active Learners</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Member Report */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Member Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {memberReports.map((member, idx) => (
                <div key={member.userId} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-5">{idx + 1}</span>
                      <span className="text-sm font-medium truncate">{member.fullName}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-[9px] ${
                        member.targetStatus === 'on_track' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                        member.targetStatus === 'at_risk' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                        'bg-red-500/10 text-red-600 border-red-500/20'
                      }`}
                    >
                      {member.targetStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-xs font-semibold">{member.skillTracks}</p>
                      <p className="text-[9px] text-muted-foreground">Tracks</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{member.completedSteps}/{member.flowchartSteps}</p>
                      <p className="text-[9px] text-muted-foreground">Steps</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-green-600">{member.completedPoints}</p>
                      <p className="text-[9px] text-muted-foreground">Pts</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{member.activityCount}</p>
                      <p className="text-[9px] text-muted-foreground">Activity</p>
                    </div>
                  </div>
                  {member.targetPoints > 0 && (
                    <Progress 
                      value={Math.min(100, (member.completedPoints / member.targetPoints) * 100)} 
                      className="h-1.5 mt-2" 
                    />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
