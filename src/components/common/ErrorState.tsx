import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`krypton-card p-6 sm:p-8 border border-destructive/20 bg-destructive/[0.02] dark:bg-destructive/[0.04] text-center flex flex-col items-center justify-center ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-sm sm:text-base font-bold text-foreground">{title}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        {description}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-3 gap-1 h-8 text-xs border-destructive/20 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
