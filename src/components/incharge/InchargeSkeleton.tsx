import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function InchargeSkeleton() {
  return (
    <div className="space-y-4 w-full animate-pulse">
      {/* Top Banner Skeleton */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40 rounded" />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Skeleton className="h-20 w-56 rounded-lg" />
          <Skeleton className="h-20 w-56 rounded-lg" />
        </CardContent>
      </Card>

      {/* Tabs Skeleton */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* Content Skeleton */}
      <Card className="glass-card">
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-64 rounded" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}
