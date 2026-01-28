import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, KryptonRole, STATUS_LABELS, TaskStatus } from '@/lib/constants';
import { validatePhoneNumber, formatPhoneDisplay } from '@/lib/phoneValidation';
import { format } from 'date-fns';
import {
  Users,
  Trash2,
  Loader2,
  Mail,
  Phone,
  Eye,
  Key,
  Search,
  AlertCircle,
  CheckCircle,
  X,
  Send,
  Zap,
  Shield,
  EyeOff,
  UserPlus,
  Check,
  FlaskConical
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { GuestUserPanel } from '@/components/admin/GuestUserPanel';

interface UserData {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department: string;
  phone_number: string | null;
  current_status: TaskStatus | null;
  role: KryptonRole | null;
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

interface UserListPanelProps {
  onClose?: () => void;
}

export function UserListPanel({ onClose }: UserListPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('members');

  // Registration requests state
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [dialogType, setDialogType] = useState<'delete' | 'password' | null>(null);
  
  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Delete state - enhanced for governance flow
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteMode, setDeleteMode] = useState<'request' | 'direct'>('request');

  // Phone edit state
  const [editingPhoneId, setEditingPhoneId] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('is_test', false),
        supabase.from('user_roles').select('user_id, role')
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleMap = new Map(
        (rolesRes.data || []).map(r => [r.user_id, r.role as KryptonRole])
      );

      const userData: UserData[] = (profilesRes.data || []).map(p => ({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        department: p.department,
        phone_number: p.phone_number,
        current_status: p.current_status as TaskStatus | null,
        role: roleMap.get(p.user_id) || null
      }));

      setUsers(userData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Load Failed',
        description: 'Unable to fetch users'
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch registration requests
  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from('registration_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setRequests((data || []) as RegistrationRequest[]);
    } catch (error) {
      console.error('Failed to fetch registration requests:', error);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRequests();

    // Real-time subscription for registration requests
    const channel = supabase
      .channel('registration-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registration_requests',
        },
        (payload) => {
          console.log('Registration request change:', payload.eventType);
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers, fetchRequests]);

  // Registration approval handlers
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

  const handleApproveRequest = async (request: RegistrationRequest) => {
    if (processingId) return;
    setProcessingId(request.id);

    try {
      // Call Edge Function for idempotent, atomic approval
      const { data, error } = await supabase.functions.invoke('approve-registration', {
        body: { requestId: request.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Non-blocking email notification
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
      fetchUsers();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve user';
      toast({
        variant: 'destructive',
        title: 'Approval Failed',
        description: errorMessage,
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (request: RegistrationRequest) => {
    if (processingId) return;
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

  const handleDeleteRequest = async (request: RegistrationRequest) => {
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

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewProfile = (userId: string) => {
    onClose?.();
    navigate(`/member/${userId}`);
  };

  // Password validation
  const getPasswordStrength = (password: string) => {
    if (password.length < 6) return { level: 'weak', color: 'text-red-500', message: 'Too short (min 6 chars)' };
    if (password.length < 8) return { level: 'fair', color: 'text-amber-500', message: 'Fair' };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { level: 'strong', color: 'text-green-500', message: 'Strong' };
    }
    return { level: 'good', color: 'text-blue-500', message: 'Good' };
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password must be at least 6 characters' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }

    setProcessingId(selectedUser.id);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { targetUserId: selectedUser.user_id, newPassword }
      });

      if (error || data?.error) throw error || new Error(data.error);

      toast({
        title: 'Password Updated by Leadership',
        description: `Password changed for ${selectedUser.full_name}. They must log in with the new password.`
      });
      
      setDialogType(null);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Standard deletion request flow - user gets notified to accept/decline
  const handleSendDeletionRequest = async () => {
    if (!selectedUser) return;

    setProcessingId(selectedUser.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { 
          targetUserId: selectedUser.user_id,
          description: deleteReason,
          immediate: false
        }
      });

      if (error || data?.error) throw error || new Error(data.error);

      toast({
        title: 'Deletion Request Sent',
        description: `${selectedUser.full_name} has been notified and can accept or decline.`
      });
      
      setDialogType(null);
      setSelectedUser(null);
      setDeleteReason('');
      setDeleteMode('request');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Request Failed',
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Direct deletion with special permission - bypasses voting
  const handleDirectDelete = async () => {
    if (!selectedUser || !deleteReason.trim()) {
      toast({ variant: 'destructive', title: 'Reason is required for direct deletion' });
      return;
    }

    setProcessingId(selectedUser.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { 
          targetUserId: selectedUser.user_id,
          description: deleteReason,
          immediate: true
        }
      });

      if (error || data?.error) throw error || new Error(data.error);

      toast({
        title: 'User Deleted',
        description: `${selectedUser.full_name} has been permanently removed. All team members have been notified.`
      });
      
      setDialogType(null);
      setSelectedUser(null);
      setDeleteReason('');
      setDeleteMode('request');
      fetchUsers();
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

  const handleUpdatePhone = async (userId: string, profileId: string) => {
    const validation = validatePhoneNumber(phoneValue);
    
    if (!validation.isValid) {
      toast({ variant: 'destructive', title: validation.error || 'Invalid phone number' });
      return;
    }

    setProcessingId(profileId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone_number: validation.formatted || null })
        .eq('user_id', userId);

      if (error) throw error;

      toast({ title: 'Phone Updated', description: 'Phone number has been updated successfully' });
      setEditingPhoneId(null);
      setPhoneValue('');
      fetchUsers();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: TaskStatus | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    const statusClass = {
      idle: 'status-idle',
      working: 'status-working',
      completed: 'status-completed',
      pending: 'status-pending'
    }[status];

    return (
      <Badge className={`status-badge ${statusClass}`}>
        {STATUS_LABELS[status]}
      </Badge>
    );
  };

  const passwordStrength = getPasswordStrength(newPassword);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent className="p-6 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading users...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3 px-0 pt-0">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members
                <Badge variant="secondary" className="ml-1 text-xs">{users.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="approvals" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Approvals
                {requests.length > 0 && (
                  <Badge variant="destructive" className="ml-1 text-xs">{requests.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="test-users" className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4" />
                Test Users
              </TabsTrigger>
            </TabsList>

            {/* Team Members Tab */}
            <TabsContent value="members" className="space-y-4 mt-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or department..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* User List */}
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-2">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No users found</p>
                  ) : (
                    filteredUsers.map(u => (
                      <div key={u.id} className="p-3 rounded-lg border bg-card/50 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold">{u.full_name}</h4>
                              {u.role && (
                                <span className={`role-badge text-[10px] px-2 py-0.5 ${
                                  u.role === 'team_captain' ? 'role-captain' :
                                  u.role === 'vice_captain' ? 'role-vice-captain' :
                                  u.role === 'strategist' ? 'role-strategist' :
                                  u.role === 'team_manager' ? 'role-manager' : 'role-member'
                                }`}>
                                  {ROLE_LABELS[u.role]}
                                </span>
                              )}
                              {getStatusBadge(u.current_status)}
                            </div>
                            
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              <p className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {u.email}
                              </p>
                              
                              {/* Phone - Editable */}
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {editingPhoneId === u.id ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={phoneValue}
                                      onChange={(e) => setPhoneValue(e.target.value)}
                                      placeholder="+91 XXXXX XXXXX"
                                      className="h-6 w-32 text-xs px-2"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleUpdatePhone(u.user_id, u.id)}
                                      disabled={processingId === u.id}
                                    >
                                      <CheckCircle className="w-3 h-3 text-green-600" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        setEditingPhoneId(null);
                                        setPhoneValue('');
                                      }}
                                    >
                                      <X className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingPhoneId(u.id);
                                      setPhoneValue(u.phone_number || '');
                                    }}
                                    className="hover:text-foreground transition-colors"
                                  >
                                    {formatPhoneDisplay(u.phone_number)}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewProfile(u.user_id)}
                              title="View Dashboard"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedUser(u);
                                setDialogType('password');
                              }}
                              disabled={u.user_id === user?.id}
                              title="Reset Password"
                            >
                              <Key className="w-4 h-4" />
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedUser(u);
                                setDialogType('delete');
                              }}
                              disabled={u.user_id === user?.id}
                              className="hover:text-destructive"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Pending Approvals Tab */}
            <TabsContent value="approvals" className="mt-4">
              {requestsLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading requests...
                </div>
              ) : requests.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No pending registration requests</p>
                  <p className="text-xs text-muted-foreground mt-1">New registration requests will appear here</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-2">
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
                              onClick={() => handleDeleteRequest(request)}
                              disabled={processingId === request.id}
                              title="Delete Request"
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
                              onClick={() => handleRejectRequest(request)}
                              disabled={processingId === request.id}
                              className="text-destructive hover:text-destructive"
                              title="Reject"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </Button>

                            <Button
                              size="sm"
                              onClick={() => handleApproveRequest(request)}
                              disabled={processingId === request.id}
                              title="Approve"
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
                </ScrollArea>
              )}
            </TabsContent>

            {/* Test Users Tab - TL Only */}
            <TabsContent value="test-users" className="mt-4">
              <GuestUserPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={dialogType === 'password'} onOpenChange={(open) => {
        if (!open) {
          setDialogType(null);
          setSelectedUser(null);
          setNewPassword('');
          setConfirmPassword('');
          setShowPassword(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.full_name}. Existing sessions will be invalidated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg border bg-muted/50">
              <p className="font-medium">{selectedUser?.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
            </div>
            
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {newPassword && (
                <p className={`text-xs ${passwordStrength.color}`}>
                  Strength: {passwordStrength.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm">
              <p className="text-amber-700 dark:text-amber-400">
                ⚠️ Password updated by Leadership - The user will need to log in with this new password.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogType(null);
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6 || newPassword !== confirmPassword || processingId === selectedUser?.id}
                className="flex-1"
              >
                {processingId === selectedUser?.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Reset Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog - Enhanced with governance flow */}
      <Dialog open={dialogType === 'delete'} onOpenChange={(open) => {
        if (!open) {
          setDialogType(null);
          setSelectedUser(null);
          setDeleteReason('');
          setDeleteMode('request');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              Choose how to remove this user from the team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/30">
              <p className="font-medium">{selectedUser?.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              {selectedUser?.role && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-primary/10 text-primary font-medium">
                  {ROLE_LABELS[selectedUser.role]}
                </span>
              )}
            </div>

            {/* Deletion Mode Selection */}
            <div className="space-y-2">
              <Label>Deletion Method</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={deleteMode === 'request' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDeleteMode('request')}
                  className="flex-col h-auto py-3"
                >
                  <Send className="w-4 h-4 mb-1" />
                  <span className="text-xs font-medium">Send Request</span>
                  <span className="text-[10px] opacity-70">User can accept/decline</span>
                </Button>
                <Button
                  type="button"
                  variant={deleteMode === 'direct' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setDeleteMode('direct')}
                  className="flex-col h-auto py-3"
                >
                  <Zap className="w-4 h-4 mb-1" />
                  <span className="text-xs font-medium">Direct Delete</span>
                  <span className="text-[10px] opacity-70">Special permission</span>
                </Button>
              </div>
            </div>

            {deleteMode === 'request' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border bg-muted/50 text-sm">
                  <h4 className="font-medium mb-2">Standard Deletion Flow:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
                    <li>User receives deletion request notification</li>
                    <li>User can <strong>Accept</strong> (immediate deletion) or <strong>Decline</strong></li>
                    <li>If declined → Escalated to leadership voting</li>
                    <li>Any one leader approval → User deleted</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <Label>Reason (Optional)</Label>
                  <Textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Enter reason for deletion request..."
                    className="h-20"
                  />
                </div>
                <Button
                  onClick={handleSendDeletionRequest}
                  disabled={processingId === selectedUser?.id}
                  className="w-full"
                >
                  {processingId === selectedUser?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Deletion Request
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-destructive" />
                    <h4 className="font-medium text-destructive">Special Permission</h4>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                    <li>Bypasses user acceptance and voting</li>
                    <li>Immediate permanent deletion</li>
                    <li>All team members will be notified</li>
                    <li>Action logged for audit</li>
                    <li>Notification auto-removes after 24 hours</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label className="text-destructive">Reason (Required)</Label>
                  <Textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Describe why direct deletion is necessary..."
                    className="h-20 border-destructive/50"
                    required
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDirectDelete}
                  disabled={!deleteReason.trim() || processingId === selectedUser?.id}
                  className="w-full"
                >
                  {processingId === selectedUser?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Delete Immediately
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
