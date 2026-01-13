export const ROLES = {
  TEAM_CAPTAIN: 'team_captain',
  VICE_CAPTAIN: 'vice_captain',
  STRATEGIST: 'strategist',
  TEAM_MANAGER: 'team_manager',
  TEAM_MEMBER: 'team_member',
} as const;

export type KryptonRole = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<KryptonRole, string> = {
  team_captain: 'Team Captain',
  vice_captain: 'Vice Captain',
  strategist: 'Strategist',
  team_manager: 'Team Manager',
  team_member: 'Team Member',
};

export const ROLE_DESCRIPTIONS: Record<KryptonRole, string> = {
  team_captain: 'Full system access and team oversight',
  vice_captain: 'Assist captain with team management',
  strategist: 'Plan and coordinate team strategies',
  team_manager: 'Manage daily operations and tasks',
  team_member: 'Execute assigned tasks',
};

export const LEADERSHIP_ROLES: KryptonRole[] = [
  'team_captain',
  'vice_captain',
  'strategist',
  'team_manager',
];

export const CAPTAIN_ROLES: KryptonRole[] = [
  'team_captain',
  'vice_captain',
];

export const TASK_STATUSES = {
  IDLE: 'idle',
  WORKING: 'working',
  COMPLETED: 'completed',
  PENDING: 'pending',
} as const;

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  completed: 'Completed',
  pending: 'Pending',
};

// Special direct-access emails that bypass approval
export const DIRECT_ACCESS_EMAILS = [
  'sakthim.ad24@bitsathy.ac.in',
  'rahulm.ad24@bitsathy.ac.in',
];

export const EMAIL_DOMAIN = '@bitsathy.ac.in';
export const ADMIN_EMAIL = 'theeranaustin@gmail.com';
