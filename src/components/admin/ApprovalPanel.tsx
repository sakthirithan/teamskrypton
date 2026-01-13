import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { Check, X, UserPlus, Loader2, Mail, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface RegistrationRequest {
  id: string;
  full_name: string;
  email: string;
  department: string;
  requested_role: KryptonRole;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  password_hash: string;
}

export function ApprovalPanel() {
  const { toast } = useToast();

  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('registration_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Load Failed',
        description: error.message,
      });
    }

    setRequests((data || []) as RegistrationRequest[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const sendNotificationEmail = async (
    email: string,
    fullName: string,
    type: 'approved' | 'rejected',
    role?: string
  ) => {
    try {
      await supabase.functions.invoke('send-notification', {
        body: { to: email, type, fullName, role }
      });
    } catch (error) {
      console.error('Notification email failed:', error);
    }
  };

  const handleApprove = async (request: RegistrationRequest) => {
    if (processingId) return;
    setProcessingId(request.id);

    try {
      const { error } = await supabase.auth.signUp({
        email: request.email,
        password: request.password_hash,
        options: {
          data: {
            full_name: request.full_name,
            department: request.department,
            role: request.requested_role,
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      await supabase
        .from('registration_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      // non-blocking email
      sendNotificationEmail(
        request.email,
        request.full_name,
        'approved',
        ROLE_LABELS[request.requested_role]
      );

      toast({
        title: 'User Approved',
        description: `${request.full_name} has been granted access.`,
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Approval Failed',
        description: error.message || 'Failed to approve user',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: RegistrationRequest) => {
    if (processingId) return;
    setProcessingId(request.id);

    try {
      await supabase
        .from('registration_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      sendNotificationEmail(request.email, request.full_name, 'rejected');

      toast({
        title: 'Request Rejected',
        description: 'The registration request has been rejected.',
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reject request',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (request: RegistrationRequest) => {
    if (processingId) return;
    setProcessingId(request.id);

    try {
      await supabase
        .from('registration_requests')
        .delete()
        .eq('id', request.id);

      toast({
        title: 'Request Deleted',
        description: 'The pending registration has been removed.',
      });

      fetchRequests();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete request',
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading requests...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <UserPlus className="w-5 h-5" />
          Pending Approvals
          {requests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground">
              {requests.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No pending registration requests
          </p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="p-4 rounded-lg border bg-card/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <h4 className="font-semibold">{request.full_name}</h4>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {request.email}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {request.department}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {ROLE_LABELS[request.requested_role]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Requested: {format(new Date(request.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(request)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(request)}
                      disabled={processingId === request.id}
                      className="text-destructive"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleApprove(request)}
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}