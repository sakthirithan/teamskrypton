/**
 * Shared visibility rules for user profiles.
 *
 * Suspended / hidden / read-only ("guarded") profiles must never appear in
 * normal user-facing surfaces: member lists, search, Messenger, groups,
 * activity assignment, calendar, incharge, communities, leaderboards and
 * notification recipient pickers.
 *
 * Use `VISIBLE_PROFILE_OR` with a Supabase `.or(...)` filter so the rule is
 * enforced server-side (rows where `is_disabled` is null are still visible),
 * or `filterVisibleProfiles` when the rows are already loaded.
 */
export const VISIBLE_PROFILE_OR = 'is_disabled.is.null,is_disabled.eq.false';

export function isProfileVisible(p: { is_disabled?: boolean | null } | null | undefined) {
  return !!p && p.is_disabled !== true;
}

export function filterVisibleProfiles<T extends { is_disabled?: boolean | null }>(rows: T[] | null | undefined): T[] {
  return (rows || []).filter((r) => r.is_disabled !== true);
}
