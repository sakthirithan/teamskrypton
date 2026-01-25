import { useAppMode } from '@/hooks/useAppMode';
import { cn } from '@/lib/utils';
import { Target, FolderKanban } from 'lucide-react';

interface ModeSwitchProps {
  className?: string;
}

export function ModeSwitch({ className }: ModeSwitchProps) {
  const { mode, setMode, isPBLMode, isGroupingMode } = useAppMode();

  return (
    <div className={cn(
      "flex items-center gap-1 p-1 rounded-lg bg-primary-foreground/10 backdrop-blur-sm",
      className
    )}>
      <button
        onClick={() => setMode('pbl')}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200",
          isPBLMode
            ? "bg-primary-foreground text-primary shadow-sm"
            : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
        )}
      >
        <FolderKanban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">PBL Mode</span>
        <span className="sm:hidden">PBL</span>
      </button>
      <button
        onClick={() => setMode('grouping')}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all duration-200",
          isGroupingMode
            ? "bg-primary-foreground text-primary shadow-sm"
            : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
        )}
      >
        <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Grouping</span>
        <span className="sm:hidden">GT</span>
      </button>
    </div>
  );
}
