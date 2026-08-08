import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';

const Index = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  
  useSessionPersistence();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!isLoading && user) {
      navigate('/grouping/home', { replace: true });
    }

    // Safety timeout: if loading takes more than 3 seconds on native APK, navigate to /auth
    const timer = setTimeout(() => {
      if (!user) {
        navigate('/auth', { replace: true });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return null;
};

export default Index;
