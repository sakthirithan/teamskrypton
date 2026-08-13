import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FileCheck, Sparkles } from 'lucide-react';

interface DailySurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitSurvey: (answers: Record<string, any>) => Promise<void>;
}

export function DailySurveyModal({ isOpen, onClose, onSubmitSurvey }: DailySurveyModalProps) {
  const [q1, setQ1] = useState<string>('yes');
  const [q2, setQ2] = useState<string>('achieved');
  const [q3, setQ3] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmitSurvey({
        daily_target_completed: q1,
        learning_status: q2,
        notes: q3,
        submitted_at: new Date().toISOString(),
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
            Daily Survey / PCDP Completion
          </DialogTitle>
          <DialogDescription>
            Submit your daily reflection and progress. Submitting updates your Daily Survey monitoring status automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Question 1 */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">1. Did you complete your planned daily targets today?</Label>
            <RadioGroup value={q1} onValueChange={setQ1} className="flex gap-4 pt-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="q1-yes" />
                <Label htmlFor="q1-yes" className="cursor-pointer">Yes, 100%</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="q1-partial" />
                <Label htmlFor="q1-partial" className="cursor-pointer">Partially (&gt;50%)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="q1-no" />
                <Label htmlFor="q1-no" className="cursor-pointer">Not Yet</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Question 2 */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">2. Personalized Skill (PS) Progress Status</Label>
            <RadioGroup value={q2} onValueChange={setQ2} className="flex flex-col gap-2 pt-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="achieved" id="q2-achieved" />
                <Label htmlFor="q2-achieved" className="cursor-pointer">Achieved required PS goal</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="in_progress" id="q2-progress" />
                <Label htmlFor="q2-progress" className="cursor-pointer">In progress / practicing</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Question 3 */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">3. Key Learnings &amp; Blockers (Optional)</Label>
            <Textarea
              value={q3}
              onChange={(e) => setQ3(e.target.value)}
              placeholder="Briefly describe what you learned or any support needed..."
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Survey'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
