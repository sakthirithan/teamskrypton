import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import {
  Users,
  Trash2,
  Loader2,
  Mail,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from '@/components/ui/dialog';

interface RegisteredUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  role: KryptonRole | null;
  created_at: string;
  status: 'approved';
}

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

export function UserManagementPanel() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RegistrationRequest[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<RegistrationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<RegisteredUser | null>(null);

  const isBusy = Boolean(processingId);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_test', false);

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      if (profiles && roles) {
        const roleMap = new Map(
          roles.map(r => [r.user_id, r.role as KryptonRole])
        );

        setUsers(
          profiles.map(p => ({
            id: p.id,
            user_id: p.user_id,
            full_name: p.full_name,
            email: p.email,
            department: p.department,
            role: roleMap.get(p.user_id) || null,
            created_at: p.created_at,
            status: 'approved'
          }))
        );
      }

      const { data: pending } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      setPendingRequests((pending || []) as RegistrationRequest[]);

      const { data: rejected } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('status', 'rejected')
        .order('created_at', { ascending: false });

      setRejectedRequests((rejected || []) as RegistrationRequest[]);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Load Failed',
        description: 'Unable to fetch user data'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    mounted && fetchData();
    return () => {
      mounted = false;
    };
  }, []);

  const sendNotificationEmail = async (
    email: string,
    fullName: string,
    type: 'approved' | 'rejected' | 'deletion_request',
    role?: string
  ) => {
    try {
      await supabase.functions.invoke('send-notification', {
        body: { to: email, type, fullName, role }
      });
    } catch (err) {
      console.error('Email failed:', err);
    }
  };

  const handleApprove = async (request: RegistrationRequest) => {
    setProcessingId(request.id);
    try {
      if (request.password_hash.length > 72) {
        throw new Error('Invalid password format');
      }

      const { error } = await supabase.auth.signUp({
        email: request.email,
        password: request.password_hash,
        options: {
          data: {
            full_name: request.full_name,
            department: request.department,
            role: request.requested_role
          },
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      await supabase
        .from('registration_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', request.id);

      sendNotificationEmail(
        request.email,
        request.full_name,
        'approved',
        ROLE_LABELS[request.requested_role]
      );

      toast({
        title: 'User Approved',
        description: `${request.full_name} has been granted access`
      });

      await new Promise(r => setTimeout(r, 800));
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Approval Failed',
        description: error.message || 'Unable to approve user'
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: RegistrationRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('registration_requests')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', request.id);

      sendNotificationEmail(request.email, request.full_name, 'rejected');

      toast({
        title: 'Request Rejected'
      });

      fetchData();
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

  const handleDeleteRequest = async (request: RegistrationRequest) => {
    setProcessingId(request.id);
    try {
      await supabase
        .from('registration_requests')
        .delete()
        .eq('id', request.id);

      toast({ title: 'Request Deleted' });
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleImmediateDelete = async (targetUser: RegisteredUser) => {
    if (
      targetUser.user_id === user?.id ||
      targetUser.id === profile?.id
    ) {
      toast({
        variant: 'destructive',
        title: 'Cannot Delete',
        description: 'You cannot delete your own account'
      });
      return;
    }

    setProcessingId(targetUser.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { targetUserId: targetUser.user_id }
      });

      if (error || data?.error) throw error || new Error(data.error);

      toast({
        title: 'User Deleted',
        description: `${targetUser.full_name} permanently removed`
      });

      setDeleteConfirmUser(null);
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (
    status: 'approved' | 'pending' | 'rejected'
  ) => {
    const map = {
      approved: 'bg-green-500/20 text-green-600',
      pending: 'bg-amber-500/20 text-amber-600',
      rejected: 'bg-red-500/20 text-red-600'
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${map[status]}`}>
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading users...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Users className="w-5 h-5" />
          User Management
          {pendingRequests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-600">
              {pendingRequests.length} pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="approved" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="approved">
              Approved ({users.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejectedRequests.length})
            </TabsTrigger>
          </TabsList>

          {/* Approved Users */}
          <TabsContent value="approved" className="space-y-3 max-h-96 overflow-y-auto">
            {users.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No approved users</p>
            ) : (
              users.map((u) => (
                <div key={u.id} className="p-3 rounded-lg border bg-card/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate">{u.full_name}</h4>
                        {getStatusBadge('approved')}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {u.role && (
                          <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary font-medium">
                            {ROLE_LABELS[u.role]}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {u.department}
                        </span>
                      </div>
                    </div>
                    
                    {/* Delete Button with Confirmation Dialog */}
                    <Dialog open={deleteConfirmUser?.id === u.id} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirmUser(u)}
                          disabled={processingId === u.id || u.user_id === user?.id}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete User Immediately"
                        >
                          {processingId === u.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-5 h-5" />
                            Immediate User Deletion
                          </DialogTitle>
                          <DialogDescription>
                            This action is <strong>immediate and irreversible</strong>. The user will be:
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="p-3 rounded-lg border bg-muted/50">
                            <p className="font-semibold">{u.full_name}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                            {u.role && (
                              <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-primary/10 text-primary font-medium">
                                {ROLE_LABELS[u.role]}
                              </span>
                            )}
                          </div>
                          
                          <ul className="text-sm space-y-2 text-muted-foreground">
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-destructive mt-0.5" />
                              <span>Removed from authentication system</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-destructive mt-0.5" />
                              <span>Profile deleted permanently</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-destructive mt-0.5" />
                              <span>All tasks removed</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-destructive mt-0.5" />
                              <span>All logs and history deleted</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-destructive mt-0.5" />
                              <span>Cannot re-login or recover account</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <X className="w-4 h-4 text-destructive mt-0.5" />
                              <span>User treated as if never existed</span>
                            </li>
                          </ul>
                          
                          <div className="flex gap-2 pt-2">
                            <Button 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => setDeleteConfirmUser(null)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              variant="destructive" 
                              className="flex-1"
                              onClick={() => handleImmediateDelete(u)}
                              disabled={processingId === u.id}
                            >
                              {processingId === u.id ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                              ) : null}
                              Delete Permanently
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Pending Requests */}
          <TabsContent value="pending" className="space-y-3 max-h-96 overflow-y-auto">
            {pendingRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No pending requests</p>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="p-3 rounded-lg border bg-card/50 border-amber-500/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate">{request.full_name}</h4>
                        {getStatusBadge('pending')}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{request.email}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 text-xs rounded bg-primary/10 text-primary font-medium">
                          {ROLE_LABELS[request.requested_role]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {request.department}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested: {format(new Date(request.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteRequest(request)}
                        disabled={processingId === request.id}
                        className="text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        {processingId === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(request)}
                        disabled={processingId === request.id}
                        className="text-destructive hover:text-destructive"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(request)}
                        disabled={processingId === request.id}
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Rejected Requests */}
          <TabsContent value="rejected" className="space-y-3 max-h-96 overflow-y-auto">
            {rejectedRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No rejected requests</p>
            ) : (
              rejectedRequests.map((request) => (
                <div key={request.id} className="p-3 rounded-lg border bg-card/50 border-red-500/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold truncate">{request.full_name}</h4>
                        {getStatusBadge('rejected')}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{request.email}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                          {ROLE_LABELS[request.requested_role]}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteRequest(request)}
                      disabled={processingId === request.id}
                      className="text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
