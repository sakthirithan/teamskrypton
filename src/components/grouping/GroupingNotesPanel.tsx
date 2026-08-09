import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  Edit2, 
  Reply, 
  Clock,
  User,
  X,
  Check
} from 'lucide-react';
import { useGroupingNotes, GroupingNote, GroupingNoteReply } from '@/hooks/useGroupingNotes';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { WhatsAppText } from '@/components/ui/whatsapp-text';

interface Profile {
  user_id: string;
  full_name: string;
}

export function GroupingNotesPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { activeSession } = useGroupingSessions();
  const { 
    notes, 
    createNote, 
    updateNote, 
    deleteNote,
    createReply,
    updateReply,
    deleteReply,
    getRepliesForNote,
    refetch 
  } = useGroupingNotes(activeSession?.id);
  
  const [newNote, setNewNote] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  // Fetch team members for names
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const getMemberName = (userId: string) => {
    return teamMembers.find(m => m.user_id === userId)?.full_name || 'Unknown';
  };

  const getTimeRemaining = (expiresAt: string) => {
    const hoursLeft = differenceInHours(new Date(expiresAt), new Date());
    if (hoursLeft <= 0) return 'Expiring soon';
    if (hoursLeft < 24) return `${hoursLeft}h left`;
    return `${Math.floor(hoursLeft / 24)}d ${hoursLeft % 24}h left`;
  };

  const handleCreateNote = async () => {
    if (!newNote.trim()) return;
    await createNote.mutateAsync(newNote.trim());
    setNewNote('');
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editNoteContent.trim()) return;
    await updateNote.mutateAsync({ id: noteId, content: editNoteContent.trim() });
    setEditingNote(null);
    setEditNoteContent('');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Delete this note and all its replies?')) {
      await deleteNote.mutateAsync(noteId);
    }
  };

  const handleCreateReply = async (noteId: string) => {
    if (!replyContent.trim()) return;
    await createReply.mutateAsync({ noteId, content: replyContent.trim() });
    setReplyingTo(null);
    setReplyContent('');
  };

  const handleUpdateReply = async (replyId: string) => {
    if (!editReplyContent.trim()) return;
    await updateReply.mutateAsync({ id: replyId, content: editReplyContent.trim() });
    setEditingReply(null);
    setEditReplyContent('');
  };

  const handleDeleteReply = async (replyId: string) => {
    if (confirm('Delete this reply?')) {
      await deleteReply.mutateAsync(replyId);
    }
  };

  const startEditNote = (note: GroupingNote) => {
    setEditingNote(note.id);
    setEditNoteContent(note.content);
  };

  const startEditReply = (reply: GroupingNoteReply) => {
    setEditingReply(reply.id);
    setEditReplyContent(reply.content);
  };

  if (!activeSession) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          Notes & Discussion
          <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          {notes.length > 0 && (
            <Badge variant="secondary" className="ml-auto tabular-nums">
              {notes.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Note */}
        <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border/40">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Share an update, question, or announcement..."
            className="min-h-[80px] resize-none bg-background"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <Clock className="w-3 h-3 inline mr-1" />
              Notes auto-expire after 48 hours
            </p>
            <Button 
              size="sm" 
              onClick={handleCreateNote}
              disabled={createNote.isPending || !newNote.trim()}
            >
              <Send className="w-3 h-3 mr-1" />
              Post
            </Button>
          </div>
        </div>

        {/* Notes List */}
        {notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No notes yet. Start a discussion!</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
            {notes.map((note) => {
              const replies = getRepliesForNote(note.id);
              const isCreator = note.created_by === user?.id;
              const isEditing = editingNote === note.id;
              
              return (
                <div key={note.id} className="p-3 rounded-xl border bg-card/50 hover:bg-card transition-colors">
                  {/* Note Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium truncate">{getMemberName(note.created_by)}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {getTimeRemaining(note.expires_at)}
                      </Badge>
                      {isCreator && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => startEditNote(note)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Note Content */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        className="min-h-[60px] resize-none"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleUpdateNote(note.id)}>
                          <Check className="w-3 h-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingNote(null)}>
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <WhatsAppText text={note.content} className="text-sm" />
                  )}

                  {/* Replies */}
                  {replies.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-primary/20 space-y-2">
                      {replies.map((reply) => {
                        const isReplyCreator = reply.created_by === user?.id;
                        const isEditingThisReply = editingReply === reply.id;
                        
                        return (
                          <div key={reply.id} className="p-2.5 rounded-lg bg-muted/40">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-medium truncate">{getMemberName(reply.created_by)}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              {isReplyCreator && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5"
                                    onClick={() => startEditReply(reply)}
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 text-destructive"
                                    onClick={() => handleDeleteReply(reply.id)}
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {isEditingThisReply ? (
                              <div className="space-y-1">
                                <Textarea
                                  value={editReplyContent}
                                  onChange={(e) => setEditReplyContent(e.target.value)}
                                  className="min-h-[40px] resize-none text-sm"
                                />
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-6 text-xs" onClick={() => handleUpdateReply(reply.id)}>
                                    Save
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingReply(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <WhatsAppText text={reply.content} className="text-xs" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reply Input */}
                  {replyingTo === note.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        className="min-h-[60px] resize-none text-sm"
                      />
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          onClick={() => handleCreateReply(note.id)}
                          disabled={createReply.isPending || !replyContent.trim()}
                        >
                          <Send className="w-3 h-3 mr-1" /> Reply
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyContent('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-7 text-xs"
                      onClick={() => setReplyingTo(note.id)}
                    >
                      <Reply className="w-3 h-3 mr-1" /> Reply
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
