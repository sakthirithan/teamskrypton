import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ModeSelectionDialog } from '@/components/auth/ModeSelectionDialog';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { AppMode } from '@/lib/groupingConstants';

import { ThemeToggle } from '@/components/theme/ThemeToggle';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const { user, isLoading } = useAuth();
  const { isModeSelected, setMode } = useAppMode();
  const navigate = useNavigate();

  // Show mode selection dialog when user logs in and mode not yet selected
  useEffect(() => {
    if (!isLoading && user && !isModeSelected) {
      setShowModeSelection(true);
    }
  }, [user, isLoading, isModeSelected]);

  // Handle mode selection - SINGLE source of navigation
  const handleModeSelect = (mode: AppMode) => {
    setMode(mode);
    setShowModeSelection(false);
    // Navigate based on selected mode - this is the ONLY place navigation happens
    navigate(mode === 'grouping' ? '/grouping/home' : '/', { replace: true });
  };

  // If user is logged in and mode already selected, redirect immediately
  useEffect(() => {
    if (!isLoading && user && isModeSelected) {
      navigate('/grouping/home', { replace: true });
    }
  }, [user, isLoading, isModeSelected, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user && isModeSelected) {
    return null;
  }

  // Show mode selection dialog when user is logged in but hasn't selected mode
  if (showModeSelection && user) {
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="krypton-gradient py-8 relative">
        <div className="absolute top-3 right-4 sm:right-6">
          <ThemeToggle className="text-primary-foreground hover:bg-primary-foreground/10" />
        </div>
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground mb-2">
            Teams Krypton
          </h1>
          <p className="text-primary-foreground/80">
            Where Work Becomes Visible
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>Internal Team Accountability Platform</p>
      </footer>
    </div>
  );
};

export default Auth;
