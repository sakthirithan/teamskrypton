import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, ExternalLink, Edit2, Trash2, CheckCircle, Circle, ArrowDown, Loader2, Link2, Github, Globe } from 'lucide-react';
import { useSkillTracks, FlowchartBlock } from '@/hooks/useSkillTracks';
import { useSkillDevLinks } from '@/hooks/useSkillDevLinks';

interface LearningFlowchartProps {
  trackId: string;
  sessionId: string;
  userId: string;
  isReadOnly?: boolean;
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

export function LearningFlowchart({ trackId, sessionId, userId, isReadOnly = false }: LearningFlowchartProps) {
  const { useFlowchartBlocks, createBlock, updateBlock, deleteBlock } = useSkillTracks(sessionId, userId);
  const { data: blocks = [], isLoading } = useFlowchartBlocks(trackId);
  const { links, addLink, removeLink } = useSkillDevLinks(trackId);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<FlowchartBlock | null>(null);
  const [form, setForm] = useState({ title: '', description: '', resource_url: '' });
  const [linkForm, setLinkForm] = useState({ title: '', url: '', link_type: 'github' });

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    await createBlock.mutateAsync({
      skill_track_id: trackId,
      title: form.title.trim(),
      description: form.description || undefined,
      resource_url: form.resource_url || undefined,
      sort_order: blocks.length,
    });
    setForm({ title: '', description: '', resource_url: '' });
    setIsAddOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingBlock || !form.title.trim()) return;
    await updateBlock.mutateAsync({
      id: editingBlock.id,
      skill_track_id: trackId,
      title: form.title.trim(),
      description: form.description || undefined,
      resource_url: form.resource_url || undefined,
    });
    setEditingBlock(null);
    setForm({ title: '', description: '', resource_url: '' });
  };

  const handleAddLink = async () => {
    if (!linkForm.title.trim() || !linkForm.url.trim()) return;
    await addLink.mutateAsync({
      title: linkForm.title.trim(),
      url: linkForm.url.trim(),
      link_type: linkForm.link_type,
    });
    setLinkForm({ title: '', url: '', link_type: 'github' });
    setIsAddLinkOpen(false);
  };

  const handleStatusToggle = async (block: FlowchartBlock) => {
    const order = ['not_started', 'in_progress', 'completed'];
    const nextIdx = (order.indexOf(block.status) + 1) % order.length;
    await updateBlock.mutateAsync({
      id: block.id,
      skill_track_id: trackId,
      status: order[nextIdx],
    });
  };

  const openEdit = (block: FlowchartBlock) => {
    setEditingBlock(block);
    setForm({
      title: block.title,
      description: block.description || '',
      resource_url: block.resource_url || '',
    });
  };

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading steps...</div>;
  }

  const completedCount = blocks.filter(b => b.status === 'completed').length;
  const progress = blocks.length > 0 ? Math.round((completedCount / blocks.length) * 100) : 0;

  return (
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
        </div>
      )}

      {/* Vertical flowchart */}
      <div className="relative">
        {blocks.map((block, idx) => {
          const config = STATUS_CONFIG[block.status] || STATUS_CONFIG.not_started;
          const StatusIcon = config.icon;

          return (
            <div key={block.id}>
              {idx > 0 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-4 h-4 text-muted-foreground/50" />
                </div>
              )}
              <div className={`relative border rounded-lg p-3 transition-colors ${
                block.status === 'completed' ? 'border-green-500/30 bg-green-500/5' :
                block.status === 'in_progress' ? 'border-blue-500/30 bg-blue-500/5' :
                'border-border'
              }`}>
                <div className="flex items-start gap-3">
                  {!isReadOnly ? (
                    <button
                      onClick={() => handleStatusToggle(block)}
                      className="mt-0.5 shrink-0"
                      title="Click to change status"
                    >
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
                      <span className="font-medium text-sm">{block.title}</span>
                      <Badge variant="outline" className={`text-xs ${config.color}`}>
                        {config.label}
                      </Badge>
                    </div>
                    {block.description && (
                      <p className="text-xs text-muted-foreground mt-1">{block.description}</p>
                    )}
                    {block.resource_url && (
                      <a
                        href={block.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Resource Link
                      </a>
                    )}
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(block)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteBlock.mutate({ id: block.id, skill_track_id: trackId })}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {blocks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-3">
          No learning steps yet.{!isReadOnly && ' Add your first step below.'}
        </p>
      )}

      {/* Add Learning Step button */}
      {!isReadOnly && (
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
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
              <Button onClick={handleAdd} className="w-full" disabled={!form.title.trim() || createBlock.isPending}>
                {createBlock.isPending ? 'Adding...' : 'Add Step'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Development Links Section — below learning steps */}
      {(links.length > 0 || !isReadOnly) && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" />
              Development Links
            </span>
            {links.length > 0 && (
              <Badge variant="secondary" className="text-xs">{links.length}</Badge>
            )}
          </div>
          {links.length > 0 && (
            <div className="space-y-1.5">
              {links.map(link => {
                const typeConfig = LINK_TYPE_CONFIG[link.link_type] || LINK_TYPE_CONFIG.other;
                const LinkIcon = typeConfig.icon;
                return (
                  <div key={link.id} className="flex items-center gap-2 text-sm group">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate flex-1"
                    >
                      {link.title}
                    </a>
                    <Badge variant="outline" className="text-[9px] shrink-0">{typeConfig.label}</Badge>
                    {!isReadOnly && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeLink.mutate(link.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {links.length === 0 && (
            <p className="text-xs text-muted-foreground">No development links yet.</p>
          )}

          {/* Add Link button — inside the dev links section */}
          {!isReadOnly && (
            <Dialog open={isAddLinkOpen} onOpenChange={setIsAddLinkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full mt-1">
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
          )}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingBlock} onOpenChange={open => { if (!open) setEditingBlock(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Learning Step</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Step Name *</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Resource / Study Link</Label>
              <Input
                value={form.resource_url}
                onChange={e => setForm({ ...form, resource_url: e.target.value })}
              />
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={!form.title.trim() || updateBlock.isPending}>
              {updateBlock.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
