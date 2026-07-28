import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, LogOut, Mail, Clock, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface Props {
  /** When true, user chose Read-Only continue; render children in read-only mode */
  onContinueReadOnly?: () => void;
}

export function SuspensionScreen({ onContinueReadOnly }: Props) {
  const { profile, disabledMode, disabledReason, disabledUntil, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    window.location.href = '/auth';
  };

  const isReadOnly = disabledMode === 'read_only';

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/40">
      <Card className="w-full max-w-lg shadow-lg border-destructive/30">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-display">Profile Suspended</CardTitle>
          <div className="flex justify-center">
            <Badge variant={isReadOnly ? 'secondary' : 'destructive'} className="uppercase tracking-wide">
              {isReadOnly ? 'Read-Only Access' : 'Hidden'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border bg-muted/40">
            <p className="text-sm text-muted-foreground mb-1">Signed in as</p>
            <p className="font-semibold">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
          </div>

          {disabledReason && (
            <div className="p-4 rounded-lg border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm">{disabledReason}</p>
            </div>
          )}

          {disabledUntil && (
            <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Clock className="w-4 h-4 text-primary" />
              <span>Auto-restores on <strong>{format(new Date(disabledUntil), 'MMM d, yyyy')}</strong></span>
            </div>
          )}

          <div className="text-sm text-muted-foreground text-center">
            <Mail className="inline w-3.5 h-3.5 mr-1" />
            Contact your Team Captain for assistance.
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {isReadOnly && onContinueReadOnly && (
              <Button onClick={onContinueReadOnly} className="w-full">
                <Eye className="w-4 h-4 mr-2" />
                Continue in View-Only Mode
              </Button>
            )}
            <Button
              variant={isReadOnly ? 'outline' : 'default'}
              onClick={handleSignOut}
              disabled={signingOut}
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
