import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, X, Edit2, Check, Clock } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { calculateSessionDays, calculateDaysRemaining } from '@/lib/groupingConstants';

export function SessionManagementPanel() {
  const { isCaptainOrVice } = useAuth();
  const { sessions, activeSession, createSession, updateSession, closeSession } = useGroupingSessions();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  });

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

  const handleCloseSession = async (sessionId: string) => {
    if (confirm('Are you sure you want to close this session? This cannot be undone.')) {
      await closeSession.mutateAsync(sessionId);
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
                        onClick={() => handleCloseSession(session.id)}
                      >
                        Close
                      </Button>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Closed</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
