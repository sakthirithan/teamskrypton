import { useState, useEffect, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallPrompt = forwardRef<HTMLDivElement>((_, ref) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed in session
    const wasDismissed = sessionStorage.getItem('pwa_prompt_dismissed');
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (!showPrompt || dismissed || !deferredPrompt) return null;

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="w-80 shadow-lg border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">Install Krypton Space</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Add to home screen for quick access and offline support.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstall} className="h-8">
                  <Download className="w-3 h-3 mr-1" />
                  Install
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8">
                  Not now
                </Button>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

PWAInstallPrompt.displayName = 'PWAInstallPrompt';
