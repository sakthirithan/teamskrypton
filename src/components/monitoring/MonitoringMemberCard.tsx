import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TwoStatusButtons } from '@/components/monitoring/TwoStatusButtons';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import {
  Coins,
  ClipboardList,
  CalendarCheck,
  FileCheck,
  CheckCircle2,
  XCircle,
  Bell,
  Edit2,
  Check,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface MonitoringMemberCardProps {
  member: MemberMonitoringStatus;
  isLeadership: boolean;
  isSelected: boolean;
  onToggleSelect: (userId: string) => void;
  onUpdateAp: (params: { userId: string; points: number }) => Promise<void>;
  onSetPsStatus: (params: { userId: string; newStatus: 'completed' | 'pending'; count?: number }) => Promise<void>;
  onSetMeetingStatus: (params: { userId: string; status: 'completed' | 'pending' }) => Promise<void>;
  onSetSurveyCount: (params: { userId: string; count: number }) => Promise<void>;
  onOpenAlertModal: (userId: string) => void;
}

export function MonitoringMemberCard({
  member,
  isLeadership,
  isSelected,
  onToggleSelect,
  onUpdateAp,
  onSetPsStatus,
  onSetMeetingStatus,
  onSetSurveyCount,
  onOpenAlertModal,
}: MonitoringMemberCardProps) {
  const [isEditingAp, setIsEditingAp] = useState(false);
  const [apInput, setApInput] = useState(member.ap.achieved.toString());
  const [isUpdating, setIsUpdating] = useState(false);

  const roleLabel = member.role.replace('_', ' ');

  const handleApBoxClick = () => {
    if (!isLeadership || isUpdating) return;
    setApInput(member.ap.achieved.toString());
    setIsEditingAp(true);
  };

  const handleSaveAp = async () => {
    if (isUpdating) return;
    const pts = parseInt(apInput, 10);
    if (isNaN(pts) || pts < 0) {
      setIsEditingAp(false);
      return;
    }
    if (pts === member.ap.achieved) {
      setIsEditingAp(false);
      return;
    }

    setIsUpdating(true);
    try {
      await onUpdateAp({ userId: member.userId, points: pts });
      setIsEditingAp(false);
    } catch {
      setApInput(member.ap.achieved.toString());
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickAddAp = async (delta: number) => {
    if (isUpdating) return;
    const newTotal = member.ap.achieved + delta;
    setIsUpdating(true);
    try {
      await onUpdateAp({ userId: member.userId, points: newTotal });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-200 border backdrop-blur-xl shadow-sm ${
        isSelected
          ? 'bg-primary/10 border-primary ring-1 ring-primary/40'
          : member.overallMet
          ? 'bg-card/90 border-emerald-500/30 hover:border-emerald-500/50'
          : 'bg-card/90 border-amber-500/30 hover:border-amber-500/50'
      }`}
    >
      {/* Top Header */}
      <CardHeader className="p-3 pb-2 space-y-0 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {isLeadership && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(member.userId)}
                className="h-4 w-4 border-primary shrink-0"
              />
            )}

            <Avatar className="h-9 w-9 border border-primary/20 shrink-0">
              <AvatarImage src={member.avatarUrl || ''} alt={member.fullName} />
              <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                {member.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-bold text-xs leading-none text-foreground tracking-tight truncate">{member.fullName}</h4>
                <Badge variant="outline" className="text-[9px] capitalize font-semibold bg-muted/40 border-primary/20 px-1 py-0">
                  {roleLabel}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium truncate">{member.department}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant={member.overallMet ? 'default' : 'destructive'}
              className={`text-[10px] px-2 py-0.5 font-bold shadow-xs ${
                member.overallMet 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-amber-600 text-white'
              }`}
            >
              {member.overallMet ? 'Met' : 'Missing'}
            </Badge>

            {isLeadership && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-full"
                title="Send Alert"
                onClick={() => onOpenAlertModal(member.userId)}
              >
                <Bell className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3 text-xs">
        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
            <span>AP Target Progress</span>
            <span className="text-foreground font-bold">{member.ap.percentage}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden p-0.5 border border-border/40">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                member.ap.isMet ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'
              }`}
              style={{ width: `${member.ap.percentage}%` }}
            />
          </div>
        </div>

        {/* Responsive Grid Layout: AP | PS | Daily Survey (Next to PS!) | Group Meeting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* 1. AP Box */}
          <div
            className={`p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 transition-all ${
              isLeadership ? 'cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/15' : ''
            }`}
            onClick={handleApBoxClick}
            title={isLeadership ? 'Click to edit AP directly inline' : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                <Coins className="w-3.5 h-3.5" /> AP
              </span>
              {isUpdating ? (
                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
              ) : member.ap.isMet ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-amber-500" />
              )}
            </div>

            {isLeadership && isEditingAp ? (
              <div className="flex items-center gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="number"
                  min="0"
                  value={apInput}
                  onChange={(e) => setApInput(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAp();
                    if (e.key === 'Escape') setIsEditingAp(false);
                  }}
                  onBlur={() => handleSaveAp()}
                  disabled={isUpdating}
                  className="h-7 text-xs font-extrabold font-mono bg-background/90 border-amber-500 focus:ring-1 focus:ring-amber-500 px-1.5"
                  placeholder="AP..."
                  autoFocus
                />
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                ) : (
                  <Button size="icon" className="h-7 w-7 bg-amber-600 hover:bg-amber-700 shrink-0" onClick={() => handleSaveAp()}>
                    <Check className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-extrabold text-xs text-foreground font-mono">{member.ap.achieved.toLocaleString()} / {member.ap.target.toLocaleString()}</p>
                  {isLeadership && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-amber-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApBoxClick();
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Quick Add AP Buttons */}
                {isLeadership && (
                  <div className="flex items-center gap-1 pt-1 border-t border-amber-500/20" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-400/40 text-amber-600 dark:text-amber-400" onClick={() => handleQuickAddAp(50)}>
                      +50
                    </Button>
                    <Button size="sm" variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-400/40 text-amber-600 dark:text-amber-400" onClick={() => handleQuickAddAp(100)}>
                      +100
                    </Button>
                    <Button size="sm" variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-400/40 text-amber-600 dark:text-amber-400" onClick={() => handleQuickAddAp(500)}>
                      +500
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. PS Entry Box */}
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                <ClipboardList className="w-3.5 h-3.5" /> PS Entry
              </span>
              {member.ps.isMet ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-amber-500" />}
            </div>

            <div className="space-y-1">
              <p className="font-extrabold text-xs text-foreground font-mono">{member.ps.displayText}</p>
              <TwoStatusButtons
                isCompleted={member.ps.isMet}
                isLeadership={isLeadership}
                onSetCompleted={() => onSetPsStatus({ userId: member.userId, newStatus: 'completed', count: member.ps.target })}
                onSetPending={() => onSetPsStatus({ userId: member.userId, newStatus: 'pending' })}
              />
            </div>
          </div>

          {/* 3. Daily Survey Box (MOVED NEXT TO PS ENTRY!) */}
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400 text-[11px]">
                <FileCheck className="w-3.5 h-3.5" /> Daily Survey
              </span>
              {member.dailySurvey.isMet ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-amber-500" />}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="font-extrabold text-xs text-foreground">{member.dailySurvey.displayText}</span>
                <span className={member.dailySurvey.isMet ? 'text-emerald-400 font-bold' : 'text-purple-400 font-bold'}>
                  {member.dailySurvey.percentage}%
                </span>
              </div>
              <TwoStatusButtons
                isCompleted={member.dailySurvey.isMet}
                isLeadership={isLeadership}
                onSetCompleted={() => onSetSurveyCount({ userId: member.userId, count: member.dailySurvey.target })}
                onSetPending={() => onSetSurveyCount({ userId: member.userId, count: 0 })}
                completedLabel="✓ Done (4)"
                pendingLabel="↻ Pend (0)"
              />
            </div>
          </div>

          {/* 4. Group Meeting Box */}
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                <CalendarCheck className="w-3.5 h-3.5" /> Group Meeting
              </span>
              {member.groupMeeting.isMet ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-amber-500" />}
            </div>

            <div className="space-y-1">
              <p className="font-extrabold text-xs text-foreground font-mono">{member.groupMeeting.displayText}</p>
              <TwoStatusButtons
                isCompleted={member.groupMeeting.isMet}
                isLeadership={isLeadership}
                onSetCompleted={() => onSetMeetingStatus({ userId: member.userId, status: 'completed' })}
                onSetPending={() => onSetMeetingStatus({ userId: member.userId, status: 'pending' })}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
