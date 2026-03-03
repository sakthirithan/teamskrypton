import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlobalScrollLayoutProps {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
  horizontal?: boolean;
}

/**
 * Universal scroll wrapper. Plug-and-play for any panel/dialog.
 * - Enables vertical scroll by default
 * - Optional horizontal scroll
 * - Prevents flex overflow breaking with min-w-0
 * - vh-based maxHeight for dialogs
 */
export function GlobalScrollLayout({
  children,
  className,
  maxHeight = '70vh',
  horizontal = false,
}: GlobalScrollLayoutProps) {
  return (
    <div
      className={cn(
        'min-w-0 overflow-y-auto',
        horizontal && 'overflow-x-auto',
        className
      )}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}
