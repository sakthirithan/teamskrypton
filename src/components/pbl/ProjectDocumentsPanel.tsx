import { memo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectDocuments, useCreateDocument, useDeleteDocument } from '@/hooks/usePBLExtras';
import { useAuth } from '@/hooks/useAuth';
import { useAllProfiles } from '@/hooks/useProjects';
import { FileText, Plus, ExternalLink, Trash2, Link2, FileCode, FileImage, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface Props {
  projectId: string;
}

const DOC_TYPES = [
  { value: 'link', label: 'Link', icon: Link2 },
  { value: 'github', label: 'GitHub', icon: FileCode },
  { value: 'design', label: 'Design', icon: FileImage },
  { value: 'document', label: 'Document', icon: FileText },
];

export const ProjectDocumentsPanel = memo(function ProjectDocumentsPanel({ projectId }: Props) {
  const { user, isLeadership } = useAuth();
  const { data: docs = [] } = useProjectDocuments(projectId);
  const { data: profiles = [] } = useAllProfiles();
  const createDoc = useCreateDocument();
  const deleteDoc = useDeleteDocument();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [docType, setDocType] = useState('link');
  const [description, setDescription] = useState('');

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';

  const handleAdd = () => {
    if (!title.trim() || !url.trim() || !user) return;
    createDoc.mutate({
      project_id: projectId,
      title: title.trim(),
      url: url.trim(),
      doc_type: docType,
      description: description.trim() || undefined,
      uploaded_by: user.id,
    });
    setTitle('');
    setUrl('');
    setDescription('');
    setDocType('link');
    setShowForm(false);
  };

  const getTypeIcon = (type: string) => {
    const found = DOC_TYPES.find(d => d.value === type);
    return found ? found.icon : FileText;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Documentation & Links
            <span className="text-xs text-muted-foreground font-normal">({docs.length})</span>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(!showForm)} className="h-7 text-xs">
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="space-y-2 mb-4 p-3 border border-border rounded-lg bg-muted/30">
            <Input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="text-xs h-8" />
            <Input placeholder="URL" value={url} onChange={e => setUrl(e.target.value)} className="text-xs h-8" />
            <Input placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} className="text-xs h-8" />
            <div className="flex items-center gap-2">
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(d => (
                    <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 text-xs" onClick={handleAdd} disabled={!title.trim() || !url.trim()}>
                Add
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
          {docs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No documents added yet</p>
          ) : (
            docs.map(doc => {
              const TypeIcon = getTypeIcon(doc.doc_type);
              return (
                <div key={doc.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors group">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <TypeIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-primary hover:underline truncate">
                        {doc.title}
                      </a>
                      <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                    </div>
                    {doc.description && <p className="text-[10px] text-muted-foreground mt-0.5">{doc.description}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{doc.doc_type}</Badge>
                      <span className="text-[10px] text-muted-foreground">by {getName(doc.uploaded_by)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  {(doc.uploaded_by === user?.id || isLeadership) && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => deleteDoc.mutate({ id: doc.id, projectId })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
});
