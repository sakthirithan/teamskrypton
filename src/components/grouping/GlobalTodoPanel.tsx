import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ListChecks, Plus, Trash2, ChevronRight, ChevronDown, Users, CheckCircle2
} from 'lucide-react';
import { useGlobalTodos } from '@/hooks/useGlobalTodos';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GlobalTodoPanelProps {
  mode?: string;
}

export function GlobalTodoPanel({ mode }: GlobalTodoPanelProps) {
  const { user, isLeadership } = useAuth();
  const { parentTodos, getSubtasks, createTodo, deleteTodo, toggleCompletion, isCompleted, getCompletions, getUncompletedUsers, profiles } = useGlobalTodos(mode);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [todoMode, setTodoMode] = useState<string>('all');
  const [isGlobal, setIsGlobal] = useState(true);
  const [parentId, setParentId] = useState<string>('');
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [showUncompleted, setShowUncompleted] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(mode || 'all');

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createTodo.mutateAsync({ title, description, mode: todoMode, is_global: isGlobal, parent_id: parentId || undefined });
    setTitle('');
    setDescription('');
    setParentId('');
    setCreateOpen(false);
  };

  const toggleExpand = (id: string) => {
    setExpandedTodos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredTodos = parentTodos.filter(t => {
    if (activeTab === 'all') return true;
    return t.mode === activeTab || t.mode === 'all';
  });

  const renderTodo = (todo: typeof parentTodos[0], isSubtask = false) => {
    const completed = isCompleted(todo.id);
    const completions = getCompletions(todo.id);
    const subtasks = getSubtasks(todo.id);
    const hasSubtasks = subtasks.length > 0;
    const expanded = expandedTodos.has(todo.id);
    const totalMembers = profiles.length;
    const completedCount = completions.length;

    return (
      <div key={todo.id} className={`${isSubtask ? 'ml-6 border-l-2 border-border pl-3' : ''}`}>
        <div className={`flex items-start gap-2 py-2 px-2 rounded-md transition-colors ${completed ? 'bg-muted/30' : 'hover:bg-muted/20'}`}>
          <Checkbox
            checked={completed}
            onCheckedChange={() => toggleCompletion.mutate(todo.id)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {hasSubtasks && (
                <button onClick={() => toggleExpand(todo.id)} className="p-0.5">
                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
              <span className={`text-sm ${completed ? 'line-through text-muted-foreground' : 'font-medium'}`}>
                {todo.title}
              </span>
              {todo.is_global && <Badge variant="outline" className="text-[9px] px-1 py-0">Global</Badge>}
              {todo.mode !== 'all' && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 capitalize">{todo.mode}</Badge>
              )}
            </div>
            {todo.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{todo.description}</p>
            )}
            {todo.is_global && totalMembers > 0 && (
              <button
                onClick={() => setShowUncompleted(showUncompleted === todo.id ? null : todo.id)}
                className="text-[10px] text-primary hover:underline mt-0.5 flex items-center gap-1"
              >
                <CheckCircle2 className="w-2.5 h-2.5" />
                {completedCount}/{totalMembers} completed
              </button>
            )}
          </div>
          {(isLeadership || todo.created_by === user?.id) && (
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => deleteTodo.mutate(todo.id)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          )}
        </div>

        {/* Uncompleted users popover */}
        {showUncompleted === todo.id && (
          <div className="ml-8 mb-2 p-2 rounded-md bg-muted/40 border">
            <p className="text-[10px] font-medium mb-1">Not completed:</p>
            <div className="flex flex-wrap gap-1">
              {getUncompletedUsers(todo.id).map(u => (
                <Badge key={u.user_id} variant="outline" className="text-[10px] px-1.5 py-0">
                  {u.full_name}
                </Badge>
              ))}
              {getUncompletedUsers(todo.id).length === 0 && (
                <span className="text-[10px] text-muted-foreground">Everyone completed!</span>
              )}
            </div>
          </div>
        )}

        {/* Subtasks */}
        {hasSubtasks && expanded && (
          <div className="mt-1">
            {subtasks.map(st => renderTodo(st, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              To-Do List
            </span>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create To-Do</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <Input
                    placeholder="To-do title..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={todoMode} onValueChange={setTodoMode}>
                      <SelectTrigger><SelectValue placeholder="Mode" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Both Modes</SelectItem>
                        <SelectItem value="grouping">Grouping Only</SelectItem>
                        <SelectItem value="pbl">PBL Only</SelectItem>
                      </SelectContent>
                    </Select>
                    {isLeadership && (
                      <Select value={isGlobal ? 'global' : 'personal'} onValueChange={v => setIsGlobal(v === 'global')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Global (All Members)</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {parentTodos.length > 0 && (
                    <Select value={parentId} onValueChange={setParentId}>
                      <SelectTrigger><SelectValue placeholder="Parent task (optional - for subtask)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No parent (top-level)</SelectItem>
                        {parentTodos.filter(t => t.is_global || t.created_by === user?.id).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button onClick={handleCreate} className="w-full" disabled={createTodo.isPending || !title.trim()}>
                    {createTodo.isPending ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="grouping" className="text-xs">Grouping</TabsTrigger>
              <TabsTrigger value="pbl" className="text-xs">PBL</TabsTrigger>
            </TabsList>
          </Tabs>

          <ScrollArea className="max-h-[500px] mt-3">
            {filteredTodos.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No to-dos yet
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredTodos.map(todo => renderTodo(todo))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
