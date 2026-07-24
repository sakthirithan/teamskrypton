## 1. Fix "Send Notification" RLS error for members

Root cause: `grouping_notifications` currently has multiple overlapping INSERT policies, including a stale `"allow sending notifications"` policy that requires `auth.uid() = sender_id`. When the client insert races the trigger `set_sender_id` (or sends no `sender_id`), evaluation of that policy fails for non-leaders. There's also a leftover `"DEBUG insert"` policy that shouldn't be in production.

Migration:
- Drop stale/overlapping INSERT policies: `"DEBUG insert"`, `"Insert notifications"`, `"allow sending notifications"`, `"Authenticated users send notifications"`.
- Recreate a single clean INSERT policy: any authenticated user may send to any recipient (`auth.uid() IS NOT NULL AND recipient_id IS NOT NULL`).
- Ensure `set_sender_id` trigger exists as `BEFORE INSERT` so `sender_id` is always populated from `auth.uid()`.

## 2. Confirm notification triggers email

`SendNotificationDialog` already invokes `send-notification-email` after `sendNotification`. No change needed to that flow, but I'll verify the edge function still targets `teamskrypton@gmail.com` and add a small client-side toast on failure so it's visible.

## 3. Email Delivery Log — show failures only

- `EmailDeliveryLogPanel.tsx`: filter query to `status IN ('failed','pending')` (exclude `'sent'`).
- Update header copy to "Email Delivery Issues", stats grid to Failed / Pending / Retries only, empty-state to "No delivery issues — all emails sent successfully."
- Keep the 15s refetch and leadership-only visibility.

## 4. Polls — show team members after division

`PollCard.tsx` teams section already maps members but only renders the count. Update it to fetch profile names (reuse the profiles map already loaded in `TeamDivisionDialog`) and render a compact vertical member list per team card with avatar-initial chip + full name.

## 5. Polls — new features

### 5a. Ranked-preference team allocation (user-specified algorithm)
- Add `max_team_size` to the Team Division dialog (Number of teams + Max team size inputs).
- Extend `poll_votes` semantics: for multi-choice polls, ordering of a voter's votes by `created_at` already encodes rank (first click = Rank 1, etc.). No schema change needed.
- Rewrite `allocate()` in `TeamDivisionDialog.tsx`:
  1. Build voter → ranked preference list (ordered by vote `created_at`).
  2. Create N teams, each named after the top-N options (or `Team i` if `N > options`), capacity = `max_team_size`.
  3. Round-robin by rank: iterate rank 1..K; for each voter with an unplaced status, try to place into the team matching their current-rank option if that team has capacity.
  4. Any voter still unplaced after all ranks → assign to smallest team with remaining capacity (respect cap).
  5. If total voters exceed `N * max_team_size`, warn "capacity exceeded" and refuse to save.

### 5b. Re-shuffle / Regenerate
- Add a "Regenerate" button in the dialog that re-runs the algorithm with a different tiebreaker seed (deterministic shuffle of voter order) so leads can preview alternate balanced arrangements before saving.

### 5c. Export teams CSV
- Add "Export CSV" button on `PollCard.tsx` (visible when `teams.length > 0`). Builds `team_name,member_name,email` rows from teams/members/profile map and triggers a download.

### 5d. Anonymous voting
- Migration: add `polls.anonymous BOOLEAN DEFAULT false`.
- `CreatePollDialog.tsx`: add "Anonymous voting" switch.
- `PollCard.tsx`/algorithm: when anonymous, hide voter identity in any UI that would surface it (currently only counts are shown, so this is a display flag for future member lists in team teams; team allocation still uses real user IDs server-side but the poll card doesn't show who voted for what). Team division member names remain visible (assignments are the point).

### 5e. Optional email toggle per poll
- `CreatePollDialog.tsx`: replace unconditional email dispatch with a "Send email notification" switch (default on). When off, skip the `poll-notify` invocation but still create the poll.

## Files touched

- `supabase/migrations/<new>.sql` — RLS cleanup + `polls.anonymous`.
- `src/components/grouping/EmailDeliveryLogPanel.tsx` — failures-only view.
- `src/components/polls/TeamDivisionDialog.tsx` — ranked allocation + max size + regenerate + member names.
- `src/components/polls/PollCard.tsx` — render member names in teams + CSV export.
- `src/components/polls/CreatePollDialog.tsx` — anonymous + email toggle.
- `src/hooks/usePolls.tsx` — pass `anonymous` and `notify` flag through create.
