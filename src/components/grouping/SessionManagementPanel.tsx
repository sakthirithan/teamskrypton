import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Plus, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { format } from 'date-fns';
import { calculateSessionDays, calculateDaysRemaining } from '@/lib/groupingConstants';
import { useQueryClient } from '@tanstack/react-query';

export function SessionManagementPanel() {
  const { isCaptainOrVice } = useAuth();
  const queryClient = useQueryClient();
  const { 
    sessions, 
    activeSession, 
    createSession, 
    closeSession, 
    deleteSession,
    canDeleteSession 
  } = useGroupingSessions();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [sessionToClose, setSessionToClose] = useState<string | null>(null);
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['grouping-sessions'] });
    setIsRefreshing(false);
  }, [queryClient]);

  const handleCreate = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) return;
    
    await createSession.mutateAsync(formData);
    setFormData({
      name: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    });
    setIsCreateOpen(false);
  };

  const openCloseConfirmation = (sessionId: string) => {
    setSessionToClose(sessionId);
    setExportConfirmed(false);
    setIsCloseConfirmOpen(true);
  };

  const handleCloseSession = async () => {
    if (!sessionToClose || !exportConfirmed) return;
    
    await closeSession.mutateAsync(sessionToClose);
    setIsCloseConfirmOpen(false);
    setSessionToClose(null);
    setExportConfirmed(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('⚠️ PERMANENT DELETE\n\nThis will permanently delete the session and ALL related data:\n- All targets\n- All PS daily entries\n- All notes and replies\n\nThis action CANNOT be undone. Continue?')) {
      await deleteSession.mutateAsync(sessionId);
    }
  };

  if (!isCaptainOrVice) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4" />
            Sessions
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </span>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Session Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Q1 2026 Goals"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>

                {formData.start_date && formData.end_date && (
                  <p className="text-sm text-muted-foreground">
                    Duration: {calculateSessionDays(formData.start_date, formData.end_date)} days
                  </p>
                )}

                <Button 
                  onClick={handleCreate} 
                  className="w-full"
                  disabled={createSession.isPending || !formData.name}
                >
                  {createSession.isPending ? 'Creating...' : 'Create Session'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sessions yet. Create your first session.
          </p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {sessions.slice(0, 5).map((session) => (
              <div
                key={session.id}
                className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                  session.status === 'active' 
                    ? 'bg-primary/5 border border-primary/20' 
                    : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">#{session.session_number}</span>
                  <span className="text-muted-foreground">{session.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {session.status === 'active' ? (
                    <>
                      <Badge variant="default" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {calculateDaysRemaining(session.end_date)}d left
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs text-destructive"
                        onClick={() => openCloseConfirmation(session.id)}
                      >
                        Close
                      </Button>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Closed</Badge>
                  )}
                  {/* Delete button - TL, VC, TM only */}
                  {canDeleteSession && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteSession(session.id)}
                      title="Delete session permanently"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Close Session Confirmation Dialog */}
        <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Close Session?
              </DialogTitle>
              <DialogDescription>
                Closing a session makes all data read-only. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-4">
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                  Before closing, ensure you have:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Reviewed all pending PS entries</li>
                  <li>Verified target completion status</li>
                  <li>Exported team performance data</li>
                </ul>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="export-confirmed"
                  checked={exportConfirmed}
                  onCheckedChange={(checked) => setExportConfirmed(checked === true)}
                />
                <Label htmlFor="export-confirmed" className="text-sm cursor-pointer">
                  I have exported the team history data
                </Label>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCloseConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleCloseSession}
                disabled={!exportConfirmed || closeSession.isPending}
              >
                {closeSession.isPending ? 'Closing...' : 'Close Session'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
