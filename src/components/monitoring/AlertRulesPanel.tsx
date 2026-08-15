import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  useMonitoringAlertRules,
  RuleCriterion,
  RuleRepeat,
  RecipientType,
  CRITERION_LABELS,
  REPEAT_LABELS,
  WEEKDAY_OPTIONS,
  MonitoringAlertRule,
} from '@/hooks/useMonitoringAlertRules';
import { ScheduledAlert, MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import {
  Bell,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Loader2,
  Search,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AlertRulesPanelProps {
  scheduledAlerts: ScheduledAlert[];
  members?: MemberMonitoringStatus[];
  onCancelScheduledAlert: (id: string) => Promise<void>;
  onOpenSendAlertModal: () => void;
}

export function AlertRulesPanel({
  scheduledAlerts,
  members = [],
  onCancelScheduledAlert,
  onOpenSendAlertModal,
}: AlertRulesPanelProps) {
  const { rules, isLoading, createRule, updateRule, deleteRule, isLeadership } = useMonitoringAlertRules();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MonitoringAlertRule | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [criterion, setCriterion] = useState<RuleCriterion>('any');
  const [recipientType, setRecipientType] = useState<RecipientType>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Default Mon-Fri
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [runAtTime, setRunAtTime] = useState('18:00');
  const [repeatMode, setRepeatMode] = useState<RuleRepeat>('weekdays');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const filteredFormMembers = members.filter(
    (m) =>
      !memberSearchQuery ||
      m.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.department.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const resetForm = () => {
    setName('');
    setCriterion('any');
    setRecipientType('all');
    setSelectedUserIds([]);
    setSelectedDays([1, 2, 3, 4, 5]);
    setMemberSearchQuery('');
    setRunAtTime('18:00');
    setRepeatMode('weekdays');
    setTitle('');
    setMessage('');
    setEditingRule(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setTitle('Complete your daily targets, then take the Daily Survey');
    setMessage('Please complete your remaining daily requirements before the end of the day.');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (rule: MonitoringAlertRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setCriterion(rule.criterion);
    setRecipientType(rule.recipient_type || 'all');
    setSelectedUserIds(rule.target_user_ids || []);
    setSelectedDays(rule.selected_days || [1, 2, 3, 4, 5]);
    setRunAtTime(rule.run_at_time);
    setRepeatMode(rule.repeat_mode || 'weekdays');
    setTitle(rule.title);
    setMessage(rule.message);
    setIsCreateModalOpen(true);
  };

  const handleToggleWeekday = (dayVal: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayVal)) {
        if (prev.length === 1) return prev; // At least one day required
        return prev.filter((d) => d !== dayVal);
      }
      return [...prev, dayVal].sort();
    });
  };

  const handleToggleMember = (userId: string) => {
    if (recipientType === 'individual') {
      setSelectedUserIds([userId]);
    } else {
      setSelectedUserIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleSaveRule = async () => {
    if (!name.trim() || !title.trim() || !message.trim() || selectedDays.length === 0) return;

    if (editingRule) {
      await updateRule.mutateAsync({
        id: editingRule.id,
        name,
        criterion,
        recipient_type: recipientType,
        target_user_ids: selectedUserIds,
        selected_days: selectedDays,
        run_at_time: runAtTime,
        repeat_mode: repeatMode,
        title,
        message,
      });
    } else {
      await createRule.mutateAsync({
        name,
        criterion,
        recipient_type: recipientType,
        target_user_ids: selectedUserIds,
        selected_days: selectedDays,
        run_at_time: runAtTime,
        repeat_mode: repeatMode,
        title,
        message,
      });
    }
    setIsCreateModalOpen(false);
    resetForm();
  };

  const getDaysLabel = (days?: number[]): string => {
    if (!days || days.length === 0) return 'Mon-Fri';
    if (days.length === 7) return 'Every Day';
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'Weekdays (M-F)';
    return days
      .map((d) => WEEKDAY_OPTIONS.find((w) => w.value === d)?.label)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border bg-card shadow-xs">
        <div>
          <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" /> Monitoring Alerts &amp; Automation Hub
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure automated requirement reminders with custom day scheduling and ON/OFF controls.
          </p>
        </div>

        {isLeadership && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenCreate}
              className="h-8 text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Plus className="w-3.5 h-3.5" /> Add Automation Rule
            </Button>
            <Button
              size="sm"
              onClick={onOpenSendAlertModal}
              className="h-8 text-xs font-bold gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white"
            >
              <Bell className="w-3.5 h-3.5" /> Send Alert Now
            </Button>
          </div>
        )}
      </div>

      {/* Section 1: Automation Rules */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" /> Recurring Automation Rules
        </h4>

        {isLoading ? (
          <div className="p-4 rounded-xl border bg-card animate-pulse h-24" />
        ) : rules.length === 0 ? (
          <Card className="p-6 text-center space-y-2 border-dashed">
            <Clock className="w-8 h-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs font-bold text-foreground">No Automation Rules Configured</p>
            <p className="text-[11px] text-muted-foreground">
              Create rules to automatically remind members with missing AP, PS, or Survey entries at set times on selected days.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rules.map((rule) => (
              <Card
                key={rule.id}
                className={`p-3.5 border transition-all space-y-3 shadow-xs ${
                  rule.is_enabled ? 'bg-card border-border' : 'bg-muted/30 border-dashed opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-xs text-foreground">{rule.name}</h5>
                      <Badge
                        variant={rule.is_enabled ? 'default' : 'secondary'}
                        className={`text-[9px] font-bold px-1.5 py-0 ${
                          rule.is_enabled ? 'bg-emerald-600 text-white' : 'bg-muted-foreground/20 text-muted-foreground'
                        }`}
                      >
                        {rule.is_enabled ? 'ON' : 'OFF'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {getDaysLabel(rule.selected_days)} @ {rule.run_at_time}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Criterion: <strong>{CRITERION_LABELS[rule.criterion]}</strong>
                    </p>
                  </div>

                  {isLeadership && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={(val) => updateRule.mutate({ id: rule.id, is_enabled: val })}
                      />
                    </div>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-muted/40 border border-border/50 text-[11px] space-y-1">
                  <p className="font-bold text-foreground">{rule.title}</p>
                  <p className="text-muted-foreground leading-tight line-clamp-2">{rule.message}</p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t text-[10px] text-muted-foreground">
                  <span>
                    Last run:{' '}
                    {rule.last_run_at ? (
                      <strong className="text-foreground">
                        {formatDistanceToNow(new Date(rule.last_run_at), { addSuffix: true })} ({rule.last_run_count} sent)
                      </strong>
                    ) : (
                      'Never'
                    )}
                  </span>

                  {isLeadership && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(rule)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => deleteRule.mutate(rule.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Scheduled Alerts Queue */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" /> Scheduled Alert Queue
        </h4>

        {scheduledAlerts.length === 0 ? (
          <Card className="p-4 text-center text-xs text-muted-foreground border-dashed">
            No scheduled one-off alerts pending.
          </Card>
        ) : (
          <div className="space-y-2">
            {scheduledAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3 rounded-xl border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{alert.title}</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-bold ${
                        alert.status === 'scheduled'
                          ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                          : alert.status === 'sent'
                          ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10'
                          : 'border-muted text-muted-foreground'
                      }`}
                    >
                      {alert.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px]">{alert.message}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Scheduled for: {new Date(alert.scheduled_at).toLocaleString()}
                  </p>
                </div>

                {isLeadership && alert.status === 'scheduled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0"
                    onClick={() => onCancelScheduledAlert(alert.id)}
                  >
                    Cancel Alert
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Rule Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent hideCloseButton={true} className="max-w-md p-0 flex flex-col max-h-[90vh] bg-card">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              {editingRule ? 'Edit Automation Rule' : 'New Automation Rule'}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 p-4 space-y-4">

          <div className="space-y-3 text-xs">
            <div>
              <Label className="text-xs font-bold">Rule Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Evening Survey Nudge"
                className="h-8 text-xs mt-1"
              />
            </div>

            {/* Recipient Targeting Selection */}
            <div className="space-y-2 p-2.5 rounded-xl border bg-muted/20">
              <Label className="text-xs font-bold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" /> Recipient Target Type
              </Label>
              <Select value={recipientType} onValueChange={(v) => setRecipientType(v as RecipientType)}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Eligible Members</SelectItem>
                  <SelectItem value="individual">Individual Member</SelectItem>
                  <SelectItem value="multiple">Multiple Selected Members</SelectItem>
                </SelectContent>
              </Select>

              {/* Searchable Member Selector for Individual / Multiple */}
              {(recipientType === 'individual' || recipientType === 'multiple') && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search member name or dept..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="pl-7 h-7 text-xs bg-background"
                    />
                  </div>

                  <ScrollArea className="h-32 border rounded-lg p-2 bg-background">
                    <div className="space-y-1.5">
                      {filteredFormMembers.map((m) => {
                        const isChecked = selectedUserIds.includes(m.userId);
                        return (
                          <div
                            key={m.userId}
                            onClick={() => handleToggleMember(m.userId)}
                            className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                              isChecked ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 pointer-events-none">
                              <Checkbox checked={isChecked} tabIndex={-1} />
                              <div>
                                <p className="font-bold text-xs leading-none">{m.fullName}</p>
                                <p className="text-[9px] text-muted-foreground">{m.department}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[9px]">
                              {m.role.replace('_', ' ')}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {selectedUserIds.length} member(s) selected
                  </p>
                </div>
              )}
            </div>

            {/* Weekday Selection Controls: [ M ] [ T ] [ W ] [ Th ] [ F ] [ S ] [ Su ] */}
            <div className="space-y-1.5 p-2.5 rounded-xl border bg-muted/20">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>Active Schedule Days</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {selectedDays.length} day(s) active
                </span>
              </Label>

              <div className="grid grid-cols-7 gap-1 pt-1">
                {WEEKDAY_OPTIONS.map((dayOption) => {
                  const isActive = selectedDays.includes(dayOption.value);
                  return (
                    <button
                      key={dayOption.value}
                      type="button"
                      onClick={() => handleToggleWeekday(dayOption.value)}
                      title={dayOption.full}
                      className={`h-8 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center border ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-background border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {dayOption.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-bold">Missing Criterion</Label>
                <Select value={criterion} onValueChange={(v) => setCriterion(v as RuleCriterion)}>
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRITERION_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold">Execution Time (HH:MM 24h)</Label>
                <Input
                  type="time"
                  value={runAtTime}
                  onChange={(e) => setRunAtTime(e.target.value)}
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Notification Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Complete your daily targets, then take the Daily Survey"
                className="h-8 text-xs mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-bold">Notification Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Reminder message body..."
                className="text-xs mt-1 min-h-[60px]"
              />
            </div>
          </div>

          </ScrollArea>

          <DialogFooter className="p-4 border-t bg-muted/30 flex items-center justify-between gap-2 shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRule}
              disabled={createRule.isPending || updateRule.isPending || selectedDays.length === 0}
              className="bg-primary font-bold"
            >
              {(createRule.isPending || updateRule.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
