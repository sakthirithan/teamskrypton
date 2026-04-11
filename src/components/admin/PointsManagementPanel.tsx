import { useState, useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
  RefreshCw,
  CheckSquare
} from 'lucide-react';
import { useUserPoints, PointsOperation, PointsHistory } from '@/hooks/useUserPoints';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { format } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
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

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const allFilteredIds = filteredUsers.map(u => u.user_id);
    const areAllSelected = allFilteredIds.every(id => selectedUsers.has(id));
    
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (areAllSelected) {
        allFilteredIds.forEach(id => next.delete(id));
      } else {
        allFilteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handlePerformOperation = async () => {
    if (selectedUsers.size === 0 || !value) return;
    
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    const userIds = Array.from(selectedUsers);
    
    try {
      await Promise.all(userIds.map(userId => 
        performOperation.mutateAsync({
          userId,
          operation,
          value: numValue,
          reason: reason || undefined,
        })
      ));
      
      toast({ title: 'Success', description: `Points updated for ${userIds.length} members.` });
      // Reset form
      setValue('');
      setReason('');
      setSelectedUsers(new Set());
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Some point updates failed.' });
    }
  };

  const handleViewHistory = (userId: string) => {
    setHistoryUserId(userId);
    setShowHistoryDialog(true);
  };

  const userHistory = historyUserId ? getUserHistory(historyUserId) : [];
  const historyUser = profiles.find(p => p.user_id === historyUserId);

  const selectedCount = selectedUsers.size;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-140px)]">
      
      {/* LEFT COLUMN: MULTIPLE SELECTION & OPERATION */}
      <div className="flex flex-col gap-4 h-full">
        {/* Members List */}
        <Card className="flex flex-col flex-1 overflow-hidden border-muted">
          <CardHeader className="pb-3 border-b bg-muted/10">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                Select Members
                <Badge variant="secondary" className="ml-1">{selectedCount} selected</Badge>
              </span>
              <Button size="sm" variant="ghost" onClick={selectAllFiltered} className="h-7 text-xs">
                {selectedUsers.size > 0 && selectedUsers.size === filteredUsers.length ? 'Deselect All' : 'Select All'}
              </Button>
            </CardTitle>
            <div className="pt-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground mt-1" />
              <Input
                placeholder="Search to filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {filteredUsers.map(u => {
                const isSelected = selectedUsers.has(u.user_id);
                return (
                  <div 
                    key={u.user_id} 
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border max-h-[80px] ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-card border-transparent hover:bg-muted/50'}`}
                    onClick={() => toggleUserSelection(u.user_id)}
                  >
                    <Checkbox checked={isSelected} className="pointer-events-none" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.department}</p>
                    </div>
                    <div className="text-sm font-bold text-amber-600">
                      {pointsMap.get(u.user_id) || 0} pts
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Operation Form directly embedded */}
        <Card className="border-muted bg-muted/5">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              Manage Points ({selectedCount} members)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-1.5">
                 <Label className="text-xs">Operation</Label>
                 <Select value={operation} onValueChange={(v) => setOperation(v as PointsOperation)}>
                   <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                   <SelectContent>
                     {Object.entries(OPERATION_CONFIG).map(([key, config]) => (
                       <SelectItem key={key} value={key}>
                         <div className="flex items-center gap-2 text-xs">
                           <config.icon className={`w-3 h-3 ${config.color}`} />
                           {config.label}
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-1.5">
                 <Label className="text-xs">Value</Label>
                 <Input
                   type="number"
                   min="0"
                   className="h-8"
                   value={value}
                   onChange={(e) => setValue(e.target.value)}
                   placeholder={operation === 'set' ? 'Total' : 'Points'}
                 />
               </div>
             </div>
             
             <div className="space-y-1.5">
               <Label className="text-xs">Reason (optional)</Label>
               <Input
                 value={reason}
                 className="h-8"
                 onChange={(e) => setReason(e.target.value)}
                 placeholder="e.g., Outstanding performance..."
               />
             </div>

             <Button 
               className="w-full h-8" 
               onClick={handlePerformOperation}
               disabled={selectedCount === 0 || !value || performOperation.isPending}
             >
               {performOperation.isPending ? 'Updating...' : `Apply to ${selectedCount} members`}
             </Button>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: RANK & LEADERBOARD */}
      <Card className="flex flex-col h-full overflow-hidden">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Leaderboard & Ranks
            </CardTitle>
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 relative overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-12 text-center">Rank</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-right sr-only">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPoints ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((profile, idx) => {
                    const points = pointsMap.get(profile.user_id) || 0;
                    return (
                      <TableRow key={profile.user_id} className="group">
                        <TableCell className="text-center text-xs font-bold text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                             <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                               <User className="w-3.5 h-3.5 text-primary" />
                             </div>
                             <div className="min-w-0">
                               <p className="text-sm font-medium truncate">{profile.full_name}</p>
                               <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                 {profile.department}
                               </p>
                             </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={points > 0 ? 'default' : 'secondary'} className={points > 0 ? "bg-amber-500 hover:bg-amber-600" : ""}>
                            {points}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleViewHistory(profile.user_id)}
                            aria-label="View Points History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
              <div className="text-center py-8 text-muted-foreground text-sm">
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
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {OPERATION_CONFIG[entry.operation_type as PointsOperation]?.label || entry.operation_type}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
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
