import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FlaskConical, Plus, Trash2, User, Calendar, Shield } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { ROLE_LABELS } from '@/lib/constants';

type TestUserType = 'primary_test' | 'secondary_test';
type KryptonRole = 'team_captain' | 'vice_captain' | 'strategist' | 'team_manager' | 'team_member';

interface GuestUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  user_type: TestUserType;
  simulated_role: KryptonRole | null;
  expires_at: string | null;
  created_at: string;
}

const TEST_USER_TYPE_LABELS: Record<TestUserType, string> = {
  primary_test: '🧪 Primary Guest',
  secondary_test: '🧪 Secondary Guest',
};

export function GuestUserPanel() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    userType: 'primary_test' as TestUserType,
    assignedRole: 'team_member' as KryptonRole,
    expiryDays: 7,
  });

  // Only TL can access this panel
  const canManageGuests = role === 'team_captain';

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['guest-users'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch guest users
  const { data: guestUsers = [], isLoading } = useQuery({
    queryKey: ['guest-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, user_type, simulated_role, expires_at, created_at')
        .in('user_type', ['primary_test', 'secondary_test'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as GuestUser[];
    },
    enabled: !!user && canManageGuests,
  });

  // Create guest user mutation
  const createGuestUser = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate email format
      if (!data.email.endsWith('@test.com')) {
        throw new Error('Guest users must have @test.com email');
      }

      // Calculate expiry
      const expiresAt = data.userType === 'secondary_test' 
        ? addDays(new Date(), data.expiryDays).toISOString()
        : data.expiryDays > 0 
          ? addDays(new Date(), data.expiryDays).toISOString()
          : null;

      // Create auth user via edge function
      const { data: result, error } = await supabase.functions.invoke('create-test-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          userType: data.userType,
          assignedRole: data.assignedRole,
          expiresAt,
        },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-users'] });
      toast({ title: 'Guest User Created', description: 'Test user account has been created.' });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete guest user mutation
  const deleteGuestUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-test-user', {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-users'] });
      toast({ title: 'Guest User Deleted', description: 'Test user and all related data have been removed.' });
      setDeleteUserId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      fullName: '',
      userType: 'primary_test',
      assignedRole: 'team_member',
      expiryDays: 7,
    });
  };

  const handleCreate = () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      toast({ title: 'Missing Fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    createGuestUser.mutate(formData);
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (!canManageGuests) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <FlaskConical className="w-4 h-4" />
            Test Users
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </span>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="w-4 h-4 mr-1" />
                Create Test User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Test User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Test User Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email (@test.com required)</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="testuser@test.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Min 6 characters"
                  />
                </div>

                <div className="space-y-2">
                  <Label>User Type</Label>
                  <Select
                    value={formData.userType}
                    onValueChange={(v) => setFormData({ ...formData, userType: v as TestUserType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary_test">
                        🧪 Primary (Can switch roles)
                      </SelectItem>
                      <SelectItem value="secondary_test">
                        🧪 Secondary (Fixed role)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assigned Role</Label>
                  <Select
                    value={formData.assignedRole}
                    onValueChange={(v) => setFormData({ ...formData, assignedRole: v as KryptonRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Expiry (Days) {formData.userType === 'secondary_test' && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    type="number"
                    min={formData.userType === 'secondary_test' ? 1 : 0}
                    value={formData.expiryDays}
                    onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) || 0 })}
                    placeholder={formData.userType === 'secondary_test' ? 'Required' : '0 = No expiry'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.userType === 'secondary_test' 
                      ? 'Secondary test users must have an expiry date.'
                      : 'Set to 0 for no expiry (Primary only).'}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={createGuestUser.isPending}
                >
                  {createGuestUser.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : guestUsers.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No test users created yet.</p>
            <p className="text-sm">Create a test user to start role testing.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {guestUsers.map((guest) => (
                <div
                  key={guest.id}
                  className={`p-3 rounded-lg border ${
                    isExpired(guest.expires_at) 
                      ? 'bg-destructive/5 border-destructive/20' 
                      : 'bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{guest.full_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {TEST_USER_TYPE_LABELS[guest.user_type as TestUserType]}
                        </Badge>
                        {isExpired(guest.expires_at) && (
                          <Badge variant="destructive" className="text-xs">Expired</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{guest.email}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {guest.simulated_role 
                            ? ROLE_LABELS[guest.simulated_role as keyof typeof ROLE_LABELS] 
                            : 'No role set'}
                        </span>
                        {guest.expires_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Expires: {format(new Date(guest.expires_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <AlertDialog open={deleteUserId === guest.user_id} onOpenChange={(open) => !open && setDeleteUserId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive shrink-0"
                          onClick={() => setDeleteUserId(guest.user_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Test User?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete <strong>{guest.full_name}</strong> and all their test data.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteGuestUser.mutate(guest.user_id)}
                          >
                            {deleteGuestUser.isPending ? 'Deleting...' : 'Delete'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
