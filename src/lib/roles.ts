export type KryptonRole =
  | 'team_captain'
  | 'vice_captain'
  | 'strategist'
  | 'team_manager'
  | 'team_member';

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
