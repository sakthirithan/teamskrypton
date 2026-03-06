import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';

const Index = () => {
  const { user, isLoading } = useAuth();
  const { isPBLMode, isGroupingMode, isModeSelected } = useAppMode();
  const navigate = useNavigate();
  
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
  }, [user, isLoading, isPBLMode, isGroupingMode, isModeSelected, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  // If mode not selected, the ModeSelectionDialog in Auth/Header will handle it
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default Index;
