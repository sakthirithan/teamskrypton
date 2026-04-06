import { memo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useProjectComments, useCreateComment, useDeleteComment, ProjectComment } from '@/hooks/usePBLExtras';
import { useAuth } from '@/hooks/useAuth';
import { useAllProfiles } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Send, Reply, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  projectId: string;
  taskId?: string;
  isProjectLead?: boolean;
}

export const ProjectCommentsPanel = memo(function ProjectCommentsPanel({ projectId, taskId, isProjectLead = false }: Props) {
  const { user, isLeadership } = useAuth();
  const canManage = isLeadership || isProjectLead;
  const { data: comments = [], refetch } = useProjectComments(projectId);
  const { data: profiles = [] } = useAllProfiles();
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`comments-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_comments', filter: `project_id=eq.${projectId}` }, () => {
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, refetch]);

  const filteredComments = taskId
    ? comments.filter(c => c.task_id === taskId)
    : comments.filter(c => !c.task_id);

  const topLevel = filteredComments.filter(c => !c.parent_id);
  const replies = (parentId: string) => filteredComments.filter(c => c.parent_id === parentId);

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';

  const handleSubmit = () => {
    if (!newComment.trim() || !user) return;
    createComment.mutate({
      project_id: projectId,
      user_id: user.id,
      content: newComment.trim(),
      ...(taskId && { task_id: taskId }),
    });
    setNewComment('');
  };

  const handleReply = (parentId: string) => {
    if (!replyContent.trim() || !user) return;
    createComment.mutate({
      project_id: projectId,
      user_id: user.id,
      content: replyContent.trim(),
      parent_id: parentId,
      ...(taskId && { task_id: taskId }),
    });
    setReplyContent('');
    setReplyTo(null);
  };

  const renderComment = (comment: ProjectComment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 border-l-2 border-border pl-3' : ''} py-2`}>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-semibold shrink-0 mt-0.5">
          {getName(comment.user_id).charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{getName(comment.user_id)}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm mt-0.5 whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-2 mt-1">
            {!isReply && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>
                <Reply className="w-3 h-3 mr-1" />Reply
              </Button>
            )}
            {(comment.user_id === user?.id || canManage) && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-destructive" onClick={() => deleteComment.mutate({ id: comment.id, projectId })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {/* Reply input */}
      {replyTo === comment.id && (
        <div className="ml-8 mt-2 flex gap-2">
          <Textarea
            value={replyContent}
            onChange={e => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="text-xs min-h-[60px]"
          />
          <Button size="sm" onClick={() => handleReply(comment.id)} disabled={!replyContent.trim()}>
            <Send className="w-3 h-3" />
          </Button>
        </div>
      )}
      {/* Render replies */}
      {replies(comment.id).map(r => renderComment(r, true))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Discussion {taskId ? '(Task)' : ''}
          <span className="text-xs text-muted-foreground font-normal">({topLevel.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* New comment */}
        <div className="flex gap-2 mb-4">
          <Textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="text-xs min-h-[60px]"
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
          />
          <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim() || createComment.isPending} className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Comments list */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin space-y-1 divide-y divide-border/50">
          {topLevel.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Start the discussion!</p>
          ) : (
            topLevel.map(c => renderComment(c))
          )}
        </div>
      </CardContent>
    </Card>
  );
});
