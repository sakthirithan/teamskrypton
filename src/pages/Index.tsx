import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { ModeSelectionDialog } from '@/components/auth/ModeSelectionDialog';
import { AppMode } from '@/lib/groupingConstants';

const Index = () => {
  const { user, isLoading } = useAuth();
  const { isPBLMode, isGroupingMode, isModeSelected, setMode } = useAppMode();
  const navigate = useNavigate();
  const [showModeDialog, setShowModeDialog] = useState(false);
  
  useSessionPersistence();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
      return;
    }

    if (!isLoading && user && isModeSelected) {
      if (isPBLMode) {
        navigate('/pbl/dashboard', { replace: true });
      } else if (isGroupingMode) {
        navigate('/grouping/home', { replace: true });
      }
    }

    // User is logged in but mode not selected — show dialog
    if (!isLoading && user && !isModeSelected) {
      setShowModeDialog(true);
    }
  }, [user, isLoading, isPBLMode, isGroupingMode, isModeSelected, navigate]);

  const handleModeSelect = (mode: AppMode) => {
    setMode(mode);
    setShowModeDialog(false);
    navigate(mode === 'grouping' ? '/grouping/home' : '/pbl/dashboard', { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  if (showModeDialog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ModeSelectionDialog 
          open={true} 
          onSelectMode={handleModeSelect}
          disableAutoSelect={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default Index;
