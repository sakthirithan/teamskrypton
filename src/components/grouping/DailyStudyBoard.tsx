import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, ExternalLink, Trash2, Link2, ListTodo, Sparkles } from 'lucide-react';
import { useDailyStudyItems } from '@/hooks/useDailyStudyItems';
import { useDailyStudyItems } from '@/hooks/useDailyStudyItems';

interface DailyStudyBoardProps {
  sessionId: string;
  userId: string;
  isReadOnly?: boolean;
}

export function DailyStudyBoard({ sessionId, userId, isReadOnly = false }: DailyStudyBoardProps) {
  const { links, todos, isLoading, addItem, toggleComplete, removeItem } = useDailyStudyItems(sessionId);
  const [tab, setTab] = useState<'links' | 'todos'>('links');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [todoTitle, setTodoTitle] = useState('');

  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    await addItem.mutateAsync({ item_type: 'link', title: linkTitle.trim(), url: linkUrl.trim() });
    setLinkTitle('');
    setLinkUrl('');
  };

  const handleAddTodo = async () => {
    if (!todoTitle.trim()) return;
    await addItem.mutateAsync({ item_type: 'todo', title: todoTitle.trim() });
    setTodoTitle('');
  };

  const completedTodos = todos.filter(t => t.is_completed).length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-[hsl(var(--info))]/5 via-transparent to-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--info))] to-primary flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Daily Study Board
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Save study links & to-do items for your sessions
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3 space-y-3">
        {/* Tab switcher */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
          <button
            onClick={() => setTab('links')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              tab === 'links' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Study Links ({links.length})
          </button>
          <button
            onClick={() => setTab('todos')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
              tab === 'todos' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ListTodo className="w-3.5 h-3.5" />
            To-Do ({completedTodos}/{todos.length})
          </button>
        </div>

        {/* Links tab */}
        {tab === 'links' && (
          <div className="space-y-2">
            {!isReadOnly && (
              <div className="flex gap-2">
                <Input
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                  placeholder="Link title..."
                  className="text-xs h-8"
                />
                <Input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0 text-xs gap-1"
                  disabled={!linkTitle.trim() || !linkUrl.trim() || addItem.isPending}
                  onClick={handleAddLink}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            )}

            {links.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No study links saved. Add links to resources you're studying today.
              </p>
            ) : (
              <div className="space-y-1.5">
                {links.map(link => (
                  <div key={link.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-card hover:border-primary/20 transition-colors group">
                    <Link2 className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={link.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary underline hover:opacity-80 truncate block"
                      >
                        {link.title}
                      </a>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                          {link.url}
                        </span>
                      </div>
                    </div>
                    <a
                      href={link.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                    </a>
                    {!isReadOnly && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-destructive/60 hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Link</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove "{link.title}" from your study board?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => removeItem.mutate(link.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Todos tab */}
        {tab === 'todos' && (
          <div className="space-y-2">
            {!isReadOnly && (
              <div className="flex gap-2">
                <Input
                  value={todoTitle}
                  onChange={e => setTodoTitle(e.target.value)}
                  placeholder="What do you need to do today?"
                  className="text-xs h-8"
                  onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                />
                <Button
                  size="sm"
                  className="h-8 shrink-0 text-xs gap-1"
                  disabled={!todoTitle.trim() || addItem.isPending}
                  onClick={handleAddTodo}
                >
                  <Plus className="w-3 h-3" />
                  Add
                </Button>
              </div>
            )}

            {todos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No to-do items. Add tasks you want to complete today.
              </p>
            ) : (
              <div className="space-y-1">
                {todos.map(todo => (
                  <div key={todo.id} className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all ${
                    todo.is_completed ? 'bg-secondary/30 border-border/50' : 'bg-card hover:border-primary/20'
                  }`}>
                    {!isReadOnly ? (
                      <Checkbox
                        checked={todo.is_completed}
                        onCheckedChange={(checked) =>
                          toggleComplete.mutate({ id: todo.id, is_completed: !!checked })
                        }
                        className="shrink-0"
                      />
                    ) : (
                      <Checkbox checked={todo.is_completed} disabled className="shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${todo.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {todo.title}
                      </span>
                    </div>
                    {!isReadOnly && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-destructive/60 hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete To-Do</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove "{todo.title}" from your study board?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => removeItem.mutate(todo.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Progress */}
            {todos.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${todos.length > 0 ? (completedTodos / todos.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {completedTodos}/{todos.length} done
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
