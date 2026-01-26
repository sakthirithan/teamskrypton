import { useState, useEffect, useRef } from 'react';
import { Layers, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AppMode } from '@/lib/groupingConstants';

interface ModeSelectionDialogProps {
  open: boolean;
  onSelectMode: (mode: AppMode) => void;
  disableAutoSelect?: boolean; // For Switch Mode from profile menu
}

const AUTO_SELECT_TIMEOUT = 60; // 60 seconds

export function ModeSelectionDialog({ open, onSelectMode, disableAutoSelect = false }: ModeSelectionDialogProps) {
  const [selectedMode, setSelectedMode] = useState<AppMode | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_SELECT_TIMEOUT);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const clearTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  // Auto-select Grouping after 60 seconds of inactivity (only if not disabled)
  useEffect(() => {
    if (!open || disableAutoSelect) {
      clearTimers();
      return;
    }

    // Reset state when dialog opens
    setSelectedMode(null);
    setIsConfirming(false);
    setCountdown(AUTO_SELECT_TIMEOUT);

    // Start countdown timer
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-select timer
    timerRef.current = setTimeout(() => {
      setSelectedMode('grouping');
      setIsConfirming(true);
      setTimeout(() => {
        onSelectMode('grouping');
      }, 300);
    }, AUTO_SELECT_TIMEOUT * 1000);

    return () => clearTimers();
  }, [open, disableAutoSelect, onSelectMode]);

  // Reset auto-select timer when user interacts (only if not disabled)
  const resetAutoSelect = () => {
    if (disableAutoSelect) return;
    
    clearTimers();
    setCountdown(AUTO_SELECT_TIMEOUT);

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    timerRef.current = setTimeout(() => {
      if (!selectedMode) {
        setSelectedMode('grouping');
        setIsConfirming(true);
        setTimeout(() => {
          onSelectMode('grouping');
        }, 300);
      }
    }, AUTO_SELECT_TIMEOUT * 1000);
  };

  const handleModeSelect = (mode: AppMode) => {
    setSelectedMode(mode);
    // Clear auto-select timer once user selects
    clearTimers();
  };

  const handleConfirm = () => {
    if (!selectedMode) return;
    setIsConfirming(true);
    clearTimers();
    // Small delay for UX feedback
    setTimeout(() => {
      onSelectMode(selectedMode);
    }, 300);
  };

  const progressValue = ((AUTO_SELECT_TIMEOUT - countdown) / AUTO_SELECT_TIMEOUT) * 100;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onClick={resetAutoSelect}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {disableAutoSelect ? 'Switch Mode' : 'Select Your Mode'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {disableAutoSelect 
              ? 'Select a new mode for this session.'
              : 'Choose how you want to work in this session.'}
          </DialogDescription>
        </DialogHeader>

        {/* Auto-select countdown indicator - only when not disabled */}
        {!disableAutoSelect && !selectedMode && countdown > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Auto-selecting Grouping Mode in</span>
              <span className="font-medium">{countdown}s</span>
            </div>
            <Progress value={progressValue} className="h-1" />
          </div>
        )}

        <div className="grid gap-4 py-4">
          {/* PBL Mode Option */}
          <button
            onClick={() => handleModeSelect('pbl')}
            className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
              selectedMode === 'pbl'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-muted hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            <div className={`p-4 rounded-full ${
              selectedMode === 'pbl' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <Layers className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">PBL – Project Mode</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Task management, workflows, and project tracking
              </p>
            </div>
            {selectedMode === 'pbl' && (
              <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-primary" />
            )}
          </button>

          {/* Grouping Mode Option */}
          <button
            onClick={() => handleModeSelect('grouping')}
            className={`relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all ${
              selectedMode === 'grouping'
                ? 'border-primary bg-primary/5 shadow-md'
                : 'border-muted hover:border-primary/50 hover:bg-muted/50'
            }`}
          >
            <div className={`p-4 rounded-full ${
              selectedMode === 'grouping' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <Target className="w-8 h-8" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">Grouping – Targets Mode</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Session targets, PS skill entries, and point tracking
              </p>
            </div>
            {selectedMode === 'grouping' && (
              <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-primary" />
            )}
          </button>
        </div>

        <Button 
          onClick={handleConfirm} 
          disabled={!selectedMode || isConfirming}
          className="w-full"
          size="lg"
        >
          {isConfirming ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              Loading...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
