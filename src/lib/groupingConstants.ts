// Grouping Mode Constants - Isolated from PBL

export type AppMode = 'pbl' | 'grouping';

export type SessionStatus = 'active' | 'closed';

export type TargetScope = 'group' | 'individual';

export type TargetStatus = 'on_track' | 'at_risk' | 'behind';

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  active: 'Active',
  closed: 'Closed',
};

export const TARGET_SCOPE_LABELS: Record<TargetScope, string> = {
  group: 'Group Target',
  individual: 'Individual Target',
};

export const TARGET_STATUS_LABELS: Record<TargetStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
};

export function calculateTargetStatus(
  achievedPoints: number,
  targetPoints: number,
  daysRemaining: number,
  totalDays: number
): TargetStatus {
  if (targetPoints === 0) return 'on_track';
  
  const progressPercentage = (achievedPoints / targetPoints) * 100;
  const timePercentage = ((totalDays - daysRemaining) / totalDays) * 100;
  
  // If ahead of schedule
  if (progressPercentage >= timePercentage) return 'on_track';
  
  // If slightly behind (within 20%)
  if (progressPercentage >= timePercentage - 20) return 'at_risk';
  
  // Significantly behind
  return 'behind';
}

export function calculateSessionDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export function calculateDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
}
