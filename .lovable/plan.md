# Profile Enable/Disable (Soft-Suspend) System

Team Captain (TC) and Vice Captain (VC) can toggle any user profile between **Active** and **Disabled**. Disabled users vanish from the entire app surface for everyone else, but the account is preserved and fully restorable — no data loss, no cascading deletes.

## Core Concept: "Soft Suspend"

A disabled profile is **hidden**, not deleted. Their historical contributions (tasks, PS entries, XP, projects, uploads, votes) remain intact in the database for audit/history, but they are filtered out of every live surface: team directory, ID cards, leaderboards, assignment dropdowns, mentions, polls, staffing, notifications targets, chats, marketplace, etc.

The disabled user themselves gets a **graceful lockout screen** on sign-in explaining their status — not a hard error.

## The "Flexible Option" — Two-Tier Disable

To make it flexible instead of binary, disable supports **two modes** set at toggle time:

1. **Hidden (default)** — user cannot sign in at all. Sees a "Profile Suspended" screen with the reason and who to contact. All their data stays hidden across the app.
2. **Read-Only Access** — user CAN sign in but lands in a restricted view: they can view their own historical data (own tasks, own points, own uploads, own reflections) but cannot create, edit, delete, vote, chat, or assign anything. Still hidden from every other user's view. Useful for graceful offboarding, exam breaks, or probation.

TC/VC can switch a user between the two modes or re-enable at any time. Optional auto-expiry date can be set (e.g. "disable until Jan 15") — profile auto-reactivates.

## Data Model

New columns on `profiles`:

- `is_disabled boolean default false`
- `disabled_mode text` — `null | 'hidden' | 'read_only'`
- `disabled_reason text` — shown to the user on their lockout screen
- `disabled_by uuid` — who toggled
- `disabled_at timestamptz`
- `disabled_until timestamptz` — optional auto-restore

New table `profile_status_history` — full audit log of every enable/disable action (who, when, mode, reason, duration) so TC/VC can review past suspensions.

## Enforcement Layers

Filtering must happen at **every** layer or disabled users leak through:

1. **Database (source of truth)** — a SQL helper `is_profile_active(uuid)` (SECURITY DEFINER, honors `disabled_until` auto-expiry). Every RLS SELECT policy on user-facing tables (profiles, tasks, projects, polls, marketplace_materials, grouping_notes, leaderboards' underlying tables, etc.) adds an `AND is_profile_active(user_id)` clause where appropriate, so even a crafted client query cannot see them.
2. **List queries** — hooks that fetch team rosters, assignees, mention pickers, staffing candidates, poll recipients, notification recipients all filter `is_disabled = false` (client-side belt-and-braces).
3. **ID Cards** — `KryptonIdCard` returns null for disabled users when rendered by anyone other than TC/VC in the management panel.
4. **Aggregates** — leaderboards, XP ranks, PS ranks, activity ranks, skill maps exclude disabled users so ranks don't have "ghost" entries.
5. **Auth gate** — `useAuth` checks the flag on session load. Hidden mode → signs the user out and shows suspension screen. Read-only mode → sets a global `readOnly` flag that guards every mutation hook and disables/hides action buttons.
6. **Edge functions** — `send-notification-email`, `send-push`, `poll-notify`, `approve-registration`, project-lead assignment, etc. skip recipients whose profile is disabled.

## Management UI

In **User Management** (opened from the top-right menu for TC/VC):

- Each user row gets a status pill: `Active` / `Hidden` / `Read-Only` (with countdown chip if `disabled_until` is set).
- New **Disable** action opens a dialog: mode radio (Hidden / Read-Only), reason textarea (required, shown to the user), optional "auto-restore on" date picker.
- **Enable** action re-activates instantly.
- New **Disabled Users** tab lists all currently suspended profiles with mode, reason, days remaining, and quick actions (Change Mode, Extend, Re-enable).
- **History** subtab shows the full `profile_status_history` audit trail.

TC/VC themselves cannot be disabled (guardrail in the SQL function). VC cannot disable TC. Only TC can disable another VC.

## User-Facing Suspension Screen

When a Hidden user tries to sign in, or a Read-Only user opens the app, they see a full-page card:

- "Your profile is currently suspended"
- Mode (Hidden / Read-Only)
- Reason (from `disabled_reason`)
- Auto-restore date if set
- Contact TC/VC (email link)
- For Read-Only: a "Continue in view-only mode" button that enters the app with mutations disabled

## Auto-Restore

A lightweight scheduled edge function (or on-load check in `useAuth`) flips `is_disabled` back to `false` when `disabled_until < now()`. Cheap: driven by a single index on `disabled_until`.

## Technical Details

**Migration**

- ALTER `profiles` add the 5 new columns + index on `(is_disabled, disabled_until)`.
- CREATE TABLE `profile_status_history` with GRANTs + RLS (TC/VC read; service_role write).
- CREATE FUNCTION `public.is_profile_active(_user_id uuid) RETURNS boolean` — returns true when `is_disabled = false` OR `disabled_until < now()`.
- CREATE FUNCTION `public.toggle_profile_status(...)` SECURITY DEFINER — validates caller is TC/VC, blocks self-disable and VC→TC disable, writes profile + history row atomically.
- Update SELECT RLS policies on: `profiles`, `tasks`, `project_members`, `poll_votes`, `grouping_notes`, `marketplace_materials`, `user_points`, `activity_points`, `skill_xp_log`, `ps_daily_entries` to include the active check where the target user is being surfaced to others.

**Frontend**

- New `useDisabledProfile()` hook + `ReadOnlyContext` provider wrapping the app. Every mutation hook checks `if (readOnly) throw`.
- New `SuspensionScreen.tsx` shown by `useAuth` when the loaded profile is disabled.
- New `DisableUserDialog.tsx` (mode + reason + until date).
- New `DisabledUsersTab.tsx` inside `UserListPanel`.
- Filter helper `filterActiveProfiles()` applied inside every roster/leaderboard/assignee hook.
- `KryptonIdCard` early-return null when `profile.is_disabled` and viewer is not TC/VC.

**Edge functions**

- Add `is_profile_active` check before adding a recipient in `send-notification-email`, `send-push`, `poll-notify`.
- New `auto-restore-profiles` cron edge function (daily) OR inline check in `useAuth` on session refresh — the latter avoids a scheduled function.

**Files touched** (approx.):

- Migration (1 new)
- `src/hooks/useAuth.tsx`, `src/hooks/useProjects.tsx`, `src/hooks/usePolls.tsx`, `src/hooks/useUserPoints.tsx`, `src/hooks/useActivityPoints.tsx`, `src/hooks/useMemberSkills.tsx`, and the other roster hooks — add active-profile filter
- `src/components/admin/UserListPanel.tsx` — add Disable action, Disabled tab, History tab
- `src/components/admin/DisableUserDialog.tsx` (new)
- `src/components/auth/SuspensionScreen.tsx` (new)
- `src/components/team/KryptonIdCard.tsx` — hide for disabled
- `src/context/ReadOnlyContext.tsx` (new) + wrap in `src/App.tsx`
- `src/pages/Team.tsx`, `src/components/grouping/LeaderboardPanel.tsx`, staffing/mention pickers — apply filter
- `supabase/functions/send-notification-email/index.ts`, `send-push/index.ts`, `poll-notify/index.ts` — recipient filter

## Rollout Order

1. Migration (schema + function + RLS updates).
2. Toggle UI + suspension screen (feature works end-to-end for Hidden mode).
3. Read-Only mode (ReadOnlyContext + mutation guards).
4. Auto-restore + audit history tab.
5. Edge function recipient filtering.  
  
Also, Remove GP Redeem Feature