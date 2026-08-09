import { useState, useRef, useEffect } from 'react';
import { useMemberCommunities } from '@/hooks/useMemberCommunities';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  userId: string;
  canEdit?: boolean;
}

export function CommunitiesManager({ userId, canEdit = true }: Props) {
  const { communities, isLoading, addCommunity, removeCommunity } = useMemberCommunities(userId);
  const [addOpen, setAddOpen] = useState(false);
  const [communityName, setCommunityName] = useState('');

  // Scroll Container States
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  // Query member communities counts dynamically from database (entire table)
  const { data: allCommunities = [] } = useQuery({
    queryKey: ['all-member-communities-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_communities')
        .select('community_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const getCommunityMemberCount = (name: string) => {
    const target = name.trim().toLowerCase();
    const count = allCommunities.filter(c => c.community_name?.trim().toLowerCase() === target).length;
    return Math.max(1, count); // fallback to 1 as current user is in it
  };

  const handleAdd = () => {
    if (!communityName.trim()) return;
    addCommunity.mutate(communityName.trim(), {
      onSuccess: () => {
        setAddOpen(false);
        setCommunityName('');
      },
    });
  };

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftScroll(scrollLeft > 5);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [communities]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const isBelowMin = communities.length < 2;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold tracking-tight text-foreground">COMMUNITIES</h3>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold tabular-nums">
            {communities.length}
          </Badge>
        </div>

        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="h-7 text-xs gap-1 font-semibold hover:bg-muted">
            <Plus className="w-3.5 h-3.5 text-primary" />
            Add Community
          </Button>
        )}
      </div>

      {/* Horizontally Scrollable Communities Carousel */}
      {communities.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border/80 rounded-xl bg-muted/5 flex flex-col items-center justify-center">
          <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs font-semibold text-muted-foreground">No communities assigned yet</p>
          {canEdit && (
            <button
              onClick={() => setAddOpen(true)}
              className="text-xs text-primary font-semibold hover:underline mt-1.5"
            >
              Join your first community
            </button>
          )}
        </div>
      ) : (
        <div className="relative group/scroll w-full">
          {showLeftScroll && (
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 hover:bg-background border border-border/80 flex items-center justify-center shadow-xs hover:scale-105 transition-all opacity-0 group-hover/scroll:opacity-100 duration-200"
              type="button"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
          )}

          <div
            ref={scrollRef}
            className="w-full flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory py-1 px-0.5 scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {communities.map((c) => {
              const membersCount = getCommunityMemberCount(c.community_name);
              return (
                <div
                  key={c.id}
                  className="group relative flex flex-col justify-between p-3.5 w-[175px] h-[120px] shrink-0 rounded-2xl border border-border/70 bg-card hover:border-primary/30 shadow-xs hover:shadow-sm transition-all duration-200 snap-start"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border/60">
                      COMMUNITY
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => removeCommunity.mutate(c.community_name)}
                        className="text-muted-foreground hover:text-destructive transition-colors -mt-1 -mr-1 p-0.5 rounded-full hover:bg-muted"
                        title="Leave community"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="my-1.5 flex-1 flex flex-col justify-center">
                    <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors" title={c.community_name}>
                      {c.community_name}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-border/40 mt-auto text-[10px] text-muted-foreground font-semibold">
                    <span className="tabular-nums">{membersCount} Members</span>
                    <span className="text-success flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {showRightScroll && (
            <button
              onClick={() => handleScroll('right')}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 hover:bg-background border border-border/80 flex items-center justify-center shadow-xs hover:scale-105 transition-all opacity-0 group-hover/scroll:opacity-100 duration-200"
              type="button"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Min 2 Warning Badge if user has < 2 communities */}
      {isBelowMin && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Complete profile: Join at least 2 communities ({communities.length}/2 joined).</span>
        </div>
      )}

      {/* Add Community Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] max-w-sm rounded-2xl p-5 bg-card border-border">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-3 mb-4">
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Add Community
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Community Name
              </label>
              <Input
                placeholder="Enter community name..."
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                className="text-xs h-9 rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAdd();
                  }
                }}
                maxLength={80}
              />
            </div>

            <Button
              size="sm"
              disabled={!communityName.trim() || addCommunity.isPending}
              onClick={handleAdd}
              className="w-full text-xs h-9 rounded-xl font-bold uppercase tracking-wider mt-2"
            >
              {addCommunity.isPending ? 'Adding...' : 'Add Community'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
