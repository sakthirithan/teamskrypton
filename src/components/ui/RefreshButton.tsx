import { forwardRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  onClick: () => void;
  isRefreshing: boolean;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
}

export const RefreshButton = forwardRef<HTMLButtonElement, RefreshButtonProps>(
  ({ onClick, isRefreshing, className, size = 'sm', variant = 'ghost' }, ref) => {
    return (
      <Button 
        ref={ref}
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={isRefreshing}
        className={cn("h-8 w-8 p-0", className)}
        title="Refresh data"
      >
        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
      </Button>
    );
  }
);

RefreshButton.displayName = 'RefreshButton';
