import { useState } from 'react';
import { useMemberCommunities, PRESET_COMMUNITIES } from '@/hooks/useMemberCommunities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus, Trash2, Search, AlertCircle } from 'lucide-react';

interface Props {
  userId: string;
  canEdit?: boolean;
}

export function CommunitiesManager({ userId, canEdit = true }: Props) {
  const { communities, isLoading, addCommunity, removeCommunity } = useMemberCommunities(userId);
  const [addOpen, setAddOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customName, setCustomName] = useState('');

  const filteredPresets = PRESET_COMMUNITIES.filter((p) =>
    p.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = (name: string) => {
    addCommunity.mutate(name, {
      onSuccess: () => {
        setAddOpen(false);
        setSearchTerm('');
        setCustomName('');
      },
    });
  };

  const isBelowMin = communities.length < 2;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold tracking-tight">Communities</h3>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {communities.length}
          </Badge>
        </div>

        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="h-7 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" />
            Add
          </Button>
        )}
      </div>

      {/* Min 2 Warning Badge if user has < 2 communities */}
      {isBelowMin && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Add at least 2 communities to complete your community profile.</span>
        </div>
      )}

      {/* Community Chips / List */}
      {communities.length === 0 ? (
        <Card className="p-3 text-center border-dashed">
          <p className="text-xs text-muted-foreground">No communities assigned yet.</p>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {communities.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs font-semibold text-foreground shadow-xs group"
            >
              <span>{c.community_name}</span>
              {canEdit && (
                <button
                  onClick={() => removeCommunity.mutate(c.community_name)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  title="Remove community"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Community Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] max-w-md rounded-2xl p-4 sm:p-6 bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Users className="w-4 h-4 text-primary" />
              Add Community
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search community name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredPresets.map((name) => (
                <div
                  key={name}
                  onClick={() => handleAdd(name)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-primary/10 hover:border-primary/40 cursor-pointer transition-colors text-xs font-medium"
                >
                  <span>{name}</span>
                  <Plus className="w-4 h-4 text-primary" />
                </div>
              ))}
            </div>

            {/* Custom Community Input */}
            <div className="pt-2 border-t border-border flex gap-2">
              <Input
                placeholder="Custom community name..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="text-xs h-9"
              />
              <Button
                size="sm"
                disabled={!customName.trim()}
                onClick={() => handleAdd(customName)}
                className="text-xs h-9 shrink-0"
              >
                Add Custom
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
