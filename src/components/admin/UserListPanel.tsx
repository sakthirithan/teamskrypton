import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, KryptonRole, STATUS_LABELS, TaskStatus } from '@/lib/constants';
import { validatePhoneNumber, formatPhoneDisplay } from '@/lib/phoneValidation';
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
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

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

export function UserListPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [dialogType, setDialogType] = useState<'delete' | 'password' | null>(null);
  
  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Delete state
  const [deleteReason, setDeleteReason] = useState('');

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewProfile = (userId: string) => {
    navigate(`/member/${userId}`);
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
        title: 'Password Reset',
        description: `Password changed for ${selectedUser.full_name}. They must log in with the new password.`
      });
      
      setDialogType(null);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
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

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

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
        description: `${selectedUser.full_name} has been permanently removed`
      });
      
      setDialogType(null);
      setSelectedUser(null);
      setDeleteReason('');
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Loading users...
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display">
            <Users className="w-5 h-5" />
            User Management
            <Badge variant="secondary" className="ml-2">{users.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* User List */}
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
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
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={dialogType === 'password'} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.full_name}. They will need to use this password to log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg border bg-muted/50">
              <p className="font-medium">{selectedUser?.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
            </div>
            
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            
            <Button
              onClick={handleResetPassword}
              disabled={!newPassword || newPassword !== confirmPassword || processingId === selectedUser?.id}
              className="w-full"
            >
              {processingId === selectedUser?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={dialogType === 'delete'} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action is irreversible. All data associated with this user will be permanently deleted.
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
            
            <div className="space-y-2">
              <Label>Reason for Deletion (Optional)</Label>
              <Input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Enter reason..."
              />
            </div>
            
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={processingId === selectedUser?.id}
              className="w-full"
            >
              {processingId === selectedUser?.id ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Permanently Delete User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
