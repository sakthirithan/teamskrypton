import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InchargeAppointment } from '@/hooks/useIncharge';
import { ShieldCheck, UserPlus, Power, Trash2 } from 'lucide-react';

interface Props {
  members: Array<{ user_id: string; full_name: string; department: string }>;
  appointments: InchargeAppointment[];
  onAppoint: (input: { user_id: string; position: string; responsibilities?: string }) => void;
  onToggle: (a: InchargeAppointment) => void;
  onRemove: (id: string) => void;
  saving?: boolean;
}

export function AppointInchargeCard({ members, appointments, onAppoint, onToggle, onRemove, saving }: Props) {
  const [userId, setUserId] = useState('');
  const [position, setPosition] = useState('');
  const [responsibilities, setResponsibilities] = useState('');

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.full_name || 'Member';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-primary" />
            Appoint an Incharge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Team member</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name} · {m.department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Incharge position</Label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Training Incharge"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Responsibilities</Label>
            <Textarea
              value={responsibilities}
              onChange={(e) => setResponsibilities(e.target.value)}
              rows={3}
              placeholder="Describe the scope of this incharge role"
            />
          </div>
          <Button
            className="w-full"
            disabled={!userId || position.trim().length < 2 || saving}
            onClick={() => {
              onAppoint({ user_id: userId, position: position.trim(), responsibilities });
              setUserId('');
              setPosition('');
              setResponsibilities('');
            }}
          >
            Appoint Incharge
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Current Incharges ({appointments.filter((a) => a.is_active).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[22rem]">
            <div className="space-y-2 p-4 pt-0">
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{nameOf(a.user_id)}</p>
                    <p className="truncate text-xs text-primary">{a.position}</p>
                    {a.responsibilities && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.responsibilities}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={a.is_active ? 'default' : 'outline'} className="text-[10px]">
                      {a.is_active ? 'Active' : 'Paused'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(a)}>
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onRemove(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {!appointments.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">No incharges appointed yet</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
