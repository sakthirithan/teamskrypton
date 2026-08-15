import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { Bell, Send, Loader2, Coins, ClipboardList, FileCheck } from 'lucide-react';

interface MemberAlertPopoverProps {
  member: MemberMonitoringStatus;
  isLeadership: boolean;
  onSendAlert: (params: {
    recipientIds: string[];
    title: string;
    messagePrefix?: string;
    alertType: string;
  }) => Promise<void>;
}

export function MemberAlertPopover({ member, isLeadership, onSendAlert }: MemberAlertPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('Update your daily Target / PS records');
  const [customMsg, setCustomMsg] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isLeadership) return null;

  const handleSend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSending(true);
    try {
      await onSendAlert({
        recipientIds: [member.userId],
        title,
        messagePrefix: customMsg.trim() || undefined,
        alertType: 'monitoring_reminder',
      });
      setIsOpen(false);
      setCustomMsg('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 shrink-0"
          title={`Send alert to ${member.fullName}`}
        >
          <Bell className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-80 p-3.5 bg-card border shadow-xl text-xs space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>Alert: {member.fullName}</span>
          </div>
          <Badge variant="outline" className="text-[9px] capitalize font-mono">
            {member.role.replace('_', ' ')}
          </Badge>
        </div>

        {/* Live Current Status Preview */}
        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 space-y-1 text-[11px]">
          <p className="font-bold text-foreground">Current Live Monitoring Status:</p>
          <p className="flex items-center gap-1.5 text-amber-500 font-mono">
            <Coins className="w-3 h-3" /> AP: <strong>{member.ap.achieved} / {member.ap.target}</strong>
          </p>
          <p className="flex items-center gap-1.5 text-blue-500">
            <ClipboardList className="w-3 h-3" /> Minimum PS: <strong>{member.ps.isMet ? 'Completed' : 'Not Yet'}</strong>
          </p>
          <p className="flex items-center gap-1.5 text-purple-400 font-mono">
            <FileCheck className="w-3 h-3" /> Daily Survey: <strong>{member.dailySurvey.achieved} / {member.dailySurvey.target}</strong>
          </p>
        </div>

        {/* Composer Inputs */}
        <div className="space-y-2">
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Alert Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-7 text-xs mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Note / Message (Optional)</label>
            <Textarea
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              placeholder="e.g. Please update your survey before 6 PM..."
              rows={2}
              className="text-xs mt-0.5"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white gap-1"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Send Alert
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
