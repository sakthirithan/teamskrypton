import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { GroupingTarget } from '@/hooks/useGroupingTargets';

interface BalancePointsCardProps {
  target?: GroupingTarget;
  viewingUserId?: string;
  achievedPoints: number;
  isReadOnly: boolean;
}

export function BalancePointsCard({ target, viewingUserId, achievedPoints, isReadOnly }: BalancePointsCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const balancePoints = (target as any)?.balance_points || 0;
  const [editing, setEditing] = useState(false);
  const [newBalance, setNewBalance] = useState(balancePoints);
  const [saving, setSaving] = useState(false);

  const totalPoints = balancePoints + (balancePoints > 0 ? achievedPoints : 0);

  const handleSave = async () => {
    if (!target?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('grouping_targets')
        .update({ balance_points: newBalance } as any)
        .eq('id', target.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      queryClient.invalidateQueries({ queryKey: ['viewed-individual-target'] });
      toast({ title: 'Balance updated', description: `New total: ${newBalance + achievedPoints} pts` });
      setEditing(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!target) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wallet className="w-4 h-4 text-primary" />
          Balance Points
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-primary">{totalPoints}</span>
              <span className="text-xs text-muted-foreground">total pts</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Balance: {balancePoints} + Earned: {balancePoints > 0 ? achievedPoints : 0}
            </p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Input
                    type="number"
                    min="0"
                    value={newBalance}
                    onChange={(e) => setNewBalance(parseInt(e.target.value) || 0)}
                    className="w-24 h-8 text-sm"
                  />
                  <Button size="sm" onClick={handleSave} disabled={saving} className="h-8">
                    <Save className="w-3 h-3 mr-1" />
                    {saving ? '...' : 'Save'}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => { setEditing(true); setNewBalance(balancePoints); }} className="h-8">
                  Set Balance
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
