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
import { GlobalScrollLayout } from '@/components/layout/GlobalScrollLayout';

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
  in_progress: { label: 'In Progress', color: 'bg-info/10 text-info border-info/20', icon: Loader2 },
  completed: { label: 'Completed', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle },
};

const LINK_TYPE_CONFIG: Record<string, { label: string; icon: typeof Github }> = {
  github: { label: 'GitHub', icon: Github },
  website: { label: 'Website', icon: Globe },
  other: { label: 'Other', icon: Link2 },
};

const BLOCK_SHAPES = [
  { value: 'rectangle', label: 'Rectangle', icon: '▬', description: 'Standard rectangular block' },
  { value: 'diamond', label: 'Diamond', icon: '◆', description: 'Decision or milestone marker' },
  { value: 'hexagon', label: 'Hexagon', icon: '⬡', description: 'Process or action step' },
  { value: 'rounded', label: 'Rounded', icon: '▢', description: 'Soft rectangular block' },
  { value: 'pill', label: 'Pill', icon: '⬭', description: 'Fully rounded capsule' },
  { value: 'octagon', label: 'Octagon', icon: '⯃', description: 'Stop or warning marker' },
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
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading flowchart...</div>;
  }

  const completedCount = blocks.filter(b => b.status === 'completed').length;
  const progress = blocks.length > 0 ? Math.round((completedCount / blocks.length) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* Enhanced Progress Section */}
        {blocks.length > 0 && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-card to-card/60 border">
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-muted-foreground">
                {completedCount}/{blocks.length} steps
              </p>
              {isSequential && (
                <Badge variant="outline" className="text-xs gap-1 bg-primary/5 text-primary border-primary/20 mt-1">
                  <Lock className="w-3 h-3" />
                  Sequential
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Enhanced Timeline */}
        <GlobalScrollLayout className="space-y-4" maxHeight="60vh">
          {timeline.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-[hsl(var(--info))]/10 flex items-center justify-center mx-auto mb-4">
                <Circle className="w-8 h-8 text-primary/40" />
              </div>
              <p className="text-base font-medium text-muted-foreground mb-2">No learning steps yet</p>
              {!isReadOnly && (
                <p className="text-sm text-muted-foreground/70">Add your first learning step or development link below</p>
              )}
            </div>
          )}

          {timeline.map((item, idx) => (
            <div key={item.kind === 'step' ? `s-${item.data.id}` : `l-${item.data.id}`}>
              {/* Enhanced Connector */}
              {idx > 0 && (
                <div className="flex justify-center py-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-b from-primary/20 to-primary/40 flex items-center justify-center">
                    <ArrowDown className="w-4 h-4 text-primary" />
                  </div>
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
        </GlobalScrollLayout>

        {/* Enhanced Action Buttons */}
        {!isReadOnly && (
          <div className="flex gap-3">
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-10 gap-2 shadow-sm hover:shadow-md transition-shadow">
                  <Plus className="w-4 h-4" />
                  Add Learning Step
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Learning Step</DialogTitle>
                </DialogHeader>
                <GlobalScrollLayout maxHeight="70vh">
                  <div className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label className="text-base font-medium">Step Name *</Label>
                        <Input
                          value={form.title}
                          onChange={e => setForm({ ...form, title: e.target.value })}
                          placeholder="e.g., Setup Environment, Learn Basics"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-base font-medium">Resource / Study Link</Label>
                        <Input
                          value={form.resource_url}
                          onChange={e => setForm({ ...form, resource_url: e.target.value })}
                          placeholder="https://..."
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Description</Label>
                      <Input
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Brief description of this step"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Block Shape</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {BLOCK_SHAPES.map(shape => (
                          <Tooltip key={shape.value}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => setForm({ ...form, block_shape: shape.value })}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm transition-all ${
                                  form.block_shape === shape.value
                                    ? 'border-primary bg-primary/10 text-primary font-medium shadow-md'
                                    : 'border-border hover:border-primary/40 text-muted-foreground hover:bg-card/50'
                                }`}
                              >
                                <span className="text-2xl">{shape.icon}</span>
                                <span className="text-xs font-medium">{shape.label}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{shape.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                    <Button 
                      onClick={handleAdd} 
                      className="w-full h-11" 
                      disabled={!form.title.trim() || createBlock.isPending}
                    >
                      {createBlock.isPending ? 'Adding...' : 'Add Step'}
                    </Button>
                  </div>
                </GlobalScrollLayout>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddLinkOpen} onOpenChange={setIsAddLinkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 h-10 gap-2 shadow-sm hover:shadow-md transition-shadow">
                  <Link2 className="w-4 h-4" />
                  Add Dev Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Development Link</DialogTitle>
                </DialogHeader>
                <GlobalScrollLayout maxHeight="70vh">
                  <div className="space-y-5 pt-4">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Link Title *</Label>
                      <Input
                        value={linkForm.title}
                        onChange={e => setLinkForm({ ...linkForm, title: e.target.value })}
                        placeholder="e.g., My React Project, Portfolio Site"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-medium">URL *</Label>
                      <Input
                        value={linkForm.url}
                        onChange={e => setLinkForm({ ...linkForm, url: e.target.value })}
                        placeholder="https://github.com/user/repo"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Link Type</Label>
                      <Select value={linkForm.link_type} onValueChange={v => setLinkForm({ ...linkForm, link_type: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github">
                            <span className="flex items-center gap-2"><Github className="w-4 h-4" /> GitHub</span>
                          </SelectItem>
                          <SelectItem value="website">
                            <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Website</span>
                          </SelectItem>
                          <SelectItem value="other">
                            <span className="flex items-center gap-2"><Link2 className="w-4 h-4" /> Other</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleAddLink}
                      className="w-full h-11"
                      disabled={!linkForm.title.trim() || !linkForm.url.trim() || addLink.isPending}
                    >
                      {addLink.isPending ? 'Adding...' : 'Add Link'}
                    </Button>
                  </div>
                </GlobalScrollLayout>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Enhanced Edit Dialog */}
        <Dialog open={!!editingBlock} onOpenChange={open => { if (!open) setEditingBlock(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Learning Step</DialogTitle>
            </DialogHeader>
            <GlobalScrollLayout maxHeight="70vh">
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Step Name *</Label>
                    <Input 
                      value={form.title} 
                      onChange={e => setForm({ ...form, title: e.target.value })} 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base font-medium">Resource / Study Link</Label>
                    <Input 
                      value={form.resource_url} 
                      onChange={e => setForm({ ...form, resource_url: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-medium">Description</Label>
                  <Input 
                    value={form.description} 
                    onChange={e => setForm({ ...form, description: e.target.value })} 
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-base font-medium">Block Shape</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {BLOCK_SHAPES.map(shape => (
                      <Tooltip key={shape.value}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, block_shape: shape.value })}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm transition-all ${
                              form.block_shape === shape.value
                                ? 'border-primary bg-primary/10 text-primary font-medium shadow-md'
                                : 'border-border hover:border-primary/40 text-muted-foreground hover:bg-card/50'
                            }`}
                          >
                            <span className="text-2xl">{shape.icon}</span>
                            <span className="text-xs font-medium">{shape.label}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">{shape.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
                <Button 
                  onClick={handleUpdate} 
                  className="w-full h-11" 
                  disabled={!form.title.trim() || updateBlock.isPending}
                >
                  {updateBlock.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </GlobalScrollLayout>
          </DialogContent>
        </Dialog>

        {/* Weekly Reflections */}
        <SkillReflectionPanel trackId={trackId} isReadOnly={isReadOnly} />
      </div>
    </TooltipProvider>
  );
}

/** Enhanced Step Block Component */
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
  
  const useClipShape = shape === 'diamond' || shape === 'hexagon' || shape === 'octagon';

  return (
    <div className={`relative transition-all duration-200 ${isLocked ? 'opacity-70' : ''}`}>
      {/* Enhanced Shape Indicator */}
      {useClipShape && (
        <div className="absolute -left-2 top-1/2 -translate-y-1/2 z-10">
          <div className={`w-8 h-8 ${shapeClass} shadow-lg ${
            block.status === 'completed' ? 'bg-gradient-to-br from-green-400 to-green-600' :
            block.status === 'in_progress' ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
            'bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/40'
          }`} />
        </div>
      )}
      
      <div className={`border-2 p-5 transition-all duration-200 shadow-sm hover:shadow-md ${
        useClipShape ? 'rounded-xl ml-6' : shapeClass
      } ${
        block.status === 'completed' ? 'border-green-500/40 bg-green-500/10 shadow-green-500/20' :
        block.status === 'in_progress' ? 'border-blue-500/40 bg-blue-500/10 shadow-blue-500/20' :
        'border-border hover:border-primary/30 bg-card/50'
      } ${isLocked ? 'border-dashed' : ''}`}>
        <div className="flex items-start gap-4">
          {isLocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-1 shrink-0 cursor-not-allowed">
                  <Lock className="w-6 h-6 text-muted-foreground/50" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">Complete previous steps first to unlock</p>
              </TooltipContent>
            </Tooltip>
          ) : !isReadOnly ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => onStatusToggle(block)} 
                  className="mt-1 shrink-0 hover:scale-110 transition-transform" 
                  title="Click to change status"
                >
                  <StatusIcon className={`w-6 h-6 ${
                    block.status === 'completed' ? 'text-green-500' :
                    block.status === 'in_progress' ? 'text-blue-500 animate-spin' :
                    'text-muted-foreground hover:text-primary'
                  }`} />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">Click to change status</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <StatusIcon className={`w-6 h-6 mt-1 shrink-0 ${
              block.status === 'completed' ? 'text-green-500' :
              block.status === 'in_progress' ? 'text-blue-500' :
              'text-muted-foreground'
            }`} />
          )}

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h4 className={`font-semibold text-base leading-tight ${isLocked ? 'text-muted-foreground' : ''}`}>
                {block.title}
              </h4>
              <Badge variant="outline" className={`text-xs px-2 py-1 ${config.color} shadow-sm`}>
                {config.label}
              </Badge>
              {isLocked && (
                <Badge variant="outline" className="text-xs gap-1 text-muted-foreground border-dashed">
                  <Lock className="w-3 h-3" /> Locked
                </Badge>
              )}
              {shape !== 'rectangle' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-lg text-muted-foreground/60 cursor-help">
                      {BLOCK_SHAPES.find(s => s.value === shape)?.icon}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{BLOCK_SHAPES.find(s => s.value === shape)?.label} shape</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {block.description && (
              <p className={`text-sm leading-relaxed ${
                isLocked ? 'text-muted-foreground/60' : 'text-muted-foreground'
              }`}>
                {block.description}
              </p>
            )}
            {block.resource_url && !isLocked && (
              <a 
                href={block.resource_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary underline hover:opacity-80 transition-opacity cursor-pointer font-medium"
              >
                <ExternalLink className="w-4 h-4" /> 
                <span className="truncate max-w-md">
                  {block.resource_url.length > 50 ? block.resource_url.slice(0, 50) + '…' : block.resource_url}
                </span>
              </a>
            )}
          </div>

          {!isReadOnly && !isLocked && (
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10" onClick={() => onEdit(block)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Edit step</p>
                </TooltipContent>
              </Tooltip>
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Delete step</p>
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Step</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete the step "{block.title}"? This action cannot be undone and will permanently remove all associated data.
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

/** Enhanced Link Block Component */
function LinkBlock({ link, isReadOnly, onDelete }: {
  link: SkillDevLink;
  isReadOnly: boolean;
  onDelete: (id: string) => void;
}) {
  const typeConfig = LINK_TYPE_CONFIG[link.link_type] || LINK_TYPE_CONFIG.other;
  const LinkIcon = typeConfig.icon;

  return (
    <div className="relative border-2 rounded-xl p-5 border-primary/30 bg-gradient-to-br from-primary/8 to-primary/4 transition-all hover:shadow-lg hover:border-primary/40">
      <div className="flex items-center gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <LinkIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <a 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-base text-primary underline hover:opacity-80 truncate transition-opacity"
            >
              {link.title}
            </a>
            <Badge variant="outline" className="text-xs bg-primary/15 text-primary border-primary/30 shadow-sm">
              {typeConfig.label}
            </Badge>
          </div>
          <a 
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground truncate block underline hover:text-primary transition-colors"
          >
            {link.url.length > 60 ? link.url.slice(0, 60) + '…' : link.url}
          </a>
        </div>

        {!isReadOnly && (
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Delete link</p>
              </TooltipContent>
            </Tooltip>
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