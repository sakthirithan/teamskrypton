import * as React from 'react';
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

export const RefreshButton: React.FC<RefreshButtonProps> = ({ 
  onClick, 
  isRefreshing, 
  className,
  size = 'sm',
  variant = 'ghost'
}) => {
  return (
    <Button 
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
};
