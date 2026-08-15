import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Coins, ClipboardList, CalendarCheck, FileCheck, User, Sparkles, Check } from 'lucide-react';
import { MonitoringTargets, MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TargetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: MonitoringTargets;
  members: MemberMonitoringStatus[];
  onSaveGlobalTargets: (newTargets: Partial<MonitoringTargets>) => Promise<void>;
  onSaveIndividualTargets: (params: {
    userId: string;
    required_ap_target?: number | null;
    required_ps_target?: number | null;
    required_meeting_target?: number | null;
    required_survey_target?: number | null;
  }) => Promise<void>;
}

export function MonitoringTargetConfigModal({
  isOpen,
  onClose,
  targets,
  members,
  onSaveGlobalTargets,
  onSaveIndividualTargets,
}: TargetConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'global' | 'individual'>('global');

  // Global Target States
  const [apTarget, setApTarget] = useState(targets.required_ap_target);
  const [psTarget, setPsTarget] = useState(targets.required_ps_target);
  const [meetingTarget, setMeetingTarget] = useState(targets.required_meeting_target);
  const [surveyTarget, setSurveyTarget] = useState(targets.required_survey_target);

  // Individual Member Override States
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [indivAp, setIndivAp] = useState<string>('');
  const [indivPs, setIndivPs] = useState<string>('');
  const [indivMeeting, setIndivMeeting] = useState<string>('');
  const [indivSurvey, setIndivSurvey] = useState<string>('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setApTarget(targets.required_ap_target);
    setPsTarget(targets.required_ps_target);
    setMeetingTarget(targets.required_meeting_target);
    setSurveyTarget(targets.required_survey_target);
  }, [targets, isOpen]);

  useEffect(() => {
    if (!selectedUserId) {
      setIndivAp('');
      setIndivPs('');
      setIndivMeeting('');
      setIndivSurvey('');
      return;
    }

    const member = members.find((m) => m.userId === selectedUserId);
    if (member?.customTargets) {
      setIndivAp(member.customTargets.required_ap_target?.toString() ?? '');
      setIndivPs(member.customTargets.required_ps_target?.toString() ?? '');
      setIndivMeeting(member.customTargets.required_meeting_target?.toString() ?? '');
      setIndivSurvey(member.customTargets.required_survey_target?.toString() ?? '');
    } else {
      setIndivAp('');
      setIndivPs('');
      setIndivMeeting('');
      setIndivSurvey('');
    }
  }, [selectedUserId, members]);

  // SELECTIVE PARTIAL COLUMN UPDATES (Only update modified fields!)
  const handleGlobalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const changed: Partial<MonitoringTargets> = {};
      if (apTarget !== targets.required_ap_target) changed.required_ap_target = Number(apTarget);
      if (psTarget !== targets.required_ps_target) changed.required_ps_target = Number(psTarget);
      if (meetingTarget !== targets.required_meeting_target) changed.required_meeting_target = Number(meetingTarget);
      if (surveyTarget !== targets.required_survey_target) changed.required_survey_target = Number(surveyTarget);

      // If any field changed, submit only the modified columns
      await onSaveGlobalTargets(Object.keys(changed).length > 0 ? changed : {
        required_ap_target: Number(apTarget),
        required_ps_target: Number(psTarget),
        required_meeting_target: Number(meetingTarget),
        required_survey_target: Number(surveyTarget),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleIndividualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setIsSaving(true);
    try {
      await onSaveIndividualTargets({
        userId: selectedUserId,
        required_ap_target: indivAp !== '' ? parseInt(indivAp, 10) : null,
        required_ps_target: indivPs !== '' ? parseInt(indivPs, 10) : null,
        required_meeting_target: indivMeeting !== '' ? parseInt(indivMeeting, 10) : null,
        required_survey_target: indivSurvey !== '' ? parseInt(indivSurvey, 10) : null,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent hideCloseButton={true} className="sm:max-w-[520px] p-0 flex flex-col max-h-[90vh] backdrop-blur-xl bg-card/90 border border-primary/20">
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-foreground">
            <Target className="w-5 h-5 text-primary" />
            Configure Target Columns
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selective column updates: Only modified target columns will update and rerender on the monitoring board.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 p-4 min-h-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-4">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/60">
            <TabsTrigger value="global" className="gap-2 font-bold text-xs">
              <Target className="w-3.5 h-3.5" /> Global Defaults
            </TabsTrigger>
            <TabsTrigger value="individual" className="gap-2 font-bold text-xs">
              <User className="w-3.5 h-3.5" /> Member Overrides
            </TabsTrigger>
          </TabsList>

          {/* Global Targets Tab */}
          <TabsContent value="global">
            <form onSubmit={handleGlobalSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-wider">
                  <Coins className="w-3.5 h-3.5" /> AP Target Column
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={apTarget}
                  onChange={(e) => setApTarget(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 4200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs font-bold text-blue-500 uppercase tracking-wider">
                  <ClipboardList className="w-3.5 h-3.5" /> PS Entry Target Column
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={psTarget}
                  onChange={(e) => setPsTarget(parseInt(e.target.value) || 1)}
                  placeholder="e.g. 1"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wider">
                  <CalendarCheck className="w-3.5 h-3.5" /> Meeting Target Column
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={meetingTarget}
                  onChange={(e) => setMeetingTarget(parseInt(e.target.value) || 1)}
                  placeholder="e.g. 1"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2 text-xs font-bold text-purple-500 uppercase tracking-wider">
                  <FileCheck className="w-3.5 h-3.5" /> Daily Survey Target Count Column
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={surveyTarget}
                  onChange={(e) => setSurveyTarget(parseInt(e.target.value) || 1)}
                  placeholder="e.g. 4"
                  required
                />
              </div>

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-2 bg-primary text-primary-foreground font-bold">
                  <Sparkles className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Update Modified Columns'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Individual Member Override Tab */}
          <TabsContent value="individual">
            <form onSubmit={handleIndividualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider">Select Member</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a member for custom target..." />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.fullName} ({m.department})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedUserId && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-amber-500">AP Target Override</Label>
                    <Input
                      type="number"
                      placeholder={`Global default (${targets.required_ap_target})`}
                      value={indivAp}
                      onChange={(e) => setIndivAp(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-blue-500">PS Target Override</Label>
                    <Input
                      type="number"
                      placeholder={`Global default (${targets.required_ps_target})`}
                      value={indivPs}
                      onChange={(e) => setIndivPs(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-emerald-500">Meeting Target Override</Label>
                    <Input
                      type="number"
                      placeholder={`Global default (${targets.required_meeting_target})`}
                      value={indivMeeting}
                      onChange={(e) => setIndivMeeting(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-purple-500">Daily Survey Target Override</Label>
                    <Input
                      type="number"
                      placeholder={`Global default (${targets.required_survey_target})`}
                      value={indivSurvey}
                      onChange={(e) => setIndivSurvey(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <DialogFooter className="pt-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || !selectedUserId} className="gap-2 bg-primary text-primary-foreground font-bold">
                  <Check className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Update Member Override Column'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </DialogContent>
  </Dialog>
  );
}
