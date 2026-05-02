import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Coins, TrendingUp, TrendingDown, History } from 'lucide-react';
import { useUserPoints, PointsHistory } from '@/hooks/useUserPoints';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface PointsDisplayProps {
  userId?: string;
  showHistory?: boolean;
  compact?: boolean;
}

/**
 * Displays user points with optional history
 * Used in My Space pages for both modes
 */
export const PointsDisplay = memo(function PointsDisplay({
  userId,
  showHistory = false,
  compact = false,
}: PointsDisplayProps) {
  const { user } = useAuth();
  const { getUserPoints, getUserHistory, canManagePoints } = useUserPoints();
  
  const targetUserId = userId || user?.id;
  const points = getUserPoints(targetUserId);
  const history = showHistory && canManagePoints ? getUserHistory(targetUserId || '') : [];

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
          <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Points</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{points}</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="w-5 h-5 text-amber-600" />
          My Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Points Display */}
        <div className="flex items-center justify-center p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border border-amber-200 dark:border-amber-800">
          <div className="text-center">
            <p className="text-4xl font-bold text-amber-700 dark:text-amber-400">{points}</p>
            <p className="text-sm text-amber-600/80 dark:text-amber-400/80">Total Points</p>
          </div>
        </div>

        {/* History Section */}
        {showHistory && history.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Recent Activity</span>
            </div>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {history.slice(0, 5).map((entry) => (
                  <HistoryEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

const HistoryEntry = memo(function HistoryEntry({ entry }: { entry: PointsHistory }) {
  const isPositive = entry.points_change >= 0;
  
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
      <div className="flex items-center gap-2">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-green-600" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-600" />
        )}
        <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
          {isPositive ? '+' : ''}{entry.points_change}
        </span>
        <Badge variant="outline" className="text-xs">
          {entry.operation_type}
        </Badge>
      </div>
      <span className="text-xs text-muted-foreground">
        {format(new Date(entry.created_at), 'MMM dd')}
      </span>
    </div>
  );
});
