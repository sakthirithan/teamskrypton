import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, ExternalLink, Trash2, Link2, ListTodo, Sparkles, Pin, PinOff, Search, StickyNote, BookOpen, Code, Video, FileText, GraduationCap, Wrench, Tag } from 'lucide-react';
import { useDailyStudyItems, DailyStudyItem, STUDY_CATEGORIES } from '@/hooks/useDailyStudyItems';

interface DailyStudyBoardProps {
  sessionId: string;
  userId: string;
  isReadOnly?: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  general: { label: 'General', icon: Tag, color: 'text-muted-foreground' },
  documentation: { label: 'Docs', icon: FileText, color: 'text-blue-500' },
  video: { label: 'Video', icon: Video, color: 'text-red-500' },
  article: { label: 'Article', icon: BookOpen, color: 'text-emerald-500' },
  course: { label: 'Course', icon: GraduationCap, color: 'text-purple-500' },
  project: { label: 'Project', icon: Code, color: 'text-orange-500' },
  practice: { label: 'Practice', icon: Wrench, color: 'text-amber-500' },
};

export function DailyStudyBoard({ sessionId, userId, isReadOnly = false }: DailyStudyBoardProps) {
  const { links, todos, isLoading, addItem, toggleComplete, togglePin, updateItem, removeItem } = useDailyStudyItems(sessionId);
  const [tab, setTab] = useState<'links' | 'todos'>('links');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCategory, setLinkCategory] = useState('general');
  const [linkNotes, setLinkNotes] = useState('');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoNotes, setTodoNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    await addItem.mutateAsync({ 
      item_type: 'link', 
      title: linkTitle.trim(), 
      url: linkUrl.trim(),
      category: linkCategory,
      notes: linkNotes.trim() || undefined,
    });
    setLinkTitle(''); setLinkUrl(''); setLinkCategory('general'); setLinkNotes(''); setShowAddForm(false);
  };

  const handleAddTodo = async () => {
    if (!todoTitle.trim()) return;
    await addItem.mutateAsync({ 
      item_type: 'todo', 
      title: todoTitle.trim(),
      notes: todoNotes.trim() || undefined,
    });
    setTodoTitle(''); setTodoNotes(''); setShowAddForm(false);
  };

  const filteredLinks = useMemo(() => {
    let result = links;
    if (searchQuery) result = result.filter(l => l.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (filterCategory !== 'all') result = result.filter(l => (l.category || 'general') === filterCategory);
    return result;
  }, [links, searchQuery, filterCategory]);

  const filteredTodos = useMemo(() => {
    if (!searchQuery) return todos;
    return todos.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [todos, searchQuery]);

  const completedTodos = todos.filter(t => t.is_completed).length;
  const pinnedCount = (tab === 'links' ? links : todos).filter(i => i.is_pinned).length;

  // Stats
  const totalItems = links.length + todos.length;
  const todoProgress = todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0;

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-2 bg-gradient-to-r from-[hsl(var(--info))]/5 via-transparent to-primary/5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--info))] to-primary flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Daily Study Board</CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  {totalItems} item{totalItems !== 1 ? 's' : ''} · {pinnedCount > 0 && `${pinnedCount} pinned · `}{completedTodos}/{todos.length} done
                </p>
              </div>
            </div>
          </div>

          {/* Mini Stats */}
          {totalItems > 0 && (
            <div className="flex gap-2 mt-2">
              <div className="flex-1 rounded-md bg-background/60 px-2.5 py-1.5 text-center">
                <p className="text-lg font-bold leading-none">{links.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Links</p>
              </div>
              <div className="flex-1 rounded-md bg-background/60 px-2.5 py-1.5 text-center">
                <p className="text-lg font-bold leading-none">{todos.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Tasks</p>
              </div>
              <div className="flex-1 rounded-md bg-background/60 px-2.5 py-1.5 text-center">
                <p className="text-lg font-bold leading-none text-primary">{todoProgress}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Done</p>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-2 space-y-2">
          {/* Tab Switcher */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/50">
            <button
              onClick={() => setTab('links')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === 'links' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Links ({links.length})
            </button>
            <button
              onClick={() => setTab('todos')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                tab === 'todos' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              To-Do ({completedTodos}/{todos.length})
            </button>
          </div>

          {/* Search & Filter Bar */}
          {(links.length > 0 || todos.length > 0) && (
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="h-7 text-xs pl-7 pr-2"
                />
              </div>
              {tab === 'links' && (
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-7 w-[100px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {STUDY_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{CATEGORY_CONFIG[c]?.label || c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isReadOnly && (
                <Button size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => setShowAddForm(!showAddForm)}>
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {/* Links Tab */}
          {tab === 'links' && (
            <div className="space-y-1.5">
              {/* Add Form */}
              {!isReadOnly && (showAddForm || links.length === 0) && (
                <div className="space-y-1.5 p-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <div className="flex gap-1.5">
                    <Input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} placeholder="Link title" className="text-xs h-7" />
                    <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." className="text-xs h-7" />
                  </div>
                  <div className="flex gap-1.5">
                    <Select value={linkCategory} onValueChange={setLinkCategory}>
                      <SelectTrigger className="h-7 w-[110px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STUDY_CATEGORIES.map(c => {
                          const cfg = CATEGORY_CONFIG[c];
                          return <SelectItem key={c} value={c}>{cfg?.label || c}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    <Input value={linkNotes} onChange={e => setLinkNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs h-7 flex-1" />
                    <Button size="sm" className="h-7 text-xs gap-1" disabled={!linkTitle.trim() || !linkUrl.trim() || addItem.isPending} onClick={handleAddLink}>
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>
                </div>
              )}

              {filteredLinks.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border/60 rounded-lg animate-in fade-in-0 duration-300">
                  <Link2 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">
                    {searchQuery || filterCategory !== 'all' ? 'No matching links' : 'No study links yet'}
                  </p>
                  {!isReadOnly && !searchQuery && <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add links to resources you're studying</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLinks.map((link, idx) => (
                    <StudyLinkItem
                      key={link.id}
                      link={link}
                      isReadOnly={isReadOnly}
                      isExpanded={expandedNotes === link.id}
                      onToggleExpand={() => setExpandedNotes(expandedNotes === link.id ? null : link.id)}
                      onTogglePin={() => togglePin.mutate({ id: link.id, is_pinned: !link.is_pinned })}
                      onDelete={() => removeItem.mutate(link.id)}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Todos Tab */}
          {tab === 'todos' && (
            <div className="space-y-1.5">
              {!isReadOnly && (showAddForm || todos.length === 0) && (
                <div className="space-y-1.5 p-2.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                  <div className="flex gap-1.5">
                    <Input
                      value={todoTitle}
                      onChange={e => setTodoTitle(e.target.value)}
                      placeholder="What do you need to do?"
                      className="text-xs h-7 flex-1"
                      onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
                    />
                    <Button size="sm" className="h-7 text-xs gap-1" disabled={!todoTitle.trim() || addItem.isPending} onClick={handleAddTodo}>
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>
                  <Input value={todoNotes} onChange={e => setTodoNotes(e.target.value)} placeholder="Notes (optional)" className="text-xs h-7" />
                </div>
              )}

              {filteredTodos.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-border/60 rounded-lg animate-in fade-in-0 duration-300">
                  <ListTodo className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">
                    {searchQuery ? 'No matching tasks' : 'No to-do items yet'}
                  </p>
                  {!isReadOnly && !searchQuery && <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add tasks to track your progress</p>}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredTodos.map((todo, idx) => (
                    <StudyTodoItem
                      key={todo.id}
                      todo={todo}
                      isReadOnly={isReadOnly}
                      isExpanded={expandedNotes === todo.id}
                      onToggleExpand={() => setExpandedNotes(expandedNotes === todo.id ? null : todo.id)}
                      onToggleComplete={(checked) => toggleComplete.mutate({ id: todo.id, is_completed: !!checked })}
                      onTogglePin={() => togglePin.mutate({ id: todo.id, is_pinned: !todo.is_pinned })}
                      onDelete={() => removeItem.mutate(todo.id)}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    />
                  ))}
                </div>
              )}

              {/* Progress Bar */}
              {todos.length > 0 && (
                <div className="flex items-center gap-2 pt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${todoProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{completedTodos}/{todos.length}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

/** Study Link Item */
function StudyLinkItem({ link, isReadOnly, isExpanded, onToggleExpand, onTogglePin, onDelete, style }: {
  link: DailyStudyItem;
  isReadOnly: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  style?: React.CSSProperties;
}) {
  const catCfg = CATEGORY_CONFIG[(link.category || 'general')] || CATEGORY_CONFIG.general;
  const CatIcon = catCfg.icon;

  return (
    <div 
      className={`group rounded-lg border transition-all duration-200 animate-in fade-in-0 slide-in-from-left-1 ${
        link.is_pinned ? 'border-primary/30 bg-primary/5' : 'border-border/50 bg-card hover:border-primary/20'
      }`}
      style={style}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <CatIcon className={`w-3.5 h-3.5 shrink-0 ${catCfg.color}`} />
        <div className="flex-1 min-w-0">
          <a href={link.url || '#'} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline truncate block">
            {link.title}
          </a>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-border/50">{catCfg.label}</Badge>
            {link.is_pinned && <Pin className="w-2.5 h-2.5 text-primary fill-primary" />}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {link.notes && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onToggleExpand}>
                  <StickyNote className={`w-3 h-3 ${isExpanded ? 'text-primary' : 'text-muted-foreground/50'}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">View notes</p></TooltipContent>
            </Tooltip>
          )}
          <a href={link.url || '#'} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
          </a>
          {!isReadOnly && (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onTogglePin}>
                {link.is_pinned ? <PinOff className="w-3 h-3 text-primary" /> : <Pin className="w-3 h-3 text-muted-foreground/50" />}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Link</AlertDialogTitle>
                    <AlertDialogDescription>Remove "{link.title}" from your study board?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      {isExpanded && link.notes && (
        <div className="px-2.5 pb-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2 leading-relaxed">{link.notes}</p>
        </div>
      )}
    </div>
  );
}

/** Study Todo Item */
function StudyTodoItem({ todo, isReadOnly, isExpanded, onToggleExpand, onToggleComplete, onTogglePin, onDelete, style }: {
  todo: DailyStudyItem;
  isReadOnly: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleComplete: (checked: boolean) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div 
      className={`group rounded-lg border transition-all duration-200 animate-in fade-in-0 slide-in-from-left-1 ${
        todo.is_pinned ? 'border-primary/30 bg-primary/5' : 
        todo.is_completed ? 'bg-secondary/20 border-border/40' : 'bg-card border-border/50 hover:border-primary/20'
      }`}
      style={style}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {!isReadOnly ? (
          <Checkbox checked={todo.is_completed} onCheckedChange={onToggleComplete} className="shrink-0" />
        ) : (
          <Checkbox checked={todo.is_completed} disabled className="shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className={`text-xs ${todo.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {todo.title}
          </span>
          {todo.is_pinned && <Pin className="w-2.5 h-2.5 text-primary fill-primary inline ml-1" />}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {todo.notes && (
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onToggleExpand}>
              <StickyNote className={`w-2.5 h-2.5 ${isExpanded ? 'text-primary' : 'text-muted-foreground/40'}`} />
            </Button>
          )}
          {!isReadOnly && (
            <>
              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onTogglePin}>
                {todo.is_pinned ? <PinOff className="w-2.5 h-2.5 text-primary" /> : <Pin className="w-2.5 h-2.5 text-muted-foreground/40" />}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete To-Do</AlertDialogTitle>
                    <AlertDialogDescription>Remove "{todo.title}"?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>
      {isExpanded && todo.notes && (
        <div className="px-2.5 pb-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <p className="text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5 leading-relaxed">{todo.notes}</p>
        </div>
      )}
    </div>
  );
}
