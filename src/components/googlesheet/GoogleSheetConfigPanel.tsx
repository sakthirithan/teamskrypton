import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GlobalScrollLayout } from '@/components/layout/GlobalScrollLayout';
import { Sheet, Settings2, Link2, RefreshCw, Trash2, CheckCircle, XCircle, Columns3 } from 'lucide-react';
import { useGoogleSheetConfig, GoogleSheetConfig } from '@/hooks/useGoogleSheetConfig';
import { useGoogleSheetData } from '@/hooks/useGoogleSheetData';
import { useAuth } from '@/hooks/useAuth';

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function GoogleSheetConfigPanel() {
  const { isCaptainOrVice, isLeadership } = useAuth();
  const { configs, activeConfig, createConfig, updateConfig, deleteConfig, canToggleEnabled } = useGoogleSheetConfig();
  const { headers: detectedHeaders, error: sheetError } = useGoogleSheetData(activeConfig);

  const [isOpen, setIsOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<GoogleSheetConfig | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [trackedColumns, setTrackedColumns] = useState<string[]>([]);
  const [rowLogicType, setRowLogicType] = useState<'match_username' | 'fixed_row' | 'last_row'>('match_username');
  const [usernameColumn, setUsernameColumn] = useState('');
  const [fixedRowNumber, setFixedRowNumber] = useState(2);
  const [refreshInterval, setRefreshInterval] = useState(15);

  useEffect(() => {
    if (editConfig) {
      setSheetUrl(editConfig.sheet_url);
      setSheetName(editConfig.sheet_name);
      setTrackedColumns(editConfig.tracked_columns);
      setRowLogicType(editConfig.row_logic_type);
      setUsernameColumn(editConfig.username_column || '');
      setFixedRowNumber(editConfig.fixed_row_number || 2);
      setRefreshInterval(editConfig.refresh_interval);
    }
  }, [editConfig]);

  const resetForm = () => {
    setSheetUrl('');
    setSheetName('Sheet1');
    setTrackedColumns([]);
    setRowLogicType('match_username');
    setUsernameColumn('');
    setFixedRowNumber(2);
    setRefreshInterval(15);
    setEditConfig(null);
  };

  const handleSave = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) return;

    const payload = {
      sheet_id: sheetId,
      sheet_name: sheetName,
      sheet_url: sheetUrl,
      tracked_columns: trackedColumns,
      row_logic_type: rowLogicType,
      username_column: rowLogicType === 'match_username' ? usernameColumn : null,
      fixed_row_number: rowLogicType === 'fixed_row' ? fixedRowNumber : null,
      refresh_interval: refreshInterval,
    };

    if (editConfig) {
      await updateConfig.mutateAsync({ id: editConfig.id, ...payload });
    } else {
      await createConfig.mutateAsync(payload as any);
    }
    resetForm();
    setIsOpen(false);
  };

  const toggleColumn = (col: string) => {
    setTrackedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  if (!isLeadership) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Sheet className="w-4 h-4" />
            Live Sheet Engine
          </span>
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Settings2 className="w-3.5 h-3.5 mr-1" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editConfig ? 'Edit' : 'New'} Sheet Configuration</DialogTitle>
              </DialogHeader>
              <GlobalScrollLayout maxHeight="65vh" className="pr-2">
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Google Sheet URL</Label>
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={e => setSheetUrl(e.target.value)}
                    />
                    {sheetUrl && !extractSheetId(sheetUrl) && (
                      <p className="text-xs text-destructive">Invalid Google Sheet URL</p>
                    )}
                    {sheetUrl && extractSheetId(sheetUrl) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        ID: {extractSheetId(sheetUrl)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Sheet Tab Name</Label>
                    <Input value={sheetName} onChange={e => setSheetName(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Row Logic</Label>
                    <Select value={rowLogicType} onValueChange={(v: any) => setRowLogicType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match_username">Match by Username</SelectItem>
                        <SelectItem value="fixed_row">Fixed Row Number</SelectItem>
                        <SelectItem value="last_row">Last Row (Dynamic)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {rowLogicType === 'match_username' && (
                    <div className="space-y-2">
                      <Label>Username Column Header</Label>
                      <Input
                        placeholder="e.g. Name, Username"
                        value={usernameColumn}
                        onChange={e => setUsernameColumn(e.target.value)}
                      />
                    </div>
                  )}

                  {rowLogicType === 'fixed_row' && (
                    <div className="space-y-2">
                      <Label>Row Number</Label>
                      <Input
                        type="number"
                        min={2}
                        value={fixedRowNumber}
                        onChange={e => setFixedRowNumber(parseInt(e.target.value) || 2)}
                      />
                    </div>
                  )}

                  {detectedHeaders.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Columns3 className="w-3.5 h-3.5" />
                        Track Columns ({trackedColumns.length} selected)
                      </Label>
                      <ScrollArea className="h-[140px] border rounded-md p-2">
                        <div className="space-y-1.5">
                          {detectedHeaders.map(header => (
                            <div
                              key={header}
                              className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleColumn(header)}
                            >
                              <Checkbox checked={trackedColumns.includes(header)} />
                              <span className="text-sm">{header}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {detectedHeaders.length === 0 && (
                    <div className="space-y-2">
                      <Label>Tracked Columns (comma-separated)</Label>
                      <Input
                        placeholder="Column1, Column2, Column3"
                        value={trackedColumns.join(', ')}
                        onChange={e => setTrackedColumns(
                          e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        Save config and re-open to auto-detect columns from the sheet.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Refresh Interval (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={refreshInterval}
                      onChange={e => setRefreshInterval(parseInt(e.target.value) || 15)}
                    />
                  </div>

                  <Button
                    onClick={handleSave}
                    className="w-full"
                    disabled={!sheetUrl || !extractSheetId(sheetUrl) || createConfig.isPending || updateConfig.isPending}
                  >
                    {(createConfig.isPending || updateConfig.isPending) ? 'Saving...' : editConfig ? 'Update Configuration' : 'Save Configuration'}
                  </Button>
                </div>
              </GlobalScrollLayout>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {configs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sheet configured. Click Configure to start.
          </p>
        ) : (
          <div className="space-y-3">
            {configs.map(config => (
              <div key={config.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {config.enabled ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{config.sheet_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {canToggleEnabled && (
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(v) => updateConfig.mutate({ id: config.id, enabled: v })}
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => { setEditConfig(config); setIsOpen(true); }}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </Button>
                    {isCaptainOrVice && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteConfig.mutate(config.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {config.row_logic_type.replace('_', ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {config.tracked_columns.length} cols
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {config.refresh_interval}m
                  </Badge>
                </div>

                {config.last_synced_at && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(config.last_synced_at).toLocaleString()}
                  </p>
                )}

                {sheetError && config.enabled && (
                  <p className="text-xs text-destructive">
                    Connection error: {sheetError.message}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
