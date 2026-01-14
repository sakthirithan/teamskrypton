import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  UserX, 
  Check, 
  X, 
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Shield,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeletionApproval {
  id: string;
  approval_type: string;
  target_user_id: string | null;
  initiated_by: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  initiator_name?: string;
  target_name?: string;
  votes?: { voter_id: string; vote_type: string }[];
}

export function DeletionRequestsPanel() {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [myDeletionRequest, setMyDeletionRequest] = useState<DeletionApproval | null>(null);
  const [pendingVotes, setPendingVotes] = useState<DeletionApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'accept' | 'decline' | 'vote';
    approval: DeletionApproval;
    voteType?: 'approve' | 'reject';
  } | null>(null);

  const fetchDeletionRequests = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch deletion request targeting current user (for user to accept/decline)
      const { data: myRequest } = await supabase
        .from('approvals')
        .select('*')
        .eq('target_user_id', user.id)
        .eq('approval_type', 'deletion_request')
        .eq('status', 'pending')
        .single();

      if (myRequest) {
        // Get initiator name
        const { data: initiator } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', myRequest.initiated_by)
          .single();
        
        setMyDeletionRequest({
          ...myRequest,
          initiator_name: initiator?.full_name
        });
      } else {
        setMyDeletionRequest(null);
      }

      // If leadership, fetch pending votes (escalated requests where user declined)
      if (isLeadership) {
        const { data: voteRequests } = await supabase
          .from('approvals')
          .select('*')
          .eq('approval_type', 'deletion_vote')
          .eq('status', 'pending')
          .neq('target_user_id', user.id) // Can't vote on own deletion
          .neq('initiated_by', user.id); // Can't vote on requests you initiated

        if (voteRequests && voteRequests.length > 0) {
          // Fetch votes and profile info for each request
          const enrichedRequests = await Promise.all(
            voteRequests.map(async (req) => {
              const [targetProfile, initiatorProfile, votesData] = await Promise.all([
                supabase.from('profiles').select('full_name').eq('user_id', req.target_user_id).single(),
                supabase.from('profiles').select('full_name').eq('user_id', req.initiated_by).single(),
                supabase.from('approval_votes').select('voter_id, vote_type').eq('approval_id', req.id)
              ]);

              return {
                ...req,
                target_name: targetProfile.data?.full_name,
                initiator_name: initiatorProfile.data?.full_name,
                votes: votesData.data || []
              };
            })
          );

          // Filter out requests where current user already voted
          const notVotedRequests = enrichedRequests.filter(
            req => !req.votes?.some(v => v.voter_id === user.id)
          );

          setPendingVotes(notVotedRequests);
        } else {
          setPendingVotes([]);
        }
      }
    } catch (error) {
      console.error('Error fetching deletion requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLeadership]);

  useEffect(() => {
    fetchDeletionRequests();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('deletion-requests')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'approvals',
        filter: `approval_type=in.(deletion_request,deletion_vote)`
      }, () => {
        fetchDeletionRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDeletionRequests]);

  const handleAcceptDeletion = async () => {
    if (!myDeletionRequest) return;
    
    setProcessingId(myDeletionRequest.id);
    try {
      const { data, error } = await supabase.functions.invoke('handle-deletion-response', {
        body: { 
          approvalId: myDeletionRequest.id,
          action: 'accept'
        }
      });

      if (error || data?.error) throw error || new Error(data.error);

      toast({
        title: 'Account Deleted',
        description: 'Your account has been deleted. You will be logged out.'
      });
      
      // Sign out the user
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
      setProcessingId(null);
    }
  };

  const handleDeclineDeletion = async () => {
    if (!myDeletionRequest) return;
    
    setProcessingId(myDeletionRequest.id);
    try {
      const { data, error } = await supabase.functions.invoke('handle-deletion-response', {
        body: { 
          approvalId: myDeletionRequest.id,
          action: 'decline'
        }
      });

      if (error || data?.error) throw error || new Error(data.error);

      toast({
        title: 'Deletion Declined',
        description: 'The request has been escalated to leadership for voting.'
      });
      
      setMyDeletionRequest(null);
      setConfirmAction(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleVote = async (approval: DeletionApproval, voteType: 'approve' | 'reject') => {
    setProcessingId(approval.id);
    try {
      const { data, error } = await supabase.functions.invoke('handle-deletion-response', {
        body: { 
          approvalId: approval.id,
          action: 'vote',
          voteType
        }
      });

      if (error || data?.error) throw error || new Error(data.error);

      toast({
        title: data.deleted ? 'User Deleted' : 'Vote Recorded',
        description: data.message
      });
      
      setConfirmAction(null);
      fetchDeletionRequests();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Vote Failed',
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) return null;

  // Don't render if no requests to show
  if (!myDeletionRequest && pendingVotes.length === 0) return null;

  return (
    <>
      <div className="space-y-4">
        {/* User's own deletion request */}
        {myDeletionRequest && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-destructive text-lg">
                <AlertTriangle className="w-5 h-5" />
                Account Deletion Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-background border">
                <p className="text-sm">
                  <strong>{myDeletionRequest.initiator_name || 'Leadership'}</strong> has requested to delete your account.
                </p>
                {myDeletionRequest.reason && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Reason: {myDeletionRequest.reason}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(myDeletionRequest.created_at), 'MMM dd, yyyy HH:mm')}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <h4 className="font-medium mb-2">What happens next:</h4>
                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                  <li><strong>Accept:</strong> Your account will be permanently deleted immediately</li>
                  <li><strong>Decline:</strong> Request will be escalated to leadership for voting</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setConfirmAction({ type: 'decline', approval: myDeletionRequest })}
                  disabled={processingId === myDeletionRequest.id}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Decline
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setConfirmAction({ type: 'accept', approval: myDeletionRequest })}
                  disabled={processingId === myDeletionRequest.id}
                  className="flex-1"
                >
                  {processingId === myDeletionRequest.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Accept Deletion
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leadership voting on escalated requests */}
        {isLeadership && pendingVotes.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-lg">
                <Shield className="w-5 h-5" />
                Pending Deletion Votes
                <Badge variant="secondary">{pendingVotes.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingVotes.map((vote) => (
                <div key={vote.id} className="p-3 rounded-lg border bg-background">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <UserX className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{vote.target_name}</span>
                        <Badge variant="outline" className="text-xs">Declined</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested by: {vote.initiator_name}
                      </p>
                      {vote.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reason: {vote.reason}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(vote.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmAction({ type: 'vote', approval: vote, voteType: 'reject' })}
                        disabled={processingId === vote.id}
                        title="Reject Deletion"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmAction({ type: 'vote', approval: vote, voteType: 'approve' })}
                        disabled={processingId === vote.id}
                        title="Approve Deletion"
                      >
                        {processingId === vote.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ThumbsUp className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <AlertDialog open={confirmAction?.type === 'accept'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Confirm Account Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your account, tasks, logs, and all associated data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleAcceptDeletion}
            >
              Yes, Delete My Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction?.type === 'decline'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline Deletion Request?</AlertDialogTitle>
            <AlertDialogDescription>
              The deletion request will be escalated to all leadership members (Team Captain, Vice Captain, Strategist, Team Manager) for voting. If any one leader approves, your account will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeclineDeletion}>
              Decline & Escalate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction?.type === 'vote'} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.voteType === 'approve' ? 'Approve Deletion?' : 'Reject Deletion?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.voteType === 'approve' 
                ? `This will immediately delete ${confirmAction?.approval.target_name}'s account permanently.`
                : `Your rejection vote will be recorded. The user will not be deleted unless another leader approves.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.voteType === 'approve' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => confirmAction && handleVote(confirmAction.approval, confirmAction.voteType!)}
            >
              {confirmAction?.voteType === 'approve' ? 'Approve Deletion' : 'Reject Deletion'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
