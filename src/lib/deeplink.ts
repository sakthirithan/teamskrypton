export const VALID_ROUTES = [
  '/',
  '/index.html',
  '/auth',
  '/team',
  '/my-space',
  '/profile/settings',
  '/grouping/home',
  '/grouping/me',
  '/grouping/skills',
  '/grouping/ps',
  '/grouping/reflections',
  '/grouping/notes',
  '/grouping/sessions',
  '/grouping/habits',
  '/grouping/todos',
  '/grouping/leaderboard',
  '/grouping/management/points',
  '/grouping/polls',
  '/grouping/incharge',
  '/grouping/calendar',
  '/grouping/notifications',
  '/grouping/monitoring',
  '/monitoring',
  '/notifications',
  '/pbl/dashboard',
  '/pbl/my-space',
  '/pbl/projects',
  '/pbl/analytics',
  '/pbl/docs',
  '/pbl/notifications',
  '/pbl/todos',
  '/pbl/polls',
  '/expired-content',
];

export const ROUTE_ALIASES: Record<string, string> = {
  '/daily-survey': '/grouping/monitoring?open=survey',
  '/survey': '/grouping/monitoring?open=survey',
  '/monitoring-alert': '/grouping/monitoring',
  '/monitoring': '/grouping/monitoring',
  '/activity': '/grouping/calendar',
  '/activities': '/grouping/calendar',
  '/calendar': '/grouping/calendar',
  '/sessions': '/grouping/sessions',
  '/session': '/grouping/sessions',
  '/habits': '/grouping/habits',
  '/habit': '/grouping/habits',
  '/todos': '/grouping/todos',
  '/todo': '/grouping/todos',
  '/leaderboard': '/grouping/leaderboard',
  '/polls': '/grouping/polls',
  '/poll': '/grouping/polls',
  '/messenger': '/grouping/notifications',
  '/chat': '/grouping/notifications',
  '/chats': '/grouping/notifications',
  '/announcement': '/grouping/notifications?chat_id=broadcast_announcement',
  '/announcements': '/grouping/notifications?chat_id=broadcast_announcement',
  '/projects': '/pbl/projects',
  '/project': '/pbl/projects',
  '/dashboard': '/grouping/home',
  '/home': '/grouping/home',
};

/**
 * Normalizes and resolves a raw notification deep-link URL or path into a valid app route.
 * Handles shorthand paths, query strings, dynamic IDs, and invalid routes safely.
 */
export function resolveDeepLink(rawPath?: string): string {
  if (!rawPath) return '/grouping/notifications';

  let cleanPath = rawPath.trim();

  // Strip protocol/domain if full URL was passed (e.g. http://localhost:8080/grouping/monitoring)
  try {
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      const url = new URL(cleanPath);
      cleanPath = url.pathname + url.search + url.hash;
    }
  } catch {}

  // Remove trailing slashes (except root '/')
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  // Parse path and query
  const [pathname, search] = cleanPath.split('?');
  const searchSuffix = search ? `?${search}` : '';

  // 1. Check exact aliases
  if (ROUTE_ALIASES[pathname]) {
    const aliased = ROUTE_ALIASES[pathname];
    if (searchSuffix && !aliased.includes('?')) {
      return aliased + searchSuffix;
    }
    return aliased;
  }

  // 2. Check exact valid routes
  if (VALID_ROUTES.includes(pathname)) {
    return pathname + searchSuffix;
  }

  // 3. Dynamic parameter route patterns
  if (pathname.startsWith('/member/')) return pathname + searchSuffix;
  if (pathname.startsWith('/profile/')) return pathname + searchSuffix;
  if (pathname.startsWith('/pbl/projects/')) return pathname + searchSuffix;

  // Dynamic Messenger Chat routes: /messenger/:chatId or /chat/:chatId -> /grouping/notifications?chat_id=:chatId
  if (pathname.startsWith('/messenger/') || pathname.startsWith('/chat/')) {
    const parts = pathname.split('/');
    const chatId = parts[parts.length - 1];
    if (chatId) return `/grouping/notifications?chat_id=${chatId}`;
    return '/grouping/notifications';
  }

  // Dynamic Activity routes: /activity/:id -> /grouping/calendar?activity_id=:id
  if (pathname.startsWith('/activity/') || pathname.startsWith('/activities/')) {
    const parts = pathname.split('/');
    const actId = parts[parts.length - 1];
    if (actId) return `/grouping/calendar?activity_id=${actId}`;
    return '/grouping/calendar';
  }

  // 4. Default fallback for unknown paths: Navigate gracefully to notifications rather than throwing 404
  console.warn('[DeepLink] Unknown route requested, redirecting to notifications fallback:', cleanPath);
  return '/grouping/notifications';
}
