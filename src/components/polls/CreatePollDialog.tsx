import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { usePolls, PollMode } from '@/hooks/usePolls';

interface Props {
  mode: PollMode;
  trigger?: React.ReactNode;
}

export function CreatePollDialog({ mode, trigger }: Props) {
  const { user, profile } = useAuth();
  const { createPoll } = usePolls(mode);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [multi, setMulti] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [deadline, setDeadline] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);

  const { data: members = [] } = useQuery({
    queryKey: ['poll-members'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      return (data || []).filter((m: any) => m.user_id !== user?.id);
    },
    enabled: open,
  });

  useEffect(() => {
    if (selectAll) setSelected(new Set(members.map((m: any) => m.user_id)));
  }, [selectAll, members]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
    setSelectAll(false);
  };

  const submit = async () => {
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!title.trim() || clean.length < 2) return;
    await createPoll.mutateAsync({
      title: title.trim(),
      description: desc.trim() || undefined,
      allow_multiple: multi,
      anonymous,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      options: clean,
      notify_recipient_ids: sendEmail ? Array.from(selected) : [],
      send_email: sendEmail,
      sender_name: profile?.full_name || 'Teamskrypton',
    });
    setOpen(false);
    setTitle(''); setDesc(''); setMulti(false); setAnonymous(false); setSendEmail(true);
    setDeadline(''); setOptions(['', '']);
    setSelected(new Set()); setSelectAll(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus className="w-4 h-4 mr-2" />New Poll</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Create Poll</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="space-y-4">
            <div>
              <Label>Question / Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What should we vote on?" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                <Switch checked={multi} onCheckedChange={setMulti} id="multi" />
                <Label htmlFor="multi" className="cursor-pointer text-sm">Multiple / ranked</Label>
              </div>
              <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                <Switch checked={anonymous} onCheckedChange={setAnonymous} id="anon" />
                <Label htmlFor="anon" className="cursor-pointer text-sm">Anonymous voting</Label>
              </div>
              <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} id="mail" />
                <Label htmlFor="mail" className="cursor-pointer text-sm">Notify by email</Label>
              </div>
              <div>
                <Label className="text-xs">Deadline (optional)</Label>
                <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Options</Label>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={o} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={`Option ${i + 1}`} />
                    {options.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, x) => x !== i))}><X className="w-4 h-4" /></Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setOptions([...options, ''])}><Plus className="w-3 h-3 mr-1" />Add option</Button>
              </div>
            </div>
            {sendEmail && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Notify by email ({selected.size} selected)</Label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={selectAll} onCheckedChange={(v) => setSelectAll(!!v)} />
                    Select all
                  </label>
                </div>
                <div className="border rounded-md max-h-48 overflow-auto p-2 space-y-1">
                  {members.map((m: any) => (
                    <label key={m.user_id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer text-sm">
                      <Checkbox checked={selected.has(m.user_id)} onCheckedChange={() => toggle(m.user_id)} />
                      <span className="flex-1">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={createPoll.isPending || !title.trim() || options.filter((o) => o.trim()).length < 2}>
            {createPoll.isPending ? 'Creating...' : (sendEmail ? 'Create & Notify' : 'Create Poll')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
