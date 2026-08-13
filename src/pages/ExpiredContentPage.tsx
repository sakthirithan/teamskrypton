import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, Bell } from 'lucide-react';

export default function ExpiredContentPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawPath = searchParams.get('path') || 'Content';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/50 to-background p-4">
      <Card className="max-w-md w-full border border-amber-500/30 bg-card/90 backdrop-blur-xl shadow-2xl">
        <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500 shadow-inner">
            <AlertCircle className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight">Content No Longer Available</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The activity, survey, or notification target you tapped (<code className="font-mono text-[11px] bg-muted px-1 py-0.5 rounded">{rawPath}</code>) is expired, deleted, or no longer available.
            </p>
          </div>

          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Button
              variant="default"
              className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 font-bold"
              onClick={() => navigate('/grouping/notifications')}
            >
              <Bell className="w-4 h-4" /> Go to Notifications
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 font-bold"
              onClick={() => navigate('/grouping/home')}
            >
              <Home className="w-4 h-4" /> Return to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
