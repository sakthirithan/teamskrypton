import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Member { user_id: string; full_name: string; }

export function TaskCRUD() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignTo: '', deadline: '' });

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      if (data) setMembers(data);
    };
    fetchMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.title || !form.assignTo || !form.deadline) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields' });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.from('tasks').insert({
      title: form.title,
      description: form.description || null,
      assigned_to: form.assignTo,
      assigned_by: user.id,
      deadline: new Date(form.deadline).toISOString(),
      status: 'idle',
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create task' });
    } else {
      toast({ title: 'Task Created', description: 'Task assigned successfully' });
      setForm({ title: '', description: '', assignTo: '', deadline: '' });
    }
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Plus className="w-5 h-5" /> Create Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task name" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" rows={2} /></div>
          <div><Label>Assign To *</Label>
            <Select value={form.assignTo} onValueChange={(v) => setForm({ ...form, assignTo: v })}>
              <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Deadline *</Label><Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          <Button type="submit" className="w-full" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Task</Button>
        </form>
      </CardContent>
    </Card>
  );
}
