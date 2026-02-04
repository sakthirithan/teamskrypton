import { memo } from 'react';
import { Coins } from 'lucide-react';
import { useUserPoints } from '@/hooks/useUserPoints';
import { cn } from '@/lib/utils';

interface PointsBadgeProps {
  userId?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Displays user points as a badge
 * Used in ID cards, My Space, and profile views
 */
export const PointsBadge = memo(function PointsBadge({
  userId,
  showLabel = true,
  size = 'md',
  className,
}: PointsBadgeProps) {
  const { getUserPoints } = useUserPoints();
  const points = getUserPoints(userId);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div 
      className={cn(
        'inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold',
        sizeClasses[size],
        className
      )}
    >
      <Coins className={iconSizes[size]} />
      <span>{points}</span>
      {showLabel && <span className="font-normal opacity-80">pts</span>}
    </div>
  );
});
