import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineStatusBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500/90 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 z-[100] relative">
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>You are currently offline. Showing cached application data.</span>
    </div>
  );
}
