import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';

interface TwoStatusButtonsProps {
  isCompleted: boolean;
  isLeadership: boolean;
  onSetCompleted: () => Promise<void>;
  onSetPending: () => Promise<void>;
  completedLabel?: string;
  pendingLabel?: string;
}

export function TwoStatusButtons({
  isCompleted,
  isLeadership,
  onSetCompleted,
  onSetPending,
  completedLabel = 'Completed',
  pendingLabel = 'Pending',
}: TwoStatusButtonsProps) {
  const [loadingState, setLoadingState] = useState<'completed' | 'pending' | null>(null);

  const handleCompletedClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingState) return;
    setLoadingState('completed');
    try {
      await onSetCompleted();
    } finally {
      setLoadingState(null);
    }
  };

  const handlePendingClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingState) return;
    setLoadingState('pending');
    try {
      await onSetPending();
    } finally {
      setLoadingState(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
      {/* Completed Button */}
      <Button
        size="sm"
        variant={isCompleted ? 'default' : 'outline'}
        disabled={!isLeadership || loadingState !== null}
        onClick={handleCompletedClick}
        aria-label="Set state to Completed"
        className={`h-7 px-2.5 text-[11px] font-bold gap-1 transition-all rounded-lg ${
          isCompleted
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm ring-1 ring-emerald-400'
            : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
        }`}
      >
        {loadingState === 'completed' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3 h-3 shrink-0" />
        )}
        <span>{completedLabel}</span>
      </Button>

      {/* Pending Button */}
      <Button
        size="sm"
        variant={!isCompleted ? 'default' : 'outline'}
        disabled={!isLeadership || loadingState !== null}
        onClick={handlePendingClick}
        aria-label="Set state to Pending"
        className={`h-7 px-2.5 text-[11px] font-bold gap-1 transition-all rounded-lg ${
          !isCompleted
            ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm ring-1 ring-amber-400'
            : 'border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
        }`}
      >
        {loadingState === 'pending' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RotateCcw className="w-3 h-3 shrink-0" />
        )}
        <span>{pendingLabel}</span>
      </Button>
    </div>
  );
}
