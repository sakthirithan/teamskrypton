import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, Send, Users, Sparkles, Clock, Coins, ClipboardList, FileCheck } from 'lucide-react';
import { MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LeadAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberMonitoringStatus[];
  initialSelectedMemberId?: string | null;
  onSendAlert: (params: {
    recipientIds: string[];
    title: string;
    messagePrefix?: string;
    alertType: string;
    isDailySurveyAlert?: boolean;
    expiryHours?: number;
  }) => Promise<void>;
}

export function LeadAlertModal({
  isOpen,
  onClose,
  members,
  initialSelectedMemberId,
  onSendAlert,
}: LeadAlertModalProps) {
  const [filterTarget, setFilterTarget] = useState<string>(initialSelectedMemberId ? 'selected' : 'missing');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [title, setTitle] = useState('Complete your daily targets, then take the Daily Survey');
  const [messagePrefix, setMessagePrefix] = useState('Please achieve your daily targets and submit your survey.');
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialSelectedMemberId) {
        setFilterTarget('selected');
        setSelectedMemberIds([initialSelectedMemberId]);
      } else {
        setFilterTarget('missing');
        setSelectedMemberIds([]);
      }
    }
  }, [isOpen, initialSelectedMemberId]);

  // Compute recipient list based on filter
  const getRecipientIds = (): string[] => {
    if (filterTarget === 'all') return members.map((m) => m.userId);
    if (filterTarget === 'missing') return members.filter((m) => !m.overallMet).map((m) => m.userId);
    if (filterTarget === 'ap_missing') return members.filter((m) => !m.ap.isMet).map((m) => m.userId);
    if (filterTarget === 'ps_missing') return members.filter((m) => !m.ps.isMet).map((m) => m.userId);
    if (filterTarget === 'survey_missing') return members.filter((m) => !m.dailySurvey.isMet).map((m) => m.userId);
    if (filterTarget === 'selected') return selectedMemberIds;
    return [];
  };

  const recipientIds = getRecipientIds();
  const recipientCount = recipientIds.length;

  const targetMember = recipientCount === 1 ? members.find((m) => m.userId === recipientIds[0]) : null;

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipientIds.length === 0) return;

    setIsSending(true);
    try {
      await onSendAlert({
        recipientIds,
        title,
        messagePrefix,
        alertType: 'daily_survey_alert',
        isDailySurveyAlert: true,
        expiryHours,
      });
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" hideCloseButton={true} className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card shadow-2xl">
        {/* Header */}
        <SheetHeader className="p-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-extrabold flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Send Lead Alert
            </SheetTitle>
            <Badge variant="secondary" className="font-bold text-xs gap-1">
              <Users className="w-3.5 h-3.5" />
              {targetMember ? targetMember.fullName : `${recipientCount} Member(s)`}
            </Badge>
          </div>
        </SheetHeader>

        {/* Scrollable Form Body */}
        <ScrollArea className="flex-1 p-4 space-y-4">
          <form id="lead-alert-form" onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Live Monitoring Preview for single member */}
            {targetMember && (
              <div className="p-3 rounded-xl border bg-muted/40 space-y-1.5 text-[11px]">
                <p className="font-extrabold text-foreground text-xs">Current Live Monitoring Status:</p>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold">
                    <span className="flex items-center gap-1 text-[10px]"><Coins className="w-3 h-3" /> AP</span>
                    <p className="font-mono text-xs text-foreground mt-0.5">{targetMember.ap.achieved} / {targetMember.ap.target}</p>
                  </div>
                  <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-500 font-bold">
                    <span className="flex items-center gap-1 text-[10px]"><ClipboardList className="w-3 h-3" /> PS</span>
                    <p className="text-xs text-foreground mt-0.5">{targetMember.ps.isMet ? 'Completed' : 'Not Yet'}</p>
                  </div>
                  <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold">
                    <span className="flex items-center gap-1 text-[10px]"><FileCheck className="w-3 h-3" /> Survey</span>
                    <p className="font-mono text-xs text-foreground mt-0.5">{targetMember.dailySurvey.achieved} / {targetMember.dailySurvey.target}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Target Filter Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Target Audience</Label>
              <Select value={filterTarget} onValueChange={setFilterTarget}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select target group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">All Missing Members ({members.filter((m) => !m.overallMet).length})</SelectItem>
                  <SelectItem value="survey_missing">Daily Survey Missing ({members.filter((m) => !m.dailySurvey.isMet).length})</SelectItem>
                  <SelectItem value="ps_missing">PS Missing ({members.filter((m) => !m.ps.isMet).length})</SelectItem>
                  <SelectItem value="ap_missing">AP Missing ({members.filter((m) => !m.ap.isMet).length})</SelectItem>
                  <SelectItem value="all">All Members ({members.length})</SelectItem>
                  <SelectItem value="selected">Custom Select Members ({selectedMemberIds.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Member Selection List */}
            {filterTarget === 'selected' && (
              <div className="space-y-2 border rounded-xl p-2.5 bg-muted/20">
                <Label className="text-xs font-bold text-muted-foreground">Select Individual Members:</Label>
                <ScrollArea className="h-36 pr-1">
                  <div className="space-y-1">
                    {members.map((m) => (
                      <div
                        key={m.userId}
                        onClick={() => handleToggleMember(m.userId)}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-muted/50 text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2 pointer-events-none">
                          <Checkbox checked={selectedMemberIds.includes(m.userId)} tabIndex={-1} />
                          <span className="font-semibold">{m.fullName}</span>
                        </div>
                        <Badge variant={m.overallMet ? 'outline' : 'destructive'} className="text-[9px]">
                          {m.overallMet ? 'Met' : 'Missing'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Title Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Alert Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="h-8 text-xs" />
            </div>

            {/* Message Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Message Note / Note</Label>
              <Textarea
                value={messagePrefix}
                onChange={(e) => setMessagePrefix(e.target.value)}
                rows={2}
                placeholder="e.g. Please submit your updates before 6 PM."
                required
                className="text-xs"
              />
            </div>

            {/* Disappearance Duration */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3 text-amber-500" /> Expiry Duration
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExpiryHours(24)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                    expiryHours === 24 ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-card border-border text-muted-foreground'
                  }`}
                >
                  24 Hours (Default)
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryHours(48)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all ${
                    expiryHours === 48 ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-card border-border text-muted-foreground'
                  }`}
                >
                  48 Hours
                </button>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-400">
                <Sparkles className="w-3.5 h-3.5" /> Personalized Live Data Resolution
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Each recipient will receive an alert automatically populated with their own live AP, Minimum PS, and Daily Survey numbers.
              </p>
            </div>
          </form>
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between gap-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSending} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            form="lead-alert-form"
            disabled={isSending || recipientCount === 0}
            className="h-8 text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isSending ? 'Sending...' : `Send Alert (${recipientCount})`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
