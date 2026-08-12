import { Loader2, ArrowDown } from 'lucide-react';

export function PullToRefreshIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (!pull && !refreshing) return null;
  const visible = refreshing ? 44 : pull;
  return (
    <div
      className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150 md:hidden"
      style={{ height: visible }}
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur">
        {refreshing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Refreshing…
          </>
        ) : (
          <>
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
            {pull >= 35 ? 'Release to refresh' : 'Pull to refresh'}
          </>
        )}
      </div>
    </div>
  );
}
