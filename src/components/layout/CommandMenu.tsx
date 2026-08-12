import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';
import {
  Search,
  Users,
  MessageSquare,
  Calendar,
  Bell,
  User,
  PlusCircle,
  Home,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useRecentlyVisited } from '@/hooks/useRecentlyVisited';

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { recents, addRecent } = useRecentlyVisited();

  // Search members from DB
  const { data: members = [] } = useQuery({
    queryKey: ['command-menu-members', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, department, avatar_url')
        .or(VISIBLE_PROFILE_OR)
        .ilike('full_name', `%${search}%`)
        .limit(6);
      if (error) return [];
      return data || [];
    },
    enabled: search.trim().length > 0,
    staleTime: 30_000,
  });

  const handleSelect = (path: string, itemInfo?: { id: string; title: string; type: 'member' | 'chat' | 'activity' }) => {
    onOpenChange(false);
    setSearch('');
    if (itemInfo) {
      addRecent({ ...itemInfo, path });
    }
    navigate(path);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden max-w-xl border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl">
        <Command className="rounded-lg border-none">
          <div className="flex items-center border-b px-3 py-2 text-muted-foreground">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search members, chats..."
              className="flex h-10 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Command.List className="max-h-[340px] overflow-y-auto p-2 space-y-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No matching results found.
            </Command.Empty>

            {/* Recently Visited */}
            {recents.length > 0 && !search && (
              <Command.Group heading="Recently Visited" className="text-xs font-medium text-muted-foreground px-2 py-1">
                {recents.map((item) => (
                  <Command.Item
                    key={item.id}
                    onSelect={() => handleSelect(item.path)}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
                  >
                    <Clock className="h-4 w-4 text-primary/70" />
                    <span className="flex-1 truncate">{item.title}</span>
                    {item.subtitle && <span className="text-xs text-muted-foreground">{item.subtitle}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Dynamic Member Search Results */}
            {members.length > 0 && (
              <Command.Group heading="Members" className="text-xs font-medium text-muted-foreground px-2 py-1">
                {members.map((member) => (
                  <Command.Item
                    key={member.user_id}
                    onSelect={() =>
                      handleSelect(`/member/${member.user_id}`, {
                        id: member.user_id,
                        title: member.full_name,
                        subtitle: member.department,
                        type: 'member',
                      })
                    }
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
                  >
                    <User className="h-4 w-4 text-primary" />
                    <div className="flex flex-col flex-1 truncate">
                      <span className="font-medium">{member.full_name}</span>
                      <span className="text-xs text-muted-foreground">{member.department} • {member.email}</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation Shortcuts */}
            <Command.Group heading="Quick Navigation" className="text-xs font-medium text-muted-foreground px-2 py-1">
              <Command.Item
                onSelect={() => handleSelect('/grouping/home')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Home className="h-4 w-4 text-emerald-500" />
                <span>Home Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/team')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Users className="h-4 w-4 text-blue-500" />
                <span>Team Directory</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/grouping/calendar')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Calendar className="h-4 w-4 text-amber-500" />
                <span>My Calendar</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/grouping/me')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <User className="h-4 w-4 text-purple-500" />
                <span>My Space</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect('/notifications')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Bell className="h-4 w-4 text-rose-500" />
                <span>Notifications Center</span>
              </Command.Item>
            </Command.Group>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="text-xs font-medium text-muted-foreground px-2 py-1">
              <Command.Item
                onSelect={() => handleSelect('/grouping/incharge')}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <PlusCircle className="h-4 w-4 text-cyan-500" />
                <span>Create Activity / Incharge Schedule</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="border-t px-3 py-2 text-[11px] text-muted-foreground flex justify-between items-center bg-muted/30">
            <span>Use <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">↓</kbd> to navigate</span>
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">Ctrl+K</kbd> to toggle</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
