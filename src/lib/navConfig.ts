import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Bell,
  Compass,
  Target,
  GraduationCap,
  ClipboardList,
  BookOpen,
  NotebookPen,
  MessageSquare,
  Repeat,
  ListChecks,
  Calendar,
  Coins,
  Vote,
} from 'lucide-react';

export interface NavCategory {
  id: string;
  category: string;
  items: NavRouteItem[];
}

export interface NavRouteItem {
  id: string;
  label: string;
  path: string;
  iconName: string;
  category: string;
  requiresLeadership?: boolean;
  requiresCaptainOrVice?: boolean;
  requiresManagePoints?: boolean;
}

export function getAvailableNavCategories(userPermissions: {
  isLeadership: boolean;
  isCaptainOrVice: boolean;
  canManagePoints: boolean;
}): NavCategory[] {
  const { isLeadership, isCaptainOrVice, canManagePoints } = userPermissions;

  const categories: NavCategory[] = [
    {
      id: 'myspace',
      category: 'MY SPACE',
      items: [
        { id: 'dashboard', label: 'Dashboard', path: '/grouping/home', iconName: 'LayoutDashboard', category: 'MY SPACE' },
        { id: 'my-calendar', label: 'My Calendar', path: '/grouping/calendar', iconName: 'Calendar', category: 'MY SPACE' },
        { id: 'overview', label: 'My Space', path: '/grouping/me', iconName: 'Compass', category: 'MY SPACE' },
        { id: 'skill-dev', label: 'Skill Development', path: '/grouping/me?tab=skills', iconName: 'Target', category: 'MY SPACE' },
        ...(isLeadership
          ? [{ id: 'reports', label: 'Reports', path: '/grouping/me?tab=feed-reports', iconName: 'TrendingUp', category: 'MY SPACE', requiresLeadership: true }]
          : []),
        { id: 'study-board', label: 'Study Board', path: '/grouping/me?tab=skill-dev', iconName: 'GraduationCap', category: 'MY SPACE' },
      ],
    },
    {
      id: 'psportal',
      category: 'PS PORTAL',
      items: [
        { id: 'ps-entries', label: 'PS Entries', path: '/grouping/me?tab=ps-entries', iconName: 'ClipboardList', category: 'PS PORTAL' },
        { id: 'ps-tracking', label: 'PS Tracking', path: '/grouping/ps', iconName: 'ClipboardList', category: 'PS PORTAL' },
        { id: 'leaderboard', label: 'Leaderboard', path: '/grouping/leaderboard', iconName: 'TrendingUp', category: 'PS PORTAL' },
      ],
    },
    {
      id: 'workspace',
      category: 'WORKSPACE',
      items: [
        { id: 'team', label: 'Team', path: '/team', iconName: 'Users', category: 'WORKSPACE' },
        ...(isLeadership
          ? [{ id: 'team-skills', label: 'Team Skills', path: '/grouping/skills', iconName: 'BookOpen', category: 'WORKSPACE', requiresLeadership: true }]
          : []),
        { id: 'reflections', label: 'Reflections', path: '/grouping/reflections', iconName: 'NotebookPen', category: 'WORKSPACE' },
        { id: 'notes', label: 'Notes', path: '/grouping/notes', iconName: 'MessageSquare', category: 'WORKSPACE' },
        { id: 'notifications', label: 'Notifications', path: '/grouping/notifications', iconName: 'Bell', category: 'WORKSPACE' },
      ],
    },
    {
      id: 'tracking',
      category: 'TRACKING',
      items: [
        { id: 'habits', label: 'Habits', path: '/grouping/habits', iconName: 'Repeat', category: 'TRACKING' },
        { id: 'todos', label: 'To-Do List', path: '/grouping/todos', iconName: 'ListChecks', category: 'TRACKING' },
        { id: 'polls', label: 'Polls', path: '/grouping/polls', iconName: 'Vote', category: 'TRACKING' },
      ],
    },
    {
      id: 'management',
      category: 'MANAGEMENT',
      items: [
        ...(isCaptainOrVice
          ? [{ id: 'sessions', label: 'Sessions', path: '/grouping/sessions', iconName: 'Calendar', category: 'MANAGEMENT', requiresCaptainOrVice: true }]
          : []),
        ...(canManagePoints
          ? [{ id: 'point-management', label: 'Point Management', path: '/grouping/management/points', iconName: 'Coins', category: 'MANAGEMENT', requiresManagePoints: true }]
          : []),
      ],
    },
  ];

  return categories.filter((c) => c.items.length > 0);
}

export function getAllAvailableNavItems(userPermissions: {
  isLeadership: boolean;
  isCaptainOrVice: boolean;
  canManagePoints: boolean;
}): NavRouteItem[] {
  const categories = getAvailableNavCategories(userPermissions);
  return categories.flatMap((c) => c.items);
}

export const ICON_COMPONENT_MAP: Record<string, any> = {
  LayoutDashboard,
  Users,
  TrendingUp,
  Bell,
  Compass,
  Target,
  GraduationCap,
  ClipboardList,
  BookOpen,
  NotebookPen,
  MessageSquare,
  Repeat,
  ListChecks,
  Calendar,
  Coins,
  Vote,
};
