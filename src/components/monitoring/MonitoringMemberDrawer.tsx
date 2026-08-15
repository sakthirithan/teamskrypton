import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { supabase } from '@/integrations/supabase/client';
import {
  Bell,
  Coins,
  ClipboardList,
  FileCheck,
  Target,
  History,
  Send,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface MonitoringMemberDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  member: MemberMonitoringStatus | null;
  isLeadership: boolean;
  onUpdateAp: (params: { userId: string; points: number }) => Promise<void>;
  onSaveIndividualTargets: (params: {
    userId: string;
    required_ap_target?: number | null;
    required_ps_target?: number | null;
    required_survey_target?: number | null;
  }) => Promise<void>;
  onOpenAlertModal: (userId: string) => void;
  onSendSurveyPrompt: (userId: string) => Promise<void>;
}

export function MonitoringMemberDrawer({
  isOpen,
  onClose,
  member,
  isLeadership,
  onUpdateAp,
  onSaveIndividualTargets,
  onOpenAlertModal,
  onSendSurveyPrompt,
}: MonitoringMemberDrawerProps) {
  if (!member) return null;

  // State for inline AP editing inside drawer (Leadership only)
  const [isEditingAp, setIsEditingAp] = useState(false);
  const [apInput, setApInput] = useState(member.ap.achieved.toString());
  const [isSavingAp, setIsSavingAp] = useState(false);

  // State for individual target overrides editing (Leadership only)
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [targetAp, setTargetAp] = useState(member.ap.target.toString());
  const [targetPs, setTargetPs] = useState(member.ps.target.toString());
  const [targetSurvey, setTargetSurvey] = useState(member.dailySurvey.target.toString());
  const [isSavingTargets, setIsSavingTargets] = useState(false);

  // Member activity history
  const [memberActivity, setMemberActivity] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  useEffect(() => {
    if (member) {
      setApInput(member.ap.achieved.toString());
      setTargetAp(member.ap.target.toString());
      setTargetPs(member.ps.target.toString());
      setTargetSurvey(member.dailySurvey.target.toString());
    }
  }, [member]);

  useEffect(() => {
    if (isOpen && member) {
      fetchMemberActivity(member.userId);
    }
  }, [isOpen, member?.userId]);

  const fetchMemberActivity = async (userId: string) => {
    setIsLoadingActivity(true);
    try {
      const { data, error } = await supabase
        .from('monitoring_audit_log')
        .select('*')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setMemberActivity(data || []);
    } catch {
      setMemberActivity([]);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleSaveAp = async () => {
    const pts = parseInt(apInput, 10);
    if (isNaN(pts) || pts < 0) return;
    setIsSavingAp(true);
    try {
      await onUpdateAp({ userId: member.userId, points: pts });
      setIsEditingAp(false);
    } finally {
      setIsSavingAp(false);
    }
  };

  const handleSaveTargets = async () => {
    setIsSavingTargets(true);
    try {
      await onSaveIndividualTargets({
        userId: member.userId,
        required_ap_target: parseInt(targetAp, 10) || null,
        required_ps_target: parseInt(targetPs, 10) || null,
        required_survey_target: parseInt(targetSurvey, 10) || null,
      });
      setIsEditingTargets(false);
    } finally {
      setIsSavingTargets(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" hideCloseButton={true} className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card">
        {/* Header */}
        <SheetHeader className="p-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-12 w-12 border-2 border-primary/20 shrink-0">
                <AvatarImage src={member.avatarUrl || ''} alt={member.fullName} />
                <AvatarFallback className="font-bold bg-primary/10 text-primary">
                  {member.fullName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SheetTitle className="text-base font-extrabold truncate leading-tight">
                  {member.fullName}
                </SheetTitle>
                <p className="text-xs text-muted-foreground font-medium truncate">
                  {member.department} • <span className="capitalize">{member.role.replace('_', ' ')}</span>
                </p>
              </div>
            </div>
            <Badge
              variant={member.overallMet ? 'default' : 'destructive'}
              className={`text-xs font-bold shrink-0 ${member.overallMet ? 'bg-emerald-600' : 'bg-amber-600'}`}
            >
              {member.overallMet ? '✓ Complete' : '! Missing'}
            </Badge>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 p-4 space-y-5">
          <div className="space-y-4">
            {/* Criteria Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-primary" /> Current Monitoring Requirements
              </h4>

              <div className="space-y-2.5">
                {/* AP Criterion */}
                <div className="p-3 rounded-xl border bg-background/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                      <Coins className="w-4 h-4" /> Activity Points (AP)
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${member.ap.isMet ? 'border-emerald-500 text-emerald-500' : 'border-amber-500 text-amber-500'}`}
                    >
                      {member.ap.achieved} / {member.ap.target} ({member.ap.percentage}%)
                    </Badge>
                  </div>

                  {isLeadership && isEditingAp ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        type="number"
                        min="0"
                        value={apInput}
                        onChange={(e) => setApInput(e.target.value)}
                        className="h-8 text-xs font-mono font-bold"
                        placeholder="AP points"
                      />
                      <Button size="sm" className="h-8 bg-amber-600 hover:bg-amber-700" onClick={handleSaveAp} disabled={isSavingAp}>
                        {isSavingAp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setIsEditingAp(false)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex-1 mr-3">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${member.ap.isMet ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${member.ap.percentage}%` }} />
                        </div>
                      </div>
                      {isLeadership && (
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-amber-500/30 text-amber-500" onClick={() => setIsEditingAp(true)}>
                          Edit AP
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* PS Criterion */}
                <div className="p-3 rounded-xl border bg-background/60 flex items-center justify-between">
                  <div>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-blue-500">
                      <ClipboardList className="w-4 h-4" /> Problem Solving (PS)
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Requirement: Minimum 1 PS entry today
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold ${member.ps.isMet ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-amber-500 text-amber-500 bg-amber-500/10'}`}
                  >
                    {member.ps.isMet ? '✓ Completed' : 'Not Yet'}
                  </Badge>
                </div>

                {/* Survey Criterion */}
                <div className="p-3 rounded-xl border bg-background/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
                      <FileCheck className="w-4 h-4" /> Daily Survey Responses
                    </span>
                    <span className="text-xs font-mono font-bold">{member.dailySurvey.achieved} / {member.dailySurvey.target}</span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${member.dailySurvey.isMet ? 'bg-emerald-500' : 'bg-purple-500'}`}
                      style={{ width: `${Math.min(100, member.dailySurvey.percentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Individual Member Target Overrides (Leadership only) */}
            {isLeadership && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-primary" /> Member Target Overrides
                  </h4>
                  {!isEditingTargets && (
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => setIsEditingTargets(true)}>
                      Modify Overrides
                    </Button>
                  )}
                </div>

                {isEditingTargets ? (
                  <div className="p-3 rounded-xl border bg-primary/5 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px]">AP Target</Label>
                        <Input type="number" value={targetAp} onChange={(e) => setTargetAp(e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">PS Target</Label>
                        <Input type="number" value={targetPs} onChange={(e) => setTargetPs(e.target.value)} className="h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px]">Survey Target</Label>
                        <Input type="number" value={targetSurvey} onChange={(e) => setTargetSurvey(e.target.value)} className="h-7 text-xs" />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setIsEditingTargets(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-primary" onClick={handleSaveTargets} disabled={isSavingTargets}>
                        {isSavingTargets ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Overrides'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border bg-muted/20 text-xs space-y-1">
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">AP Target:</span>
                      <strong className="font-mono">{member.ap.target}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">PS Target:</span>
                      <strong className="font-mono">{member.ps.target}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Survey Target:</span>
                      <strong className="font-mono">{member.dailySurvey.target}</strong>
                    </p>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Member Activity Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-primary" /> Audit &amp; Activity History
              </h4>

              {isLoadingActivity ? (
                <div className="py-4 text-center">
                  <Loader2 className="w-4 h-4 mx-auto animate-spin text-muted-foreground" />
                </div>
              ) : memberActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2 text-center">No recorded activity yet today.</p>
              ) : (
                <div className="space-y-2">
                  {memberActivity.map((act) => (
                    <div key={act.id} className="p-2.5 rounded-lg border bg-background/40 text-xs space-y-0.5">
                      <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                        <span className="font-bold text-foreground capitalize">{act.field.replace('_', ' ')}</span>
                        <span className="font-mono">{formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-[11px] font-medium text-foreground">
                        {act.old_value ? `Changed from "${act.old_value}" to "${act.new_value}"` : `Set to "${act.new_value}"`}
                      </p>
                      {act.note && <p className="text-[10px] text-muted-foreground italic">{act.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Fixed Bottom Action Bar */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between gap-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-xs font-bold">
            Cancel
          </Button>

          {isLeadership && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 font-bold"
                onClick={async () => {
                  await onSendSurveyPrompt(member.userId);
                }}
              >
                <Send className="w-3.5 h-3.5" /> Request Survey
              </Button>
              <Button
                size="sm"
                className="h-9 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                onClick={() => {
                  onClose();
                  onOpenAlertModal(member.userId);
                }}
              >
                <Bell className="w-3.5 h-3.5" /> Send Alert
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
