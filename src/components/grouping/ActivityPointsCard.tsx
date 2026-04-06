import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Star, Save } from 'lucide-react';
import { useActivityPoints } from '@/hooks/useActivityPoints';

interface ActivityPointsCardProps {
  viewingUserId?: string;
  sessionId?: string;
  isReadOnly: boolean;
}

export function ActivityPointsCard({ viewingUserId, sessionId, isReadOnly }: ActivityPointsCardProps) {
  const { getUserActivityTotal, awardPoints, isLeadership } = useActivityPoints(sessionId);
  const [editing, setEditing] = useState(false);
  const [pointsToAdd, setPointsToAdd] = useState<number | ''>('');

  if (!viewingUserId || !sessionId) return null;

  const totalActivityPoints = getUserActivityTotal(viewingUserId);
  const [newTotal, setNewTotal] = useState<number>(totalActivityPoints);

  const handleSave = () => {
    if (newTotal === totalActivityPoints) {
      setEditing(false);
      return;
    }

    const delta = newTotal - totalActivityPoints;
    awardPoints.mutate({
      userId: viewingUserId,
      points: delta,
      reason: 'Balance Adjustment',
      sessionId
    }, {
      onSuccess: () => {
        setEditing(false);
      }
    });
  };

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Star className="w-4 h-4 text-amber-500" />
          Activity Points
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-amber-500">{totalActivityPoints}</span>
              <span className="text-xs text-muted-foreground">total pts</span>
            </div>
            <p className="text-xs text-muted-foreground">Earned via activities</p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Input
                    type="number"
                    min="0"
                    value={newTotal}
                    onChange={(e) => setNewTotal(parseInt(e.target.value) || 0)}
                    className="w-24 h-8 text-sm"
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSave} 
                    disabled={awardPoints.isPending} 
                    className="h-8 bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    {awardPoints.isPending ? '...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => { setEditing(true); setNewTotal(totalActivityPoints); }} 
                  className="h-8 border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                >
                  Set Points
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
