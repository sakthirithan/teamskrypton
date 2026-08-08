import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface AppLoadingScreenProps {
  isLoading: boolean;
  onTimeoutRetry?: () => void;
}

export function AppLoadingScreen({ isLoading, onTimeoutRetry }: AppLoadingScreenProps) {
  const [statusIndex, setStatusIndex] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const statusMessages = [
    'Starting Teams Krypton...',
    'Loading workspace...',
    'Preparing your dashboard...',
  ];

  // Cycle status messages
  useEffect(() => {
    if (!isLoading) return;

    const timer1 = setTimeout(() => setStatusIndex(1), 700);
    const timer2 = setTimeout(() => setStatusIndex(2), 1600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isLoading]);

  // Safety timeout: 10 seconds
  useEffect(() => {
    if (!isLoading) {
      setIsFadingOut(true);
      const fadeTimer = setTimeout(() => setShouldRender(false), 500);
      return () => clearTimeout(fadeTimer);
    }

    setIsFadingOut(false);
    setShouldRender(true);

    const timeoutTimer = setTimeout(() => {
      setIsTimedOut(true);
    }, 10000);

    return () => clearTimeout(timeoutTimer);
  }, [isLoading]);

  if (!shouldRender) return null;

  const handleRetry = () => {
    if (onTimeoutRetry) {
      onTimeoutRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground transition-opacity duration-500 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Ambient Glow */}
      <div className="absolute w-72 h-72 rounded-full bg-primary/10 blur-3xl animate-pulse -z-10" />

      {/* Centered Container */}
      <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto space-y-6">
        {/* Animated Teams Krypton Logo */}
        <div className="relative group">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary/40 to-accent/40 blur-md opacity-75 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-card border border-border/80 shadow-xl flex items-center justify-center text-primary font-black text-2xl tracking-tighter transform transition-transform duration-700 animate-[bounce_2s_infinite]">
            <span className="bg-gradient-to-tr from-primary to-accent bg-clip-text text-transparent">
              TK
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-foreground font-display">
            Teams Krypton
          </h1>
          <p className="text-xs text-muted-foreground font-medium tracking-wide">
            Enterprise Collaboration Suite
          </p>
        </div>

        {/* Animated Progress Dots & Status */}
        {!isTimedOut ? (
          <div className="space-y-3 pt-2">
            {/* Animated Dots Bar */}
            <div className="flex items-center justify-center space-x-1.5">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx <= (statusIndex * 2)
                      ? 'bg-primary scale-110 shadow-[0_0_8px_hsl(var(--primary))]'
                      : 'bg-muted-foreground/30 scale-90'
                  }`}
                />
              ))}
            </div>

            {/* Dynamic Status Text */}
            <p className="text-xs font-medium text-muted-foreground animate-pulse min-h-[1.25rem]">
              {statusMessages[statusIndex]}
            </p>
          </div>
        ) : (
          /* Timeout Fallback UI */
          <div className="space-y-3 pt-2 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-center text-amber-500 gap-1.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4" />
              Taking longer than expected.
            </div>
            <Button
              size="sm"
              onClick={handleRetry}
              className="text-xs h-9 px-4 gap-2 font-semibold shadow-md"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
