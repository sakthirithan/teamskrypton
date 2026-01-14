import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Check, X, Upload, Clock, Trash2, FileText, Loader2, Play } from 'lucide-react';
import { format } from 'date-fns';

interface Approval {
  id: string;
  approval_type: string;
  target_user_id: string | null;
  target_task_id: string | null;
  initiated_by: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  target_user_name?: string;
  task_title?: string;
  initiator_name?: string;
  votes?: { voter_id: string; vote_type: string }[];
}

interface PendingTask {
  id: string;
  title: string;
  deadline: string;
  status: string;
}

interface CompletedTask {
  id: string;
  title: string;
  completed_at: string;
  has_docs: boolean;
}

export function AlertTab() {
  const { user, isLeadership, isCaptainOrVice } = useAuth();
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [docForm, setDocForm] = useState({ taskId: '', githubUrl: '', description: '' });

  const fetchData = useCallback(async () => {
    if (!user) return;

    // Fetch approvals relevant to the user
    let approvalsQuery = supabase
      .from('approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data: approvalsData } = await approvalsQuery;

    if (approvalsData) {
      // Enrich with names
      const enrichedApprovals = await Promise.all(approvalsData.map(async (approval) => {
        let target_user_name = '';
        let task_title = '';
        let initiator_name = '';

        if (approval.target_user_id) {
          const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', approval.target_user_id)
            .maybeSingle();
          target_user_name = data?.full_name || '';
        }

        if (approval.target_task_id) {
          const { data } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', approval.target_task_id)
            .maybeSingle();
          task_title = data?.title || '';
        }

        if (approval.initiated_by) {
          const { data } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', approval.initiated_by)
            .maybeSingle();
          initiator_name = data?.full_name || '';
        }

        // Fetch votes
        const { data: votesData } = await supabase
          .from('approval_votes')
          .select('voter_id, vote_type')
          .eq('approval_id', approval.id);

        return {
          ...approval,
          target_user_name,
          task_title,
          initiator_name,
          votes: votesData || []
        };
      }));

      setApprovals(enrichedApprovals);
    }

    // Fetch user's pending tasks (deadline exceeded)
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, title, deadline, status')
      .eq('assigned_to', user.id)
      .eq('status', 'pending');

    if (tasksData) {
      setPendingTasks(tasksData);
    }

    // Fetch completed tasks without docs (for upload option)
    const { data: completedData } = await supabase
      .from('tasks')
      .select('id, title, completed_at')
      .eq('assigned_to', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    if (completedData) {
      // Check which have docs
      const { data: docsData } = await supabase
        .from('task_documents')
        .select('task_id')
        .eq('user_id', user.id);

      const docsSet = new Set(docsData?.map(d => d.task_id) || []);
      
      setCompletedTasks(completedData.map(t => ({
        ...t,
        has_docs: docsSet.has(t.id)
      })));
    }

    setIsLoading(false);
  }, [user, isLeadership]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription for approvals
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('approvals-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'approvals',
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchData]);

  const handleVote = async (approvalId: string, voteType: 'approve' | 'reject') => {
    if (!user) return;
    setProcessingId(approvalId);

    try {
      // Cast vote
      const { error } = await supabase
        .from('approval_votes')
        .insert({
          approval_id: approvalId,
          voter_id: user.id,
          vote_type: voteType
        });

      if (error) throw error;

      // Check vote counts and update approval status if needed
      const approval = approvals.find(a => a.id === approvalId);
      if (approval) {
        const newVotes = [...(approval.votes || []), { voter_id: user.id, vote_type: voteType }];
        const approveCount = newVotes.filter(v => v.vote_type === 'approve').length;
        const rejectCount = newVotes.filter(v => v.vote_type === 'reject').length;

        // Different thresholds for different approval types
        let shouldApprove = false;
        let shouldReject = false;

        if (approval.approval_type === 'task_reason' || approval.approval_type === 'task_deletion_reason') {
          // 2 approvals needed for task reason
          shouldApprove = approveCount >= 2;
          shouldReject = rejectCount >= 2;
          
          // If approved, restore task to working status
          if (shouldApprove && approval.target_task_id) {
            await supabase
              .from('tasks')
              .update({ status: 'working' })
              .eq('id', approval.target_task_id);
          }
        } else if (approval.approval_type === 'deletion_vote') {
          // Any 1 of 4 leadership can approve
          shouldApprove = approveCount >= 1;
        } else if (approval.approval_type === 'report_download') {
          // 3 of 4 leadership must download
          shouldApprove = approveCount >= 3;
        }

        if (shouldApprove) {
          await supabase
            .from('approvals')
            .update({ status: 'approved' })
            .eq('id', approvalId);
        } else if (shouldReject) {
          await supabase
            .from('approvals')
            .update({ status: 'rejected' })
            .eq('id', approvalId);
        }
      }

      toast({ title: 'Vote Recorded' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmitReason = async (taskId: string) => {
    if (!user || !reasons[taskId]) return;
    setProcessingId(taskId);

    try {
      // Create approval request for task reason
      const { error } = await supabase
        .from('approvals')
        .insert({
          approval_type: 'task_reason',
          target_task_id: taskId,
          target_user_id: user.id,
          initiated_by: user.id,
          reason: reasons[taskId],
          status: 'pending'
        });

      if (error) throw error;

      toast({ 
        title: 'Reason Submitted', 
        description: 'Waiting for approval from leadership (2 required)' 
      });
      setReasons({ ...reasons, [taskId]: '' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  // Resume task (moves from pending back to working)
  const handleResumeTask = async (taskId: string) => {
    if (!user) return;
    setProcessingId(taskId);

    try {
      // Update task status back to working
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'working' })
        .eq('id', taskId);

      if (error) throw error;

      // Create alert to notify leadership that deadline was missed but task resumed
      await supabase
        .from('task_alerts')
        .insert({
          task_id: taskId,
          message: 'Task resumed after deadline miss. User is now working on it.',
          created_by: user.id
        });

      toast({ 
        title: 'Task Resumed', 
        description: 'Leadership has been notified.' 
      });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleUploadDocs = async () => {
    if (!user || !docForm.taskId || !docForm.githubUrl) return;

    // Validate GitHub URL
    if (!docForm.githubUrl.includes('github.com')) {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid GitHub URL' });
      return;
    }

    setProcessingId(docForm.taskId);

    try {
      const { error } = await supabase
        .from('task_documents')
        .insert({
          task_id: docForm.taskId,
          user_id: user.id,
          github_url: docForm.githubUrl,
          description: docForm.description || null
        });

      if (error) throw error;

      toast({ title: 'Documentation Uploaded' });
      setDocForm({ taskId: '', githubUrl: '', description: '' });
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletionResponse = async (approvalId: string, approve: boolean) => {
    if (!user) return;
    setProcessingId(approvalId);

    const approval = approvals.find(a => a.id === approvalId);
    if (!approval) return;

    try {
      if (approve) {
        // User approved their own deletion
        await supabase
          .from('approvals')
          .update({ status: 'approved' })
          .eq('id', approvalId);

        toast({ title: 'Deletion Approved', description: 'Your profile will be deleted.' });
      } else {
        // User declined - escalate to team vote
        await supabase
          .from('approvals')
          .update({ status: 'rejected' })
          .eq('id', approvalId);

        // Create new approval for team vote
        await supabase
          .from('approvals')
          .insert({
            approval_type: 'deletion_vote',
            target_user_id: approval.target_user_id,
            initiated_by: approval.initiated_by,
            status: 'pending'
          });

        toast({ 
          title: 'Deletion Declined', 
          description: 'The request has been escalated to team leadership for review.' 
        });
      }
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setProcessingId(null);
    }
  };

  const userHasVoted = (approval: Approval) => {
    return approval.votes?.some(v => v.voter_id === user?.id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading alerts...
        </CardContent>
      </Card>
    );
  }

  // Filter approvals based on user role
  const relevantApprovals = approvals.filter(a => {
    // Deletion requests targeted at this user
    if (a.approval_type === 'deletion_request' && a.target_user_id === user?.id) return true;
    
    // Task deletion reasons targeted at this user (they need to provide reason)
    if (a.approval_type === 'task_deletion_reason' && a.target_user_id === user?.id && a.status === 'pending' && !a.reason) return true;
    
    // Leadership can see task reason requests, deletion votes, report downloads, task_deletion_reason
    if (isLeadership) {
      if (a.approval_type === 'task_reason') return true;
      if (a.approval_type === 'task_deletion_reason' && a.reason) return true;
      if (a.approval_type === 'deletion_vote') return true;
      if (a.approval_type === 'report_download') return true;
    }

    return false;
  });

  const totalAlerts = relevantApprovals.length + pendingTasks.length;

  return (
    <Card className={totalAlerts > 0 ? 'border-[hsl(var(--status-pending))]/50' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-[hsl(var(--status-pending))]">
          <AlertTriangle className="w-5 h-5" />
          Alerts
          {totalAlerts > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--status-pending))]/20">
              {totalAlerts}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pending Tasks requiring reason */}
        {pendingTasks.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Missed Deadlines - Provide Reason or Resume</h4>
            {pendingTasks.map(task => (
              <div key={task.id} className="p-4 rounded-lg border border-[hsl(var(--status-pending))]/30 bg-[hsl(var(--status-pending))]/5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-semibold">{task.title}</h5>
                    <p className="text-sm text-muted-foreground">
                      Deadline: {format(new Date(task.deadline), 'MMM dd, HH:mm')}
                    </p>
                  </div>
                  <span className="status-badge status-pending">Pending</span>
                </div>
                <Textarea
                  placeholder="Explain the delay (mandatory for approval)..."
                  value={reasons[task.id] || ''}
                  onChange={(e) => setReasons({ ...reasons, [task.id]: e.target.value })}
                  rows={2}
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => handleSubmitReason(task.id)}
                    disabled={!reasons[task.id] || processingId === task.id}
                  >
                    {processingId === task.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Submit Reason
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleResumeTask(task.id)}
                    disabled={processingId === task.id}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Resume Task
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload Docs for completed tasks */}
        {completedTasks.filter(t => !t.has_docs).length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Upload Documentation</h4>
            {completedTasks.filter(t => !t.has_docs).map(task => (
              <div key={task.id} className="p-4 rounded-lg border bg-muted/30">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-semibold">{task.title}</h5>
                    <p className="text-sm text-muted-foreground">
                      Completed: {format(new Date(task.completed_at), 'MMM dd, HH:mm')}
                    </p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setDocForm({ ...docForm, taskId: task.id })}>
                        <Upload className="w-4 h-4 mr-1" /> Upload Docs
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Documentation</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div>
                          <Label>GitHub URL *</Label>
                          <Input
                            placeholder="https://github.com/..."
                            value={docForm.githubUrl}
                            onChange={(e) => setDocForm({ ...docForm, githubUrl: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Description (optional)</Label>
                          <Textarea
                            placeholder="Brief description of the work..."
                            value={docForm.description}
                            onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <Button onClick={handleUploadDocs} className="w-full" disabled={!docForm.githubUrl}>
                          {processingId === task.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Upload
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approval requests */}
        {relevantApprovals.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Approval Requests</h4>
            {relevantApprovals.map(approval => (
              <div key={approval.id} className="p-4 rounded-lg border bg-card/50">
                {approval.approval_type === 'deletion_request' && approval.target_user_id === user?.id && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Trash2 className="w-4 h-4 text-destructive" />
                      <span className="font-semibold">Profile Deletion Request</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {approval.initiator_name} has requested to delete your profile.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeletionResponse(approval.id, true)}
                        disabled={processingId === approval.id}
                      >
                        Approve Deletion
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeletionResponse(approval.id, false)}
                        disabled={processingId === approval.id}
                      >
                        Decline
                      </Button>
                    </div>
                  </>
                )}

                {approval.approval_type === 'task_reason' && isLeadership && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="font-semibold">Task Delay Reason</span>
                    </div>
                    <p className="text-sm mb-1">
                      <span className="text-muted-foreground">Task:</span> {approval.task_title}
                    </p>
                    <p className="text-sm mb-1">
                      <span className="text-muted-foreground">From:</span> {approval.target_user_name}
                    </p>
                    <p className="text-sm p-2 rounded bg-muted mb-3">{approval.reason}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Approvals: {approval.votes?.filter(v => v.vote_type === 'approve').length || 0}/2 required
                    </p>
                    {!userHasVoted(approval) ? (
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          onClick={() => handleVote(approval.id, 'approve')}
                          disabled={processingId === approval.id}
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleVote(approval.id, 'reject')}
                          disabled={processingId === approval.id}
                        >
                          <X className="w-4 h-4 mr-1" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">You have already voted</p>
                    )}
                  </>
                )}

                {/* Task deletion reason - show to leadership for voting */}
                {approval.approval_type === 'task_deletion_reason' && isLeadership && approval.reason && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Trash2 className="w-4 h-4 text-destructive" />
                      <span className="font-semibold">Completed Task Removed - Reason</span>
                    </div>
                    <p className="text-sm mb-1">
                      <span className="text-muted-foreground">Task:</span> {approval.task_title}
                    </p>
                    <p className="text-sm mb-1">
                      <span className="text-muted-foreground">From:</span> {approval.target_user_name}
                    </p>
                    <p className="text-sm mb-1">
                      <span className="text-muted-foreground">Removed by:</span> {approval.initiator_name}
                    </p>
                    <p className="text-sm p-2 rounded bg-muted mb-3">{approval.reason}</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Approvals: {approval.votes?.filter(v => v.vote_type === 'approve').length || 0}/2 required
                    </p>
                    {!userHasVoted(approval) ? (
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          onClick={() => handleVote(approval.id, 'approve')}
                          disabled={processingId === approval.id}
                        >
                          <Check className="w-4 h-4 mr-1" /> Approve (Keep Task)
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleVote(approval.id, 'reject')}
                          disabled={processingId === approval.id}
                        >
                          <X className="w-4 h-4 mr-1" /> Reject (Remove from Log)
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">You have already voted</p>
                    )}
                  </>
                )}

                {approval.approval_type === 'deletion_vote' && isLeadership && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Trash2 className="w-4 h-4 text-destructive" />
                      <span className="font-semibold">Deletion Vote (Escalated)</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {approval.target_user_name} declined self-deletion. Any leadership approval will proceed.
                    </p>
                    {!userHasVoted(approval) ? (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleVote(approval.id, 'approve')}
                        disabled={processingId === approval.id}
                      >
                        Approve Deletion
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">You have already voted</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {totalAlerts === 0 && completedTasks.filter(t => !t.has_docs).length === 0 && (
          <p className="text-center text-muted-foreground py-4">No alerts - you're on track!</p>
        )}
      </CardContent>
    </Card>
  );
}
