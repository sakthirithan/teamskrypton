import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function CalendarSkeleton() {
  return (
    <div className="space-y-4 w-full animate-pulse">
      {/* Header bar skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card rounded-xl border border-border/60">
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Grid skeleton */}
      <Card className="glass-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <Skeleton className="h-6 w-48 rounded-md" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-border/20">
              <Skeleton className="h-4 w-16 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
