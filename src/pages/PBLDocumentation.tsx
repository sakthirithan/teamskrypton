import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { useAllProjectDocuments } from '@/hooks/usePBLExtras';
import { useProjects, useAllProfiles } from '@/hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Link2, FileCode, FileImage, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const DOC_TYPE_ICONS: Record<string, typeof FileText> = {
  link: Link2,
  github: FileCode,
  design: FileImage,
  document: FileText,
};

const PBLDocumentation = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { data: docs = [] } = useAllProjectDocuments();
  const { data: projects = [] } = useProjects();
  const { data: profiles = [] } = useAllProfiles();

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth');
  }, [user, isLoading, navigate]);

  if (isLoading || !user) return null;

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';
  const getProjectName = (projectId: string) => projects.find(p => p.id === projectId)?.name || 'Unknown';

  // Group by project
  const groupedDocs = docs.reduce<Record<string, typeof docs>>((acc, doc) => {
    if (!acc[doc.project_id]) acc[doc.project_id] = [];
    acc[doc.project_id].push(doc);
    return acc;
  }, {});

  return (
    <PBLLayout title="Documentation">
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Documentation & Links</h2>
          <Badge variant="outline" className="text-xs">{docs.length} items</Badge>
        </div>

        {Object.keys(groupedDocs).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No documents yet</h3>
              <p className="text-sm text-muted-foreground">Add documents and links from individual project pages</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedDocs).map(([projectId, projectDocs]) => (
            <Card key={projectId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 cursor-pointer hover:text-primary" onClick={() => navigate(`/pbl/projects/${projectId}`)}>
                  {getProjectName(projectId)}
                  <Badge variant="secondary" className="text-[10px]">{projectDocs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {projectDocs.map(doc => {
                    const TypeIcon = DOC_TYPE_ICONS[doc.doc_type] || FileText;
                    return (
                      <div key={doc.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
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
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PBLLayout>
  );
};

export default PBLDocumentation;
