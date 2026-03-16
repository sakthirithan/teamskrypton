import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, ExternalLink, Edit2, Trash2, CheckCircle, Circle, Loader2, Link2, Github, Globe, Lock } from 'lucide-react';
import { useSkillTracks, FlowchartBlock } from '@/hooks/useSkillTracks';
import { useSkillDevLinks, SkillDevLink } from '@/hooks/useSkillDevLinks';
import { SkillReflectionPanel } from '@/components/grouping/SkillReflectionPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { GlobalScrollLayout } from '@/components/layout/GlobalScrollLayout';

interface LearningFlowchartProps {
  trackId: string;
  sessionId: string;
  userId: string;
  isReadOnly?: boolean;
  isSequential?: boolean;
  onFlowchartUpdate?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle; bg: string; border: string }> = {
  not_started: { label: 'Not Started', color: 'text-muted-foreground', icon: Circle, bg: 'bg-muted/50', border: 'border-border' },
  in_progress: { label: 'In Progress', color: 'text-info', icon: Loader2, bg: 'bg-info/5', border: 'border-info/30' },
  completed: { label: 'Completed', color: 'text-success', icon: CheckCircle, bg: 'bg-success/5', border: 'border-success/30' },
};

const LINK_TYPE_CONFIG: Record<string, { label: string; icon: typeof Github }> = {
  github: { label: 'GitHub', icon: Github },
  website: { label: 'Website', icon: Globe },
  other: { label: 'Other', icon: Link2 },
};

const BLOCK_SHAPES = [
  { value: 'rectangle', label: 'Rectangle', icon: '▬', description: 'Standard block' },
  { value: 'diamond', label: 'Diamond', icon: '◆', description: 'Decision point' },
  { value: 'hexagon', label: 'Hexagon', icon: '⬡', description: 'Process step' },
  { value: 'rounded', label: 'Rounded', icon: '▢', description: 'Soft block' },
  { value: 'pill', label: 'Pill', icon: '⬭', description: 'Capsule' },
  { value: 'octagon', label: 'Octagon', icon: '⯃', description: 'Stop marker' },
] as const;

const getShapeClasses = (shape: string) => {
  switch (shape) {
    case 'diamond': return 'rounded-none [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]';
    case 'hexagon': return '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]';
    case 'rounded': return 'rounded-2xl';
    case 'pill': return 'rounded-full';
    case 'octagon': return '[clip-path:polygon(30%_0%,70%_0%,100%_30%,100%_70%,70%_100%,30%_100%,0%_70%,0%_30%)]';
    default: return 'rounded-lg';
  }
};

type TimelineItem =
  | { kind: 'step'; data: FlowchartBlock; created_at: string }
  | { kind: 'link'; data: SkillDevLink; created_at: string };

export function LearningFlowchart({ trackId, sessionId, userId, isReadOnly = false, isSequential = false, onFlowchartUpdate }: LearningFlowchartProps) {
  const { user } = useAuth();
  const { useFlowchartBlocks, createBlock, updateBlock, deleteBlock } = useSkillTracks(sessionId, userId);
  const { data: blocks = [], isLoading } = useFlowchartBlocks(trackId);
  const { links, addLink, removeLink } = useSkillDevLinks(trackId);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<FlowchartBlock | null>(null);
  const [form, setForm] = useState({ title: '', description: '', resource_url: '', block_shape: 'rectangle' });
  const [linkForm, setLinkForm] = useState({ title: '', url: '', link_type: 'github' });

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [
      ...blocks.map(b => ({ kind: 'step' as const, data: b, created_at: b.created_at })),
      ...links.map(l => ({ kind: 'link' as const, data: l, created_at: l.created_at })),
    ];
    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return items;
  }, [blocks, links]);

  const isBlockLocked = (block: FlowchartBlock): boolean => {
    if (!isSequential) return false;
    const sortedBlocks = [...blocks].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sortedBlocks.findIndex(b => b.id === block.id);
    if (idx <= 0) return false;
    for (let i = 0; i < idx; i++) {
      if (sortedBlocks[i].status !== 'completed') return true;
    }
    return false;
  };

  const logActivity = async (activityType: string, description: string, entityId?: string) => {
    if (!user) return;
    try {
      await supabase.from('skill_activity_log').insert({
        user_id: user.id, session_id: sessionId, activity_type: activityType,
        entity_type: 'flowchart_block', entity_id: entityId, description,
      });
    } catch { /* silent */ }
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const result = await createBlock.mutateAsync({
      skill_track_id: trackId, title: form.title.trim(),
      description: form.description || undefined, resource_url: form.resource_url || undefined,
      sort_order: blocks.length, block_shape: form.block_shape,
    });
    await logActivity('step_added', `Added learning step: ${form.title.trim()}`, result?.id);
    setForm({ title: '', description: '', resource_url: '', block_shape: 'rectangle' });
    setIsAddOpen(false); onFlowchartUpdate?.();
  };

  const handleUpdate = async () => {
    if (!editingBlock || !form.title.trim()) return;
    await updateBlock.mutateAsync({
      id: editingBlock.id, skill_track_id: trackId, title: form.title.trim(),
      description: form.description || undefined, resource_url: form.resource_url || undefined,
      block_shape: form.block_shape,
    });
    await logActivity('step_updated', `Updated step: ${form.title.trim()}`, editingBlock.id);
    setEditingBlock(null); setForm({ title: '', description: '', resource_url: '', block_shape: 'rectangle' });
    onFlowchartUpdate?.();
  };

  const handleAddLink = async () => {
    if (!linkForm.title.trim() || !linkForm.url.trim()) return;
    await addLink.mutateAsync({ title: linkForm.title.trim(), url: linkForm.url.trim(), link_type: linkForm.link_type });
    await logActivity('link_added', `Added dev link: ${linkForm.title.trim()}`);
    setLinkForm({ title: '', url: '', link_type: 'github' }); setIsAddLinkOpen(false);
  };

  const handleStatusToggle = async (block: FlowchartBlock) => {
    if (isBlockLocked(block)) return;
    const order = ['not_started', 'in_progress', 'completed'];
    const nextIdx = (order.indexOf(block.status) + 1) % order.length;
    const newStatus = order[nextIdx];
    await updateBlock.mutateAsync({ id: block.id, skill_track_id: trackId, status: newStatus });
    await logActivity('status_changed', `${block.title}: ${STATUS_CONFIG[block.status].label} → ${STATUS_CONFIG[newStatus].label}`, block.id);
    onFlowchartUpdate?.();
  };

  const openEdit = (block: FlowchartBlock) => {
    setEditingBlock(block);
    setForm({ title: block.title, description: block.description || '', resource_url: block.resource_url || '', block_shape: block.block_shape || 'rectangle' });
  };

  if (isLoading) return <div className="py-6 text-center text-xs text-muted-foreground">Loading...</div>;

  const completedCount = blocks.filter(b => b.status === 'completed').length;
  const inProgressCount = blocks.filter(b => b.status === 'in_progress').length;
  const progress = blocks.length > 0 ? Math.round((completedCount / blocks.length) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Progress Header */}
        {blocks.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums">
              <span className="font-medium">{progress}%</span>
              <span>·</span>
              <span>{completedCount}/{blocks.length}</span>
              {isSequential && <Lock className="w-3 h-3 text-muted-foreground/50" />}
            </div>
          </div>
        )}

        {/* Flowchart Timeline */}
        <div className="relative">
          {timeline.length === 0 && (
            <div className="text-center py-6 border border-dashed border-border/60 rounded-lg animate-in fade-in-0 duration-300">
              <p className="text-xs text-muted-foreground">No learning steps yet</p>
            </div>
          )}

          {timeline.length > 0 && (
            <div className="relative pl-6">
              {/* Vertical connector line */}
              <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary/30 via-border to-border/30 rounded-full" />

              <div className="space-y-0">
                {timeline.map((item, idx) => {
                  const isStep = item.kind === 'step';
                  const isLast = idx === timeline.length - 1;

                  return (
                    <div key={isStep ? `s-${item.data.id}` : `l-${item.data.id}`} className="relative animate-in fade-in-0 slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                      {/* Node dot on the vertical line */}
                      <div className={`absolute -left-6 top-3 w-[9px] h-[9px] rounded-full border-2 z-10 transition-colors duration-300 ${
                        isStep
                          ? item.data.status === 'completed' ? 'bg-success border-success' :
                            item.data.status === 'in_progress' ? 'bg-info border-info' :
                            'bg-background border-border'
                          : 'bg-primary/70 border-primary'
                      }`} />

                      {/* Arrow connector for steps */}
                      {isStep && !isLast && (
                        <div className="absolute -left-[17px] top-[22px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-border/50" />
                      )}

                      <div className="pb-2">
                        {isStep ? (
                          <FlowchartStepBlock
                            block={item.data as FlowchartBlock}
                            isReadOnly={isReadOnly}
                            isLocked={isBlockLocked(item.data as FlowchartBlock)}
                            onStatusToggle={handleStatusToggle}
                            onEdit={openEdit}
                            onDelete={(id) => deleteBlock.mutate({ id, skill_track_id: trackId })}
                          />
                        ) : (
                          <FlowchartLinkBlock
                            link={item.data as SkillDevLink}
                            isReadOnly={isReadOnly}
                            onDelete={(id) => removeLink.mutate(id)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isReadOnly && (
          <div className="flex gap-1.5 pt-1">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 gap-1 text-[11px]">
                  <Plus className="w-3 h-3" /> Add Step
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle className="text-sm">Add Learning Step</DialogTitle></DialogHeader>
                <GlobalScrollLayout maxHeight="70vh">
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Step Name *</Label>
                        <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Setup Environment" className="text-xs h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Resource Link</Label>
                        <Input value={form.resource_url} onChange={e => setForm({ ...form, resource_url: e.target.value })} placeholder="https://..." className="text-xs h-8" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description" className="text-xs h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Shape</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {BLOCK_SHAPES.map(shape => (
                          <button key={shape.value} type="button" onClick={() => setForm({ ...form, block_shape: shape.value })}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 text-xs transition-all ${
                              form.block_shape === shape.value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/40 text-muted-foreground'
                            }`}>
                            <span className="text-lg">{shape.icon}</span>
                            <span className="text-[10px]">{shape.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleAdd} className="w-full h-8 text-xs" disabled={!form.title.trim() || createBlock.isPending}>
                      {createBlock.isPending ? 'Adding...' : 'Add Step'}
                    </Button>
                  </div>
                </GlobalScrollLayout>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddLinkOpen} onOpenChange={setIsAddLinkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-8 gap-1 text-[11px]">
                  <Link2 className="w-3 h-3" /> Add Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle className="text-sm">Add Development Link</DialogTitle></DialogHeader>
                <GlobalScrollLayout maxHeight="70vh">
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title *</Label>
                      <Input value={linkForm.title} onChange={e => setLinkForm({ ...linkForm, title: e.target.value })} placeholder="e.g., Portfolio Site" className="text-xs h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">URL *</Label>
                      <Input value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} placeholder="https://github.com/..." className="text-xs h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Type</Label>
                      <Select value={linkForm.link_type} onValueChange={v => setLinkForm({ ...linkForm, link_type: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github"><span className="flex items-center gap-1.5"><Github className="w-3.5 h-3.5" /> GitHub</span></SelectItem>
                          <SelectItem value="website"><span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website</span></SelectItem>
                          <SelectItem value="other"><span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Other</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddLink} className="w-full h-8 text-xs" disabled={!linkForm.title.trim() || !linkForm.url.trim() || addLink.isPending}>
                      {addLink.isPending ? 'Adding...' : 'Add Link'}
                    </Button>
                  </div>
                </GlobalScrollLayout>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingBlock} onOpenChange={open => { if (!open) setEditingBlock(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-sm">Edit Learning Step</DialogTitle></DialogHeader>
            <GlobalScrollLayout maxHeight="70vh">
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Step Name *</Label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="text-xs h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Resource Link</Label>
                    <Input value={form.resource_url} onChange={e => setForm({ ...form, resource_url: e.target.value })} className="text-xs h-8" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="text-xs h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Shape</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {BLOCK_SHAPES.map(shape => (
                      <button key={shape.value} type="button" onClick={() => setForm({ ...form, block_shape: shape.value })}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 text-xs transition-all ${
                          form.block_shape === shape.value ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:border-primary/40 text-muted-foreground'
                        }`}>
                        <span className="text-lg">{shape.icon}</span>
                        <span className="text-[10px]">{shape.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleUpdate} className="w-full h-8 text-xs" disabled={!form.title.trim() || updateBlock.isPending}>
                  {updateBlock.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </GlobalScrollLayout>
          </DialogContent>
        </Dialog>

        {/* Reflections */}
        <SkillReflectionPanel trackId={trackId} isReadOnly={isReadOnly} />
      </div>
    </TooltipProvider>
  );
}

/** Flowchart Step Block */
function FlowchartStepBlock({ block, isReadOnly, isLocked, onStatusToggle, onEdit, onDelete }: {
  block: FlowchartBlock;
  isReadOnly: boolean;
  isLocked: boolean;
  onStatusToggle: (b: FlowchartBlock) => void;
  onEdit: (b: FlowchartBlock) => void;
  onDelete: (id: string) => void;
}) {
  const config = STATUS_CONFIG[block.status] || STATUS_CONFIG.not_started;
  const StatusIcon = config.icon;
  const shapeClass = getShapeClasses(block.block_shape || 'rectangle');

  return (
    <div className={`group flex items-start gap-2.5 p-2.5 rounded-lg border transition-all duration-200 ${
      isLocked ? 'opacity-40 bg-muted/30 border-border/50' :
      `${config.bg} ${config.border}`
    }`}>
      {/* Status indicator with shape */}
      {isLocked ? (
        <Lock className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
      ) : !isReadOnly ? (
        <button onClick={() => onStatusToggle(block)} className="mt-0.5 shrink-0 hover:scale-110 transition-transform">
          <div className={`w-5 h-5 flex items-center justify-center ${shapeClass} ${config.bg} border ${config.border}`}>
            <StatusIcon className={`w-3 h-3 ${config.color} ${block.status === 'in_progress' ? 'animate-spin' : ''}`} />
          </div>
        </button>
      ) : (
        <div className={`w-5 h-5 flex items-center justify-center mt-0.5 shrink-0 ${shapeClass} ${config.bg} border ${config.border}`}>
          <StatusIcon className={`w-3 h-3 ${config.color}`} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-tight ${isLocked ? 'text-muted-foreground' : ''}`}>{block.title}</p>
        {block.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{block.description}</p>}
        {block.resource_url && !isLocked && (
          <a href={block.resource_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline mt-0.5">
            <ExternalLink className="w-2.5 h-2.5" /> Resource
          </a>
        )}
      </div>

      {/* Status badge */}
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${config.color} border-current/20`}>
        {config.label}
      </Badge>

      {/* Actions */}
      {!isReadOnly && !isLocked && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(block)}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/70 hover:text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Step</AlertDialogTitle>
                <AlertDialogDescription>Delete "{block.title}"? This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(block.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

/** Flowchart Link Block */
function FlowchartLinkBlock({ link, isReadOnly, onDelete }: {
  link: SkillDevLink;
  isReadOnly: boolean;
  onDelete: (id: string) => void;
}) {
  const typeConfig = LINK_TYPE_CONFIG[link.link_type] || LINK_TYPE_CONFIG.other;
  const LinkIcon = typeConfig.icon;

  return (
    <div className="group flex items-center gap-2.5 p-2 rounded-lg border border-primary/20 bg-primary/5 transition-all duration-200 hover:border-primary/40">
      <div className="shrink-0 w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
        <LinkIcon className="w-3 h-3 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline truncate block">
          {link.title}
        </a>
        <span className="text-[10px] text-muted-foreground">{typeConfig.label}</span>
      </div>
      {!isReadOnly && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/70 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Trash2 className="w-3 h-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Link</AlertDialogTitle>
              <AlertDialogDescription>Delete "{link.title}"?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => onDelete(link.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
