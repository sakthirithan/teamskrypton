import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface GroupingNote {
  id: string;
  session_id: string;
  created_by: string;
  content: string;
  created_at: string;
  expires_at: string;
}

export interface GroupingNoteReply {
  id: string;
  note_id: string;
  created_by: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useGroupingNotes(sessionId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notes for a session
  const notesQuery = useQuery({
    queryKey: ['grouping-notes', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('grouping_notes')
        .select('*')
        .eq('session_id', sessionId)
        .gt('expires_at', now) // Only get non-expired notes
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as GroupingNote[];
    },
    enabled: !!user && !!sessionId,
  });

  // Fetch replies for all notes in a session
  const repliesQuery = useQuery({
    queryKey: ['grouping-note-replies', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      
      const { data: notes } = await supabase
        .from('grouping_notes')
        .select('id')
        .eq('session_id', sessionId);
      
      if (!notes || notes.length === 0) return [];
      
      const noteIds = notes.map(n => n.id);
      const { data, error } = await supabase
        .from('grouping_note_replies')
        .select('*')
        .in('note_id', noteIds)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as GroupingNoteReply[];
    },
    enabled: !!user && !!sessionId,
  });

  // Create a new note
  const createNote = useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId || !user) throw new Error('Session and user required');
      
      const { data, error } = await supabase
        .from('grouping_notes')
        .insert({
          session_id: sessionId,
          created_by: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notes', sessionId] });
      toast({ title: 'Note Added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update a note
  const updateNote = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data, error } = await supabase
        .from('grouping_notes')
        .update({ content })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notes', sessionId] });
      toast({ title: 'Note Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a note (creator only)
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('grouping_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notes', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['grouping-note-replies', sessionId] });
      toast({ title: 'Note Deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Create a reply
  const createReply = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      if (!user) throw new Error('User required');
      
      const { data, error } = await supabase
        .from('grouping_note_replies')
        .insert({
          note_id: noteId,
          created_by: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-note-replies', sessionId] });
      toast({ title: 'Reply Added' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update a reply
  const updateReply = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data, error } = await supabase
        .from('grouping_note_replies')
        .update({ content })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-note-replies', sessionId] });
      toast({ title: 'Reply Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete a reply (creator only)
  const deleteReply = useMutation({
    mutationFn: async (replyId: string) => {
      const { error } = await supabase
        .from('grouping_note_replies')
        .delete()
        .eq('id', replyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-note-replies', sessionId] });
      toast({ title: 'Reply Deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Get replies for a specific note
  const getRepliesForNote = (noteId: string) => {
    return repliesQuery.data?.filter(r => r.note_id === noteId) || [];
  };

  return {
    notes: notesQuery.data || [],
    replies: repliesQuery.data || [],
    isLoading: notesQuery.isLoading || repliesQuery.isLoading,
    error: notesQuery.error || repliesQuery.error,
    createNote,
    updateNote,
    deleteNote,
    createReply,
    updateReply,
    deleteReply,
    getRepliesForNote,
    refetch: () => {
      notesQuery.refetch();
      repliesQuery.refetch();
    },
  };
}
