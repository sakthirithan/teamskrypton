import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalScrollLayout } from '@/components/layout/GlobalScrollLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleSheetConfig } from '@/hooks/useGoogleSheetConfig';
import { useGoogleSheetData } from '@/hooks/useGoogleSheetData';

interface GoogleSheetDataCardProps {
  /** 'personal' shows only the user's matched row, 'table' shows all data */
  mode?: 'personal' | 'table';
  className?: string;
}

export function GoogleSheetDataCard({ mode = 'personal', className }: GoogleSheetDataCardProps) {
  const { activeConfig } = useGoogleSheetConfig();
  const { trackedData, allRows, userRow, isLoading, error, refetch, headers } = useGoogleSheetData(activeConfig);

  if (!activeConfig?.enabled) return null;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sheet className="w-4 h-4" />
            Live Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="w-4 h-4" />
            Sheet Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Personal mode: show user's tracked data as metric cards
  if (mode === 'personal') {
    const columns = activeConfig.tracked_columns;
    if (!userRow && columns.length === 0) return null;

    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Live Metrics
            </span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!userRow ? (
            <p className="text-sm text-muted-foreground text-center py-2">No data found for your profile.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {columns.map(col => (
                <div key={col} className="p-3 rounded-lg bg-muted/50 border space-y-1">
                  <p className="text-xs text-muted-foreground font-medium truncate">{col}</p>
                  <p className="text-lg font-semibold truncate">{trackedData[col] || 'N/A'}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Table mode: full data view for leadership
  const displayCols = activeConfig.tracked_columns.length > 0
    ? activeConfig.tracked_columns
    : headers;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Sheet className="w-4 h-4" />
            Sheet Data
            <Badge variant="secondary" className="text-xs">{allRows.length} rows</Badge>
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <GlobalScrollLayout maxHeight="400px" horizontal>
          <Table>
            <TableHeader>
              <TableRow>
                {displayCols.map(col => (
                  <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {allRows.map((row, idx) => (
                <TableRow key={idx}>
                  {displayCols.map(col => (
                    <TableCell key={col} className="whitespace-nowrap">
                      {row[col] || '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GlobalScrollLayout>
      </CardContent>
    </Card>
  );
}
