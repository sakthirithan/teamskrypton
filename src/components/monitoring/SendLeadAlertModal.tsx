import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, Clock, AlertTriangle, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGroupingNotifications } from '@/hooks/useGroupingNotifications';
import { MemberMonitoringStatus } from '@/services/monitoringService';
import { supabase } from '@/integrations/supabase/client';

interface SendLeadAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: MemberMonitoringStatus[];
  initialCriteriaFilter?: string;
}

export function SendLeadAlertModal({
  isOpen,
  onClose,
  members,
  initialCriteriaFilter = 'all',
}: SendLeadAlertModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendTargetedNotification } = useGroupingNotifications();

  const [alertType, setAlertType] = useState<'survey' | 'ps' | 'ap' | 'general'>('survey');
  const [targetAudience, setTargetAudience] = useState<
    'all' | 'missing' | 'ap_missing' | 'ps_missing' | 'survey_missing' | 'selected'
  >('missing');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [title, setTitle] = useState('Urgent: Daily Requirement Pending');
  const [message, setMessage] = useState(
    'Please complete your pending daily requirements immediately to maintain team compliance.'
  );
  const [enableFollowUp, setEnableFollowUp] = useState(true);

  // Compute eligible recipients based on audience selection
  const eligibleMembers = members.filter((m) => {
    if (targetAudience === 'all') return true;
    if (targetAudience === 'missing') return m.overallStatus === 'missing';
    if (targetAudience === 'ap_missing') return !m.ap.criteriaMet;
    if (targetAudience === 'ps_missing') return !m.ps.criteriaMet;
    if (targetAudience === 'survey_missing') return !m.survey.criteriaMet;
    if (targetAudience === 'selected') return selectedUserIds.includes(m.userId);
    return true;
  });

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(members.map((m) => m.userId));
    } else {
      setSelectedUserIds([]);
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSendAlert = async () => {
    if (!user) return;
    const recipientIds = eligibleMembers.map((m) => m.userId);

    if (recipientIds.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Recipients Selected',
        description: 'There are no eligible members matching the selected filter criteria.',
      });
      return;
    }

    try {
      // 1. Send immediate notification
      const result = await sendTargetedNotification.mutateAsync({
        recipient_ids: recipientIds,
        target_audience: 'direct',
        title,
        message,
        type: `requirement_alert_${alertType}`,
        is_24h_broadcast: true,
      });

      // 2. Log alert and schedule 5-minute / 10-minute follow-up log in monitoring_alert_logs
      const followUpMinutes = alertType === 'survey' ? 10 : 5;
      const followUpDue = new Date(Date.now() + followUpMinutes * 60 * 1000).toISOString();

      const logRows = recipientIds.map((recId) => ({
        sender_id: user.id,
        recipient_id: recId,
        alert_type: alertType,
        target_criteria: targetAudience,
        sent_at: new Date().toISOString(),
        follow_up_due_at: enableFollowUp ? followUpDue : null,
        follow_up_sent: false,
        follow_up_status: 'pending',
      }));

      await supabase.from('monitoring_alert_logs' as any).insert(logRows);

      toast({
        title: 'Requirement Alert Dispatched!',
        description: `Alert sent to ${recipientIds.length} member(s). ${
          enableFollowUp
            ? `Actionable follow-up push scheduled in ${followUpMinutes} minutes.`
            : ''
        }`,
      });

      onClose();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Alert Sending Failed',
        description: err.message,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bell className="w-5 h-5 text-amber-500" />
            Dispatch Lead Requirement Alert
          </DialogTitle>
          <DialogDescription className="text-xs">
            Send immediate push notifications and actionable follow-ups to non-compliant members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Requirement Category</label>
              <Select
                value={alertType}
                onValueChange={(val: any) => {
                  setAlertType(val);
                  if (val === 'survey') {
                    setTitle('Urgent: Daily Survey Pending');
                    setMessage('Please complete your Daily PCDP Survey to update your monitoring record.');
                  } else if (val === 'ps') {
                    setTitle('Notice: Personalized Skill Entry Missing');
                    setMessage('Your Personalized Skill requirement for this week is still pending.');
                  } else if (val === 'ap') {
                    setTitle('Notice: Activity Points Target Remaining');
                    setMessage('You have remaining Activity Points required for this period.');
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="survey">Daily Survey</SelectItem>
                  <SelectItem value="ps">Personalized Skills (PS)</SelectItem>
                  <SelectItem value="ap">Activity Points (AP)</SelectItem>
                  <SelectItem value="general">General Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Target Audience Filter</label>
              <Select
                value={targetAudience}
                onValueChange={(val: any) => setTargetAudience(val)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">All Missing Members</SelectItem>
                  <SelectItem value="survey_missing">Survey Pending Members</SelectItem>
                  <SelectItem value="ps_missing">PS Pending Members</SelectItem>
                  <SelectItem value="ap_missing">AP Target Unmet Members</SelectItem>
                  <SelectItem value="all">All Eligible Members</SelectItem>
                  <SelectItem value="selected">Manually Selected Members</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Notification Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Notification Message Body</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="text-xs resize-none"
            />
          </div>

          {targetAudience === 'selected' && (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30 max-h-36 overflow-y-auto">
              <div className="flex items-center justify-between pb-1 border-b text-xs font-medium">
                <span>Select Specific Members ({selectedUserIds.length})</span>
                <div className="flex items-center gap-1">
                  <Checkbox
                    id="select-all-modal"
                    checked={selectedUserIds.length === members.length && members.length > 0}
                    onCheckedChange={(ch) => handleToggleSelectAll(!!ch)}
                  />
                  <label htmlFor="select-all-modal" className="text-[11px] cursor-pointer">
                    Select All
                  </label>
                </div>
              </div>
              <div className="space-y-1 pt-1">
                {members.map((m) => (
                  <div key={m.userId} className="flex items-center gap-2 text-xs">
                    <Checkbox
                      id={`m-${m.userId}`}
                      checked={selectedUserIds.includes(m.userId)}
                      onCheckedChange={() => handleToggleUser(m.userId)}
                    />
                    <label htmlFor={`m-${m.userId}`} className="cursor-pointer flex-1 flex justify-between">
                      <span>{m.fullName}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{m.role}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-2.5 rounded-lg border bg-amber-500/5 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <div>
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  Actionable Follow-up ({alertType === 'survey' ? '10 min' : '5 min'})
                </span>
                <p className="text-[10px] text-muted-foreground">
                  Sends actionable [Completed] / [Not Yet] follow-up notification.
                </p>
              </div>
            </div>
            <Checkbox
              checked={enableFollowUp}
              onCheckedChange={(ch) => setEnableFollowUp(!!ch)}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Target Recipients Count:</span>
            </div>
            <Badge variant="secondary" className="font-semibold tabular-nums">
              {eligibleMembers.length} member(s)
            </Badge>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSendAlert}
            disabled={sendTargetedNotification.isPending || eligibleMembers.length === 0}
            className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium"
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {sendTargetedNotification.isPending ? 'Sending...' : 'Dispatch Alert Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
