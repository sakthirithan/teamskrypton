import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TestSessionContextType {
  isTestMode: boolean;
  startTestSession: () => Promise<void>;
  endTestSession: () => Promise<void>;
}

const TestSessionContext = createContext<TestSessionContextType | undefined>(undefined);

export function TestSessionProvider({ children }: { children: ReactNode }) {
  const [isTestMode, setIsTestMode] = useState(false);
  const { toast } = useToast();

  const startTestSession = useCallback(async () => {
    setIsTestMode(true);
    toast({
      title: "Test Session Started",
      description: "All data created will be flagged as test data (is_test = true) and won't affect production.",
    });
  }, [toast]);

  const endTestSession = useCallback(async () => {
    try {
      // Delete all test data in order (respecting foreign key constraints)
      
      // 1. Delete test approval votes first (references approvals)
      await supabase
        .from('approval_votes')
        .delete()
        .eq('is_test', true);
      
      // 2. Delete test task documents (references tasks)
      await supabase
        .from('task_documents')
        .delete()
        .eq('is_test', true);
      
      // 3. Delete test approvals
      await supabase
        .from('approvals')
        .delete()
        .eq('is_test', true);
      
      // 4. Delete test workflow logs
      await supabase
        .from('workflow_log')
        .delete()
        .eq('is_test', true);
      
      // 5. Delete test tasks
      await supabase
        .from('tasks')
        .delete()
        .eq('is_test', true);
      
      // 6. Delete test profiles last
      await supabase
        .from('profiles')
        .delete()
        .eq('is_test', true);
      
      setIsTestMode(false);
      
      toast({
        title: "Test Session Ended",
        description: "All test data has been cleaned up. Application restored to production state.",
      });
    } catch (error) {
      console.error('Error cleaning up test data:', error);
      toast({
        title: "Cleanup Warning",
        description: "Test session ended but some cleanup may have failed.",
        variant: "destructive",
      });
      setIsTestMode(false);
    }
  }, [toast]);

  return (
    <TestSessionContext.Provider value={{ isTestMode, startTestSession, endTestSession }}>
      {children}
    </TestSessionContext.Provider>
  );
}

export function useTestSession() {
  const context = useContext(TestSessionContext);
  if (context === undefined) {
    throw new Error('useTestSession must be used within a TestSessionProvider');
  }
  return context;
}
