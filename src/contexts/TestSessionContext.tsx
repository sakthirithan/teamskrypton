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
      description: "All data created will be flagged as test data and won't affect production.",
    });
  }, [toast]);

  const endTestSession = useCallback(async () => {
    try {
      // Delete all test tasks using type assertion to bypass strict typing
      const tasksResult = await (supabase.from('tasks') as any).delete().eq('is_test', true);
      console.log('Tasks cleanup:', tasksResult);
      
      // Delete all test profiles
      const profilesResult = await (supabase.from('profiles') as any).delete().eq('is_test', true);
      console.log('Profiles cleanup:', profilesResult);
      
      // Delete all test workflow logs
      const logsResult = await (supabase.from('workflow_log') as any).delete().eq('is_test', true);
      console.log('Logs cleanup:', logsResult);
      
      // Delete all test approvals
      const approvalsResult = await (supabase.from('approvals') as any).delete().eq('is_test', true);
      console.log('Approvals cleanup:', approvalsResult);
      
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
