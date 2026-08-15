import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileCheck, Sparkles } from 'lucide-react';

interface DailySurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  surveyTarget?: number;
  currentSurveyCount?: number;
  currentPsCompleted?: boolean;
  onSubmitSurvey: (params: {
    psStatus: 'completed' | 'pending';
    surveyCount: number;
    answers?: Record<string, any>;
  }) => Promise<void>;
}

export function DailySurveyModal({
  isOpen,
  onClose,
  surveyTarget = 4,
  currentSurveyCount = 0,
  currentPsCompleted = false,
  onSubmitSurvey,
}: DailySurveyModalProps) {
  const [psStatus, setPsStatus] = useState<'completed' | 'pending'>('pending');
  const [submittedCount, setSubmittedCount] = useState<string>('1');
  const [q1, setQ1] = useState<string>('yes');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPsStatus(currentPsCompleted ? 'completed' : 'pending');
      setSubmittedCount(Math.max(1, currentSurveyCount + 1).toString());
    }
  }, [isOpen, currentPsCompleted, currentSurveyCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(submittedCount, 10);
    if (isNaN(count) || count < 0) return;

    setIsSubmitting(true);
    try {
      await onSubmitSurvey({
        psStatus,
        surveyCount: count,
        answers: {
          daily_target_completed: q1,
          notes,
          submitted_at: new Date().toISOString(),
        },
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FileCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            Take Daily Survey
          </DialogTitle>
          <DialogDescription>
            Complete your daily reflection to update your authoritative Minimum PS and Daily Survey Monitoring status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {/* Question 1: Minimum PS */}
          <div className="p-3 rounded-xl border bg-blue-500/5 border-blue-500/20 space-y-2">
            <Label className="text-xs font-bold text-foreground block">
              1. Minimum PS Requirement Status
            </Label>
            <RadioGroup
              value={psStatus}
              onValueChange={(val) => setPsStatus(val as 'completed' | 'pending')}
              className="flex gap-4 pt-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="completed" id="ps-completed" />
                <Label htmlFor="ps-completed" className="cursor-pointer font-bold text-emerald-500">
                  [ Completed ]
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pending" id="ps-pending" />
                <Label htmlFor="ps-pending" className="cursor-pointer font-semibold text-muted-foreground">
                  [ Not Yet ]
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Question 2: Surveys submitted this week / count */}
          <div className="p-3 rounded-xl border bg-purple-500/5 border-purple-500/20 space-y-2">
            <Label className="text-xs font-bold text-foreground block">
              2. How many surveys have you submitted today/this week?
            </Label>
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="number"
                min="0"
                value={submittedCount}
                onChange={(e) => setSubmittedCount(e.target.value)}
                className="h-8 w-24 font-mono font-bold text-xs"
              />
              <span className="text-xs font-bold font-mono text-purple-400">
                / {surveyTarget} (Target)
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Enter your exact count of submitted survey responses.
            </p>
          </div>

          {/* Question 3: Targets completed */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">3. Did you complete your planned daily targets today?</Label>
            <RadioGroup value={q1} onValueChange={setQ1} className="flex gap-4 pt-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="q1-yes" />
                <Label htmlFor="q1-yes" className="cursor-pointer text-xs">Yes, 100%</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="q1-partial" />
                <Label htmlFor="q1-partial" className="cursor-pointer text-xs">Partially (&gt;50%)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="q1-no" />
                <Label htmlFor="q1-no" className="cursor-pointer text-xs">Not Yet</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Question 4: Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">4. Key Learnings &amp; Blockers (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Briefly describe what you learned or any support needed..."
              rows={2}
              className="text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              {isSubmitting ? 'Submitting...' : 'Submit Survey'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
