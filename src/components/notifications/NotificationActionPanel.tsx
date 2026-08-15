import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileCheck, ArrowRight } from 'lucide-react';

interface NotificationActionPanelProps {
  notificationId?: string;
  metadata?: Record<string, any>;
  onSuccess?: () => void;
}

export function NotificationActionPanel({ onSuccess }: NotificationActionPanelProps) {
  const navigate = useNavigate();

  const handleTakeSurvey = () => {
    navigate('/grouping/monitoring?open=survey');
    if (onSuccess) onSuccess();
  };

  return (
    <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
      <p className="text-[11px] font-medium text-muted-foreground">
        Self-update your monitoring status through Take Survey
      </p>

      <Button
        size="sm"
        className="h-7 px-3 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs shrink-0"
        onClick={handleTakeSurvey}
      >
        <FileCheck className="w-3.5 h-3.5" />
        Take Survey
        <ArrowRight className="w-3 h-3" />
      </Button>
    </div>
  );
}
