import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Lightbulb, AlertTriangle, ArrowRight, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface ReflectionWithUser {
  id: string;
  skill_track_id: string;
  user_id: string;
  week_start: string;
  content: string;
  challenges: string | null;
  next_steps: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  skill_name: string;
}

export function AllReflectionsPanel() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<ReflectionWithUser | null>(null);

  const { data: reflections = [], isLoading } = useQuery({
    queryKey: ['all-skill-reflections'],
    queryFn: async () => {
      // Fetch all reflections
      const { data: refs, error } = await supabase
        .from('skill_reflections')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profiles and skill tracks for names
      const userIds = [...new Set((refs || []).map((r: any) => r.user_id))];
      const trackIds = [...new Set((refs || []).map((r: any) => r.skill_track_id))];

      const [profilesRes, tracksRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
          : { data: [], error: null },
        trackIds.length > 0
          ? supabase.from('skill_tracks').select('id, skill_name').in('id', trackIds)
          : { data: [], error: null },
      ]);

      const profileMap = new Map(
        (profilesRes.data || []).map((p: any) => [p.user_id, p.full_name])
      );
      const trackMap = new Map(
        (tracksRes.data || []).map((t: any) => [t.id, t.skill_name])
      );

      return (refs || []).map((r: any) => ({
        ...r,
        user_name: profileMap.get(r.user_id) || 'Unknown',
        skill_name: trackMap.get(r.skill_track_id) || 'Unknown Skill',
      })) as ReflectionWithUser[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (reflections.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No reflections yet</p>
          <p className="text-xs mt-1">Members can add weekly reflections from My Space.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ScrollArea className="max-h-[600px]">
        <div className="space-y-2 pr-1">
          {reflections.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer border-muted hover:border-primary/30 hover:bg-accent/5 transition-colors"
              onClick={() => setSelected(r)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.user_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.skill_name}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    <Calendar className="w-2.5 h-2.5 mr-1" />
                    {format(new Date(r.week_start), 'MMM dd')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-primary" />
              Weekly Reflection
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selected.user_name}</p>
                    <p className="text-xs text-muted-foreground">{selected.skill_name}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  Week of {format(new Date(selected.week_start), 'MMM dd, yyyy')}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs font-medium flex items-center gap-1 mb-1 text-primary">
                    <Lightbulb className="w-3 h-3" /> What they learned
                  </p>
                  <p className="text-sm">{selected.content}</p>
                </div>

                {selected.challenges && (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                    <p className="text-xs font-medium flex items-center gap-1 mb-1 text-amber-600">
                      <AlertTriangle className="w-3 h-3" /> Challenges
                    </p>
                    <p className="text-sm">{selected.challenges}</p>
                  </div>
                )}

                {selected.next_steps && (
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
                    <p className="text-xs font-medium flex items-center gap-1 mb-1 text-blue-600">
                      <ArrowRight className="w-3 h-3" /> Next Steps
                    </p>
                    <p className="text-sm">{selected.next_steps}</p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground text-right">
                Posted {format(new Date(selected.created_at), 'MMM dd, yyyy · h:mm a')}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
