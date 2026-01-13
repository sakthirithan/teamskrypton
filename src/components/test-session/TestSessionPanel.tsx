import { useTestSession } from '@/contexts/TestSessionContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlaskConical, Play, Square } from 'lucide-react';

export function TestSessionPanel() {
  const { isCaptainOrVice } = useAuth();
  const { isTestMode, startTestSession, endTestSession } = useTestSession();

  if (!isCaptainOrVice) return null;

  return (
    <Card className="border-dashed border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-yellow-600" />
          Test Session (Sandbox)
        </CardTitle>
        <CardDescription>
          Test features without affecting production data
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isTestMode ? (
          <Button 
            onClick={startTestSession} 
            className="w-full bg-yellow-600 hover:bg-yellow-700"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Test Session
          </Button>
        ) : (
          <Button 
            onClick={endTestSession} 
            variant="destructive"
            className="w-full"
          >
            <Square className="w-4 h-4 mr-2" />
            End Test Session
          </Button>
        )}
        
        {isTestMode && (
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="font-medium mb-2">You can now:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Create test tasks</li>
              <li>Test approvals & alerts</li>
              <li>Simulate workflows</li>
            </ul>
            <p className="mt-2 text-yellow-600 font-medium">
              All data will be deleted when session ends.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
