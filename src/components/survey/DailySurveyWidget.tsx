import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ClipboardCheck, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export function DailySurveyWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keyTakeaway, setKeyTakeaway] = useState('');
  const [challengeFaced, setChallengeFaced] = useState('');
  const [goalForTomorrow, setGoalForTomorrow] = useState('');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Query today's response
  const { data: todayResponse, isLoading: isLoadingToday } = useQuery({
    queryKey: ['daily-survey-today', user?.id, todayStr],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('daily_survey_responses' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('survey_date', todayStr)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Query weekly completion count
  const { data: weeklyCount = 0 } = useQuery({
    queryKey: ['daily-survey-weekly-count', user?.id, weekStart],
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from('daily_survey_responses' as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('survey_date', weekStart)
        .lte('survey_date', weekEnd);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const submitSurvey = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (!keyTakeaway.trim() || !goalForTomorrow.trim()) {
        throw new Error('Please fill out all required fields before submitting.');
      }

      const { data, error } = await supabase
        .from('daily_survey_responses' as any)
        .insert({
          user_id: user.id,
          survey_date: todayStr,
          responses: {
            keyTakeaway,
            challengeFaced,
            goalForTomorrow,
          },
          completed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-survey-today'] });
      queryClient.invalidateQueries({ queryKey: ['daily-survey-weekly-count'] });
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring'] });
      toast({
        title: 'Daily Survey Submitted',
        description: 'Your responses have been saved and your monitoring status has updated.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: err.message,
      });
    },
  });

  if (isLoadingToday) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6 h-40 flex items-center justify-center text-muted-foreground">
          Loading daily survey status...
        </CardContent>
      </Card>
    );
  }

  const isCompleted = !!todayResponse;

  return (
    <Card className="border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ClipboardCheck className="w-5 h-5 text-blue-500" />
            Daily PCDP Survey ({format(new Date(), 'EEEE, MMM d')})
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span>Weekly Completed:</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-bold">
              {weeklyCount} / 4
            </span>
          </div>
        </div>
        <CardDescription className="text-xs">
          Completing this survey automatically logs your daily progress record.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isCompleted ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-2 bg-emerald-500/10 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
            <h4 className="font-semibold text-emerald-700 dark:text-emerald-400">
              Survey Completed Today!
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Submitted at {format(new Date(todayResponse.completed_at), 'hh:mm a')}. Your status is updated.
            </p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSurvey.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Key Learning / Takeaway Today <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="What key skill or insight did you gain today?"
                value={keyTakeaway}
                onChange={(e) => setKeyTakeaway(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Obstacle / Challenge Faced (Optional)</Label>
              <Textarea
                placeholder="Any blocker or difficulty you encountered?"
                value={challengeFaced}
                onChange={(e) => setChallengeFaced(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Primary Goal for Tomorrow <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder="What is your main focus for tomorrow?"
                value={goalForTomorrow}
                onChange={(e) => setGoalForTomorrow(e.target.value)}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={submitSurvey.isPending || !keyTakeaway.trim() || !goalForTomorrow.trim()}
              className="w-full h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              {submitSurvey.isPending ? 'Submitting Survey...' : 'Submit Daily Survey'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
