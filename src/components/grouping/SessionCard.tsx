import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  ChevronDown, 
  Check, 
  Lock,
  Target
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { calculateDaysRemaining, calculateSessionDays } from '@/lib/groupingConstants';
import { format } from 'date-fns';

interface SessionCardProps {
  sessions: GroupingSession[];
  activeSession?: GroupingSession;
  selectedSession?: GroupingSession;
  onSessionChange: (sessionId: string | null) => void;
}

export function SessionCard({ 
  sessions, 
  activeSession, 
  selectedSession,
  onSessionChange 
}: SessionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const viewingSession = selectedSession || activeSession;
  
  if (!viewingSession) {
    return null;
  }

  const totalDays = calculateSessionDays(viewingSession.start_date, viewingSession.end_date);
  const daysRemaining = calculateDaysRemaining(viewingSession.end_date);
  const daysElapsed = totalDays - daysRemaining;
  const progressPercent = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
  const isHistorical = viewingSession.status === 'closed';
  const hasMultipleSessions = sessions.length > 1;

  const handleSessionSelect = (sessionId: string) => {
    if (sessionId === activeSession?.id) {
      onSessionChange(null); // Reset to active session
    } else {
      onSessionChange(sessionId);
    }
    setIsOpen(false);
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${isHistorical ? 'bg-muted/20 border-border/50' : 'bg-card border-border/60'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium text-sm">
              #{viewingSession.session_number} · {viewingSession.name}
            </span>
            {isHistorical ? (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> Closed
              </span>
            ) : (
              <span className="text-[10px] font-medium text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 px-1.5 py-0.5 rounded">
                Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              {format(new Date(viewingSession.start_date), 'MMM d')} – {format(new Date(viewingSession.end_date), 'MMM d, yyyy')}
            </span>
            <span className="font-medium text-foreground/70">
              {isHistorical ? `${totalDays}d total` : `${daysRemaining}d left`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                isHistorical ? 'bg-muted-foreground/40' : 'bg-primary'
              }`}
              style={{ width: `${isHistorical ? 100 : progressPercent}%` }}
            />
          </div>
        </div>

        {hasMultipleSessions && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 h-8 text-xs">
                Switch
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <div className="p-2.5 border-b">
                <p className="text-sm font-medium">Select Session</p>
              </div>
              <ScrollArea className="max-h-[300px] overflow-y-auto">
                <div className="p-1">
                  {sessions.map((session) => {
                    const isActive = session.id === activeSession?.id;
                    const isSelected = session.id === viewingSession.id;
                    const isClosed = session.status === 'closed';
                    
                    return (
                      <button
                        key={session.id}
                        onClick={() => handleSessionSelect(session.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-md text-left text-sm transition-colors ${
                          isSelected 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              #{session.session_number} · {session.name}
                            </span>
                            {isActive && (
                              <span className="text-[10px] text-[hsl(var(--success))] bg-[hsl(var(--success))]/10 px-1.5 py-0.5 rounded">Active</span>
                            )}
                            {isClosed && !isActive && (
                              <Lock className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(session.start_date), 'MMM d')} – {format(new Date(session.end_date), 'MMM d')}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {isHistorical && (
        <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3 h-3 shrink-0" />
          <span>Read-only — historical data</span>
        </div>
      )}
    </div>
  );
}
