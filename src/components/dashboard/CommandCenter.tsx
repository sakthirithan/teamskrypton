import { useState, memo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Clock, Bell } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Task {
  id: string;
  title: string;
  assigned_to: string;
  status: string;
}

interface CommandCenterProps {
  task: Task;
  getMemberName: (userId: string) => string;
  onActionComplete: () => void;
}

/**
 * Command Center - Symbol-based quick actions for leadership
 * 
 * Permissions:
 * - Team Captain & Vice Captain: Push Pending + Push Alert
 * - Strategist & Team Manager: Push Alert ONLY
 */
export const CommandCenter = memo(function CommandCenter({ 
  task, 
  getMemberName, 
  onActionComplete 
}: CommandCenterProps) {
  const { user, role, isCaptainOrVice, isLeadership } = useAuth();
  const { toast } = useToast();
  
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [pendingReason, setPendingReason] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permission checks
  const canPushPending = isCaptainOrVice && task.status !== 'pending';
  const canPushAlert = isLeadership;

  // Handle Push to Pending
  const handlePushToPending = useCallback(async () => {
    if (!user || !pendingReason.trim()) return;
    setIsSubmitting(true);

    try {
      // Update task status to pending
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'pending' })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Create alert with reason
      const { error: alertError } = await supabase
        .from('task_alerts')
        .insert({
          task_id: task.id,
          message: `Task pushed to Pending by leadership: ${pendingReason}`,
          created_by: user.id
        });

      if (alertError) throw alertError;

      toast({ 
        title: 'Task Pushed to Pending', 
        description: 'User has been notified.' 
      });
      
      setShowPendingDialog(false);
      setPendingReason('');
      onActionComplete();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error.message 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, task.id, pendingReason, toast, onActionComplete]);

  // Handle Push Alert
  const handlePushAlert = useCallback(async () => {
    if (!user || !alertMessage.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('task_alerts')
        .insert({
          task_id: task.id,
          message: alertMessage,
          created_by: user.id
        });

      if (error) throw error;

      toast({ 
        title: 'Alert Sent', 
        description: 'The assigned user has been notified.' 
      });
      
      setShowAlertDialog(false);
      setAlertMessage('');
      onActionComplete();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error.message 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, task.id, alertMessage, toast, onActionComplete]);

  // Don't render for non-leadership
  if (!isLeadership) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        {/* Push Pending Action */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={`h-8 w-8 ${
                canPushPending 
                  ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30' 
                  : 'text-muted-foreground/40 cursor-not-allowed'
              }`}
              disabled={!canPushPending}
              onClick={() => canPushPending && setShowPendingDialog(true)}
              aria-label="Push Task to Pending"
            >
              <Clock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="font-medium">Push Task to Pending</p>
            {!canPushPending && (
              <p className="text-xs text-muted-foreground mt-1">
                {task.status === 'pending' 
                  ? 'Task is already pending' 
                  : 'Only Captain & Vice Captain can use this'}
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Push Alert Action */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={`h-8 w-8 ${
                canPushAlert 
                  ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30' 
                  : 'text-muted-foreground/40 cursor-not-allowed'
              }`}
              disabled={!canPushAlert}
              onClick={() => canPushAlert && setShowAlertDialog(true)}
              aria-label="Send Alert to Assigned Users"
            >
              <Bell className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="font-medium">Send Alert to Assigned Users</p>
            <p className="text-xs text-muted-foreground mt-1">
              Notify the assigned user without changing task state
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Push to Pending Dialog */}
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Push Task to Pending
            </DialogTitle>
            <DialogDescription>
              This will mark the task as Pending and notify the assigned user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-sm">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Assigned to: {getMemberName(task.assigned_to)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pending-reason">Reason (Required)</Label>
              <Textarea 
                id="pending-reason"
                value={pendingReason}
                onChange={(e) => setPendingReason(e.target.value)}
                placeholder="Explain why this task is being marked as pending..."
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handlePushToPending}
                disabled={!pendingReason.trim() || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Processing...' : 'Push to Pending'}
              </Button>
              <Button 
                variant="ghost"
                onClick={() => {
                  setShowPendingDialog(false);
                  setPendingReason('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Push Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              Send Alert to Assigned User
            </DialogTitle>
            <DialogDescription>
              This alert will be visible to {getMemberName(task.assigned_to)} on this task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="font-medium text-sm">{task.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Assigned to: {getMemberName(task.assigned_to)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-message">Alert Message</Label>
              <Textarea 
                id="alert-message"
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                placeholder="Enter your alert message..."
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handlePushAlert}
                disabled={!alertMessage.trim() || isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Sending...' : 'Send Alert'}
              </Button>
              <Button 
                variant="ghost"
                onClick={() => {
                  setShowAlertDialog(false);
                  setAlertMessage('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
});
