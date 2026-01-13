import { useTestSession } from '@/contexts/TestSessionContext';
import { AlertTriangle } from 'lucide-react';

export function TestSessionBanner() {
  const { isTestMode } = useTestSession();

  if (!isTestMode) return null;

  return (
    <div className="bg-yellow-500 text-yellow-950 px-4 py-2 text-center font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
      <AlertTriangle className="w-5 h-5" />
      <span>TEST SESSION ACTIVE – DATA WILL NOT BE FINAL</span>
      <AlertTriangle className="w-5 h-5" />
    </div>
  );
}
