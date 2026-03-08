import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <Card className={`${isHistorical ? 'border-muted bg-muted/20' : 'border-primary/20 bg-primary/5'}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3">
          {/* Session Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">
                Session #{viewingSession.session_number}
              </span>
              {isHistorical ? (
                <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">
                  <Lock className="w-2.5 h-2.5 mr-0.5" />
                  Closed
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">
                  Active
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="font-medium text-foreground/80">{viewingSession.name}</span>
              <span className="text-muted-foreground/40">•</span>
              <span>
                {format(new Date(viewingSession.start_date), 'MMM d')} – {format(new Date(viewingSession.end_date), 'MMM d, yyyy')}
              </span>
              <span className="text-muted-foreground/40">•</span>
              <span className="font-medium text-foreground">
                {isHistorical ? `${totalDays}d total` : `${daysRemaining}d left`}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  isHistorical ? 'bg-muted-foreground/50' : 'bg-primary'
                }`}
                style={{ width: `${isHistorical ? 100 : progressPercent}%` }}
              />
            </div>
          </div>

          {/* Session Switcher */}
          {hasMultipleSessions && (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  Switch
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="p-2 border-b">
                  <p className="text-sm font-medium">Select Session</p>
                  <p className="text-xs text-muted-foreground">
                    View historical session data
                  </p>
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
                          className={`w-full flex items-center justify-between p-2 rounded-md text-left text-sm transition-colors ${
                            isSelected 
                              ? 'bg-primary/10 text-primary' 
                              : 'hover:bg-muted'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                #{session.session_number} - {session.name}
                              </span>
                              {isActive && (
                                <Badge variant="outline" className="text-xs py-0 h-5">
                                  Active
                                </Badge>
                              )}
                              {isClosed && !isActive && (
                                <Lock className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(session.start_date), 'MMM d')} - {format(new Date(session.end_date), 'MMM d')}
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

        {/* Read-only indicator for historical sessions */}
        {isHistorical && (
          <div className="mt-3 p-2 rounded bg-muted/50 text-sm text-muted-foreground flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>Viewing historical data. Changes are not allowed.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
