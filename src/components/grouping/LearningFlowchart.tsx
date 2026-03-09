import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, ExternalLink, Edit2, Trash2, CheckCircle, Circle, ArrowDown, Loader2, Link2, Github, Globe, Lock, Square, Diamond, Hexagon, Pentagon, Triangle, Octagon } from 'lucide-react';
import { useSkillTracks, FlowchartBlock } from '@/hooks/useSkillTracks';
import { useSkillDevLinks, SkillDevLink } from '@/hooks/useSkillDevLinks';
import { SkillReflectionPanel } from '@/components/grouping/SkillReflectionPanel';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LearningFlowchartProps {
  trackId: string;
  sessionId: string;
  userId: string;
  isReadOnly?: boolean;
  isSequential?: boolean;
  onFlowchartUpdate?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  not_started: { label: 'Not Started', color: 'bg-muted text-muted-foreground', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Loader2 },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle },
};

const LINK_TYPE_CONFIG: Record<string, { label: string; icon: typeof Github }> = {
  github: { label: 'GitHub', icon: Github },
  website: { label: 'Website', icon: Globe },
  other: { label: 'Other', icon: Link2 },
};

const BLOCK_SHAPES = [
  { value: 'rectangle', label: 'Rectangle', icon: '▬' },
  { value: 'diamond', label: 'Diamond', icon: '◆' },
  { value: 'hexagon', label: 'Hexagon', icon: '⬡' },
  { value: 'rounded', label: 'Rounded', icon: '▢' },
  { value: 'pill', label: 'Pill', icon: '⬭' },
  { value: 'octagon', label: 'Octagon', icon: '⯃' },
] as const;

const getShapeClasses = (shape: string) => {
  switch (shape) {
    case 'diamond': return 'rounded-none rotate-0 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]';
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

  // Merge steps + links into a single chronological timeline
  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [
      ...blocks.map(b => ({ kind: 'step' as const, data: b, created_at: b.created_at })),
      ...links.map(l => ({ kind: 'link' as const, data: l, created_at: l.created_at })),
    ];
    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return items;
  }, [blocks, links]);

  // Sequential enforcement: determine which blocks are locked
  const isBlockLocked = (block: FlowchartBlock): boolean => {
    if (!isSequential) return false;
    const sortedBlocks = [...blocks].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sortedBlocks.findIndex(b => b.id === block.id);
    if (idx <= 0) return false; // First block is always unlocked
    // Check if all previous blocks are completed
    for (let i = 0; i < idx; i++) {
      if (sortedBlocks[i].status !== 'completed') return true;
    }
    return false;
  };

  const logActivity = async (activityType: string, description: string, entityId?: string) => {
    if (!user) return;
    try {
      await supabase.from('skill_activity_log').insert({
        user_id: user.id,
        session_id: sessionId,
        activity_type: activityType,
        entity_type: 'flowchart_block',
        entity_id: entityId,
        description,
      });
    } catch { /* silent */ }
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const result = await createBlock.mutateAsync({
      skill_track_id: trackId,
      title: form.title.trim(),
      description: form.description || undefined,
      resource_url: form.resource_url || undefined,
      sort_order: blocks.length,
      block_shape: form.block_shape,
    });
    await logActivity('step_added', `Added learning step: ${form.title.trim()}`, result?.id);
    setForm({ title: '', description: '', resource_url: '', block_shape: 'rectangle' });
    setIsAddOpen(false);
    onFlowchartUpdate?.();
  };

  const handleUpdate = async () => {
    if (!editingBlock || !form.title.trim()) return;
    await updateBlock.mutateAsync({
      id: editingBlock.id,
      skill_track_id: trackId,
      title: form.title.trim(),
      description: form.description || undefined,
      resource_url: form.resource_url || undefined,
      block_shape: form.block_shape,
    });
    await logActivity('step_updated', `Updated step: ${form.title.trim()}`, editingBlock.id);
    setEditingBlock(null);
    setForm({ title: '', description: '', resource_url: '', block_shape: 'rectangle' });
    onFlowchartUpdate?.();
  };

  const handleAddLink = async () => {
    if (!linkForm.title.trim() || !linkForm.url.trim()) return;
    await addLink.mutateAsync({
      title: linkForm.title.trim(),
      url: linkForm.url.trim(),
      link_type: linkForm.link_type,
    });
    await logActivity('link_added', `Added dev link: ${linkForm.title.trim()}`);
    setLinkForm({ title: '', url: '', link_type: 'github' });
    setIsAddLinkOpen(false);
  };

  const handleStatusToggle = async (block: FlowchartBlock) => {
    if (isBlockLocked(block)) return;
    const order = ['not_started', 'in_progress', 'completed'];
    const nextIdx = (order.indexOf(block.status) + 1) % order.length;
    const newStatus = order[nextIdx];
    await updateBlock.mutateAsync({
      id: block.id,
      skill_track_id: trackId,
      status: newStatus,
    });
    await logActivity('status_changed', `${block.title}: ${STATUS_CONFIG[block.status].label} → ${STATUS_CONFIG[newStatus].label}`, block.id);
    onFlowchartUpdate?.();
  };

  const openEdit = (block: FlowchartBlock) => {
    setEditingBlock(block);
    setForm({
      title: block.title,
      description: block.description || '',
      resource_url: block.resource_url || '',
      block_shape: block.block_shape || 'rectangle',
    });
  };

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  const completedCount = blocks.filter(b => b.status === 'completed').length;
  const progress = blocks.length > 0 ? Math.round((completedCount / blocks.length) * 100) : 0;

  return (
    <TooltipProvider>
    <div className="space-y-3">
      {/* Progress bar */}
      {blocks.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {completedCount}/{blocks.length} steps
          </span>
          {isSequential && (
            <Badge variant="outline" className="text-[9px] gap-0.5 bg-primary/5 text-primary border-primary/20">
              <Lock className="w-2.5 h-2.5" />
              Sequential
            </Badge>
          )}
        </div>
      )}

      {/* Unified chronological timeline */}
      <div className="relative">
        {timeline.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">
            No items yet.{!isReadOnly && ' Add a learning step or development link below.'}
          </p>
        )}

        {timeline.map((item, idx) => (
          <div key={item.kind === 'step' ? `s-${item.data.id}` : `l-${item.data.id}`}>
            {/* Connector */}
            {idx > 0 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
              </div>
            )}

            {item.kind === 'step' ? (
              <StepBlock
                block={item.data}
                isReadOnly={isReadOnly}
                isLocked={isBlockLocked(item.data)}
                isSequential={isSequential}
                onStatusToggle={handleStatusToggle}
                onEdit={openEdit}
                onDelete={(id) => deleteBlock.mutate({ id, skill_track_id: trackId })}
              />
            ) : (
              <LinkBlock
                link={item.data}
                isReadOnly={isReadOnly}
                onDelete={(id) => removeLink.mutate(id)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {!isReadOnly && (
        <div className="flex gap-2">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Plus className="w-4 h-4 mr-1" />
                Add Learning Step
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Learning Step</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Step Name *</Label>
                  <Input
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Setup Environment, Learn Basics"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of this step"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resource / Study Link</Label>
                  <Input
                    value={form.resource_url}
                    onChange={e => setForm({ ...form, resource_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Block Shape</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {BLOCK_SHAPES.map(shape => (
                      <button
                        key={shape.value}
                        type="button"
                        onClick={() => setForm({ ...form, block_shape: shape.value })}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all ${
                          form.block_shape === shape.value
                            ? 'border-primary bg-primary/10 text-primary font-medium'
                            : 'border-border hover:border-primary/40 text-muted-foreground'
                        }`}
                      >
                        <span className="text-base">{shape.icon}</span>
                        <span className="text-xs">{shape.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={!form.title.trim() || createBlock.isPending}>
                  {createBlock.isPending ? 'Adding...' : 'Add Step'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddLinkOpen} onOpenChange={setIsAddLinkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Link2 className="w-4 h-4 mr-1" />
                Add Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Development Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Link Title *</Label>
                  <Input
                    value={linkForm.title}
                    onChange={e => setLinkForm({ ...linkForm, title: e.target.value })}
                    placeholder="e.g., My React Project, Portfolio Site"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL *</Label>
                  <Input
                    value={linkForm.url}
                    onChange={e => setLinkForm({ ...linkForm, url: e.target.value })}
                    placeholder="https://github.com/user/repo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link Type</Label>
                  <Select value={linkForm.link_type} onValueChange={v => setLinkForm({ ...linkForm, link_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="github">
                        <span className="flex items-center gap-2"><Github className="w-3.5 h-3.5" /> GitHub</span>
                      </SelectItem>
                      <SelectItem value="website">
                        <span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Website</span>
                      </SelectItem>
                      <SelectItem value="other">
                        <span className="flex items-center gap-2"><Link2 className="w-3.5 h-3.5" /> Other</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddLink}
                  className="w-full"
                  disabled={!linkForm.title.trim() || !linkForm.url.trim() || addLink.isPending}
                >
                  {addLink.isPending ? 'Adding...' : 'Add Link'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Edit step dialog */}
      <Dialog open={!!editingBlock} onOpenChange={open => { if (!open) setEditingBlock(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Learning Step</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Step Name *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Resource / Study Link</Label>
              <Input value={form.resource_url} onChange={e => setForm({ ...form, resource_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Block Shape</Label>
              <div className="grid grid-cols-3 gap-2">
                {BLOCK_SHAPES.map(shape => (
                  <button
                    key={shape.value}
                    type="button"
                    onClick={() => setForm({ ...form, block_shape: shape.value })}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all ${
                      form.block_shape === shape.value
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/40 text-muted-foreground'
                    }`}
                  >
                    <span className="text-base">{shape.icon}</span>
                    <span className="text-xs">{shape.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={!form.title.trim() || updateBlock.isPending}>
              {updateBlock.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Weekly Reflections */}
      <SkillReflectionPanel trackId={trackId} isReadOnly={isReadOnly} />
    </div>
    </TooltipProvider>
  );
}

/** Renders a learning step block with shape support */
function StepBlock({ block, isReadOnly, isLocked, isSequential, onStatusToggle, onEdit, onDelete }: {
  block: FlowchartBlock;
  isReadOnly: boolean;
  isLocked: boolean;
  isSequential: boolean;
  onStatusToggle: (b: FlowchartBlock) => void;
  onEdit: (b: FlowchartBlock) => void;
  onDelete: (id: string) => void;
}) {
  const config = STATUS_CONFIG[block.status] || STATUS_CONFIG.not_started;
  const StatusIcon = config.icon;
  const shape = block.block_shape || 'rectangle';
  const shapeClass = getShapeClasses(shape);
  const isDiamond = shape === 'diamond';

  // For diamond/hexagon shapes, we use a visual indicator but keep content readable
  const useClipShape = shape === 'diamond' || shape === 'hexagon' || shape === 'octagon';

  return (
    <div className={`relative transition-colors ${isLocked ? 'opacity-60' : ''}`}>
      {/* Shape indicator */}
      {useClipShape && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-10">
          <div className={`w-6 h-6 ${shapeClass} ${
            block.status === 'completed' ? 'bg-green-500/30' :
            block.status === 'in_progress' ? 'bg-blue-500/30' :
            'bg-muted'
          }`} />
        </div>
      )}
      
      <div className={`border p-3 transition-colors ${
        useClipShape ? 'rounded-lg ml-4' :
        shapeClass
      } ${
        block.status === 'completed' ? 'border-green-500/30 bg-green-500/5' :
        block.status === 'in_progress' ? 'border-blue-500/30 bg-blue-500/5' :
        'border-border'
      } ${isLocked ? 'border-dashed' : ''}`}>
        <div className="flex items-start gap-3">
          {isLocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-0.5 shrink-0 cursor-not-allowed">
                  <Lock className="w-5 h-5 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Complete previous steps first to unlock</p>
              </TooltipContent>
            </Tooltip>
          ) : !isReadOnly ? (
            <button onClick={() => onStatusToggle(block)} className="mt-0.5 shrink-0" title="Click to change status">
              <StatusIcon className={`w-5 h-5 ${
                block.status === 'completed' ? 'text-green-500' :
                block.status === 'in_progress' ? 'text-blue-500 animate-spin' :
                'text-muted-foreground'
              }`} />
            </button>
          ) : (
            <StatusIcon className={`w-5 h-5 mt-0.5 shrink-0 ${
              block.status === 'completed' ? 'text-green-500' :
              block.status === 'in_progress' ? 'text-blue-500' :
              'text-muted-foreground'
            }`} />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-sm ${isLocked ? 'text-muted-foreground' : ''}`}>{block.title}</span>
              <Badge variant="outline" className={`text-xs ${config.color}`}>{config.label}</Badge>
              {isLocked && (
                <Badge variant="outline" className="text-[9px] gap-0.5 text-muted-foreground">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </Badge>
              )}
              {shape !== 'rectangle' && (
                <span className="text-xs text-muted-foreground/60">
                  {BLOCK_SHAPES.find(s => s.value === shape)?.icon}
                </span>
              )}
            </div>
            {block.description && (
              <p className={`text-xs mt-1 ${isLocked ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>{block.description}</p>
            )}
            {block.resource_url && !isLocked && (
              <a href={block.resource_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary underline hover:opacity-80 mt-1 cursor-pointer z-10 relative">
                <ExternalLink className="w-3 h-3" /> {block.resource_url.length > 40 ? block.resource_url.slice(0, 40) + '…' : block.resource_url}
              </a>
            )}
          </div>

          {!isReadOnly && !isLocked && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(block)}>
                <Edit2 className="w-3 h-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Step</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the step "{block.title}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onDelete(block.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Renders a development link block */
function LinkBlock({ link, isReadOnly, onDelete }: {
  link: SkillDevLink;
  isReadOnly: boolean;
  onDelete: (id: string) => void;
}) {
  const typeConfig = LINK_TYPE_CONFIG[link.link_type] || LINK_TYPE_CONFIG.other;
  const LinkIcon = typeConfig.icon;

  return (
    <div className="relative border rounded-lg p-3 border-primary/20 bg-primary/5 transition-colors">
      <div className="flex items-center gap-3">
        <LinkIcon className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={link.url} target="_blank" rel="noopener noreferrer"
              className="font-medium text-sm text-primary underline hover:opacity-80 truncate cursor-pointer z-10 relative">
              {link.title}
            </a>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              {typeConfig.label}
            </Badge>
          </div>
          <a href={link.url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-muted-foreground mt-0.5 truncate block underline hover:text-primary cursor-pointer z-10 relative">
            {link.url}
          </a>
        </div>

        {!isReadOnly && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive shrink-0">
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Link</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the link "{link.title}"? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDelete(link.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
