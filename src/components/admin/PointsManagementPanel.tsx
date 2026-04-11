import { useState, useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { 
  Coins, 
  Plus, 
  Minus, 
  TrendingUp, 
  TrendingDown,
  History,
  Search,
  Award,
  AlertTriangle,
  User,
  RefreshCw
} from 'lucide-react';
import { useUserPoints, PointsOperation, PointsHistory } from '@/hooks/useUserPoints';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { format } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  department: string;
}

interface UserRole {
  user_id: string;
  role: KryptonRole;
}

const OPERATION_CONFIG: Record<PointsOperation, { label: string; icon: any; color: string }> = {
  add: { label: 'Add Points', icon: Plus, color: 'text-green-600' },
  subtract: { label: 'Subtract Points', icon: Minus, color: 'text-red-600' },
  set: { label: 'Set Points', icon: RefreshCw, color: 'text-blue-600' },
  bonus: { label: 'Bonus', icon: Award, color: 'text-amber-600' },
  penalty: { label: 'Penalty', icon: AlertTriangle, color: 'text-red-600' },
};

export const PointsManagementPanel = memo(function PointsManagementPanel() {
  const { 
    allPoints, 
    isLoadingPoints, 
    performOperation, 
    getUserHistory,
    pointsHistory 
  } = useUserPoints();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [operation, setOperation] = useState<PointsOperation>('add');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyUserId, setHistoryUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch all profiles and roles
  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ['all-profiles-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, department')
        .eq('is_test', false)
        .order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['all-roles-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return data as UserRole[];
    },
  });

  const roleMap = useMemo(() => new Map(roles.map(r => [r.user_id, r.role])), [roles]);
  const pointsMap = useMemo(() => new Map(allPoints.map(p => [p.user_id, p.points])), [allPoints]);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let filtered = profiles;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.full_name.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query) ||
        p.department.toLowerCase().includes(query)
      );
    }

    // Sort by points (desc), then by name
    return filtered.sort((a, b) => {
      const pointsA = pointsMap.get(a.user_id) || 0;
      const pointsB = pointsMap.get(b.user_id) || 0;
      if (pointsB !== pointsA) return pointsB - pointsA;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [profiles, searchQuery, pointsMap]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetchProfiles();
    setIsRefreshing(false);
  }, [refetchProfiles]);

  const handlePerformOperation = async () => {
    if (!selectedUser || !value) return;
    
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    await performOperation.mutateAsync({
      userId: selectedUser.user_id,
      operation,
      value: numValue,
      reason: reason || undefined,
    });

    // Reset form
    setValue('');
    setReason('');
    setSelectedUser(null);
  };

  const handleViewHistory = (userId: string) => {
    setHistoryUserId(userId);
    setShowHistoryDialog(true);
  };

  const userHistory = historyUserId ? getUserHistory(historyUserId) : [];
  const historyUser = profiles.find(p => p.user_id === historyUserId);

  return (
    <div className="space-y-4">
      {/* Header with Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
      </div>

      {/* Points Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="w-5 h-5 text-amber-500" />
            Golden Points
            <Badge variant="secondary" className="ml-2">
              {filteredUsers.length} members
            </Badge>
          </CardTitle>
          <CardDescription>Your Golden Time you through Golden Points</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Golden Points</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPoints ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((profile) => {
                    const points = pointsMap.get(profile.user_id) || 0;
                    const userRole = roleMap.get(profile.user_id);
                    
                    return (
                      <TableRow key={profile.user_id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{profile.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                                {profile.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {userRole ? (
                            <Badge variant="outline" className="text-xs">
                              {ROLE_LABELS[userRole]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{profile.department}</TableCell>
                        <TableCell className="text-center">
                          <span className={`font-bold text-lg ${points > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {points}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedUser(profile)}
                              className="h-8"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewHistory(profile.user_id)}
                              className="h-8"
                            >
                              <History className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Points Operation Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" />
              Manage Points
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.full_name} - Current: {pointsMap.get(selectedUser?.user_id || '') || 0} pts
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Operation Type */}
            <div className="space-y-2">
              <Label>Operation</Label>
              <Select value={operation} onValueChange={(v) => setOperation(v as PointsOperation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATION_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className={`w-4 h-4 ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label>Points Value</Label>
              <Input
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={operation === 'set' ? 'New total points' : 'Points to add/subtract'}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Outstanding performance, Late submission penalty..."
                rows={2}
              />
            </div>

            {/* Preview */}
            {value && selectedUser && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Preview:</p>
                <p className="font-medium">
                  {pointsMap.get(selectedUser.user_id) || 0} pts →{' '}
                  <span className={operation === 'subtract' || operation === 'penalty' ? 'text-red-600' : 'text-green-600'}>
                    {(() => {
                      const current = pointsMap.get(selectedUser.user_id) || 0;
                      const numValue = parseInt(value, 10) || 0;
                      switch (operation) {
                        case 'add':
                        case 'bonus':
                          return current + numValue;
                        case 'subtract':
                        case 'penalty':
                          return Math.max(0, current - numValue);
                        case 'set':
                          return Math.max(0, numValue);
                        default:
                          return current;
                      }
                    })()} pts
                  </span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handlePerformOperation}
                disabled={!value || performOperation.isPending}
              >
                {performOperation.isPending ? 'Updating...' : 'Apply'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Points History
            </DialogTitle>
            <DialogDescription>
              {historyUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[300px]">
            {userHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No history available
              </div>
            ) : (
              <div className="space-y-2">
                {userHistory.map((entry) => (
                  <div 
                    key={entry.id}
                    className="p-3 rounded-lg border bg-card text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {entry.points_change >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`font-medium ${entry.points_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {entry.points_change >= 0 ? '+' : ''}{entry.points_change}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {OPERATION_CONFIG[entry.operation_type as PointsOperation]?.label || entry.operation_type}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), 'MMM dd, HH:mm')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {entry.points_before} → {entry.points_after} pts
                    </div>
                    {entry.reason && (
                      <p className="mt-2 text-xs italic">{entry.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
});
