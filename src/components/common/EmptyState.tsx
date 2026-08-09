import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`krypton-card p-8 sm:p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-border/80 bg-card/40 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground/60">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm" className="mt-4 gap-1.5 shadow-sm text-xs font-semibold">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
