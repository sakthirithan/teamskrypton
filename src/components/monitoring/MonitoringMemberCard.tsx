import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { MemberAlertPopover } from '@/components/monitoring/MemberAlertPopover';
import {
  Coins,
  ClipboardList,
  FileCheck,
  Edit2,
} from 'lucide-react';

interface MonitoringMemberCardProps {
  member: MemberMonitoringStatus;
  isLeadership: boolean;
  isSelected: boolean;
  onToggleSelect: (userId: string) => void;
  onUpdateAp: (params: { userId: string; points: number }) => Promise<void>;
  onSetPsStatus?: (params: { userId: string; newStatus: 'completed' | 'pending'; count?: number }) => Promise<void>;
  onSetSurveyCount?: (params: { userId: string; count: number }) => Promise<void>;
  onSendAlert: (params: {
    recipientIds: string[];
    title: string;
    messagePrefix?: string;
    alertType: string;
  }) => Promise<void>;
  onOpenDrawer?: (member: MemberMonitoringStatus) => void;
}

export function MonitoringMemberCard({
  member,
  isLeadership,
  isSelected,
  onToggleSelect,
  onUpdateAp,
  onSetPsStatus,
  onSetSurveyCount,
  onSendAlert,
  onOpenDrawer,
}: MonitoringMemberCardProps) {
  const [isEditingAp, setIsEditingAp] = useState(false);
  const [apInput, setApInput] = useState(member.ap.achieved.toString());
  const [isUpdating, setIsUpdating] = useState(false);

  const roleLabel = member.role.replace('_', ' ');

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

  return (
    <Card
      onClick={() => onOpenDrawer && onOpenDrawer(member)}
      className={`relative overflow-hidden transition-all duration-200 border bg-card/95 backdrop-blur-xl shadow-xs cursor-pointer ${
        isSelected
          ? 'bg-primary/10 border-primary ring-1 ring-primary/40'
          : member.overallMet
          ? 'border-emerald-500/30 hover:border-emerald-500/50'
          : 'border-amber-500/30 hover:border-amber-500/50'
      }`}
    >
      {/* Top Header */}
      <CardHeader className="p-3 pb-2 space-y-0 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {isLeadership && (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(member.userId)}
                  className="h-4 w-4 border-primary shrink-0"
                />
              </div>
            )}

            <Avatar className="h-9 w-9 border border-primary/20 shrink-0">
              <AvatarImage src={member.avatarUrl || ''} alt={member.fullName} />
              <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                {member.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="font-bold text-xs leading-none text-foreground tracking-tight truncate">
                  {member.fullName}
                </h4>
                <Badge variant="outline" className="text-[9px] capitalize font-semibold bg-muted/40 border-primary/20 px-1 py-0">
                  {roleLabel}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium truncate">{member.department}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Badge
              variant={member.overallMet ? 'default' : 'destructive'}
              className={`text-[10px] px-2 py-0.5 font-bold shadow-xs ${
                member.overallMet ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
              }`}
            >
              {member.overallMet ? '✓ Met' : '! Missing'}
            </Badge>

            {isLeadership && (
              <MemberAlertPopover member={member} isLeadership={isLeadership} onSendAlert={onSendAlert} />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-2.5 text-xs">
        {/* 3 Grid Columns: AP | PS | Daily Survey */}
        <div className="grid grid-cols-3 gap-2">
          {/* AP Column */}
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-500">
              <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> AP</span>
            </div>
            {isLeadership && isEditingAp ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="number"
                  min="0"
                  value={apInput}
                  onChange={(e) => setApInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAp();
                    if (e.key === 'Escape') setIsEditingAp(false);
                  }}
                  onBlur={handleSaveAp}
                  className="h-6 text-xs font-mono font-bold px-1"
                  autoFocus
                />
              </div>
            ) : (
              <div
                onClick={(e) => {
                  if (isLeadership) {
                    e.stopPropagation();
                    setIsEditingAp(true);
                  }
                }}
                className={`flex items-center justify-between ${isLeadership ? 'cursor-pointer hover:bg-amber-500/20 rounded px-1' : ''}`}
              >
                <span className="font-extrabold text-xs font-mono text-foreground">
                  {member.ap.achieved.toLocaleString()}
                </span>
                {isLeadership && <Edit2 className="w-3 h-3 text-amber-500 opacity-60" />}
              </div>
            )}
            <p className="text-[9px] text-muted-foreground font-mono">/ {member.ap.target}</p>
          </div>

          {/* PS Column */}
          <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
            <span className="flex items-center gap-1 font-bold text-blue-500 text-[10px]">
              <ClipboardList className="w-3 h-3" /> PS
            </span>
            <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
              <Badge
                variant="outline"
                onClick={async () => {
                  if (isLeadership && onSetPsStatus) {
                    await onSetPsStatus({
                      userId: member.userId,
                      newStatus: member.ps.isMet ? 'pending' : 'completed',
                      count: member.ps.target,
                    });
                  }
                }}
                className={`text-[9px] font-bold px-1.5 py-0 ${isLeadership ? 'cursor-pointer hover:opacity-80' : ''} ${
                  member.ps.isMet ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-amber-500/20 border-amber-500 text-amber-500'
                }`}
              >
                {member.ps.isMet ? '✓ Completed' : 'Not Yet'}
              </Badge>
            </div>
          </div>

          {/* Daily Survey Count Column with Stepper Controls [-] [+] */}
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
            <span className="flex items-center gap-1 font-bold text-purple-400 text-[10px]">
              <FileCheck className="w-3 h-3" /> Survey
            </span>
            <div className="flex items-center gap-1 font-mono font-extrabold text-xs" onClick={(e) => e.stopPropagation()}>
              {isLeadership && onSetSurveyCount && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-4 w-4 text-[10px] font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10 shrink-0"
                  onClick={async () => {
                    await onSetSurveyCount({
                      userId: member.userId,
                      count: Math.max(0, member.dailySurvey.achieved - 1),
                    });
                  }}
                >
                  −
                </Button>
              )}
              <span className="text-foreground">{member.dailySurvey.achieved} / {member.dailySurvey.target}</span>
              {isLeadership && onSetSurveyCount && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-4 w-4 text-[10px] font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10 shrink-0"
                  onClick={async () => {
                    await onSetSurveyCount({
                      userId: member.userId,
                      count: member.dailySurvey.achieved + 1,
                    });
                  }}
                >
                  +
                </Button>
              )}
            </div>
            <div className="h-1 w-full bg-muted/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${member.dailySurvey.isMet ? 'bg-emerald-400' : 'bg-purple-400'}`}
                style={{ width: `${Math.min(100, member.dailySurvey.percentage)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
