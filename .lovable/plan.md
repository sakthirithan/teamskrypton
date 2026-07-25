## Part 1 — Fix "Generate Team" blank page

**Diagnosis (unconfirmed until we reproduce):** The most likely causes for the dialog going blank and members not appearing are:
- `usePollTeams` is called both in `PollCard` and inside `TeamDivisionDialog`, but after `saveDivision` runs it invalidates `['poll_teams']` without the poll id, so members can arrive before teams and render mismatched rows.
- The `allocate()` function throws on edge cases (0 voters, numTeams < options, `maxRank` spread on empty array under strict lint), unmounting the dialog subtree.
- No error boundary around the dialog, so any runtime error blanks the whole panel.

**Fixes:**
1. Wrap `TeamDivisionDialog` body in a local error boundary that shows the error text instead of unmounting the page.
2. Harden `allocate()`:
   - Guard `voters.length === 0` → return teams with a friendly "No voters yet" flag.
   - Replace `Math.max(1, ...voters.map(...))` with a safe reduce.
   - Coerce `numTeams`/`maxSize` to sane integers at entry.
3. Keep `usePollTeams(poll.id)` query keys scoped to `['poll_teams', pollId]` and `['poll_team_members', pollId]`, and invalidate both **with the poll id** in `saveDivision.onSuccess`. Also refetch immediately after save so team member rows appear without waiting on realtime.
4. In `PollCard`, render teams from a single source: after save, force a `queryClient.refetchQueries` for both keys so member names show up right away.
5. Make the "Divide Teams" trigger visible to the creator as soon as the poll has ≥1 voter (not gated on `isClosed`), with a warning banner if the poll is still open — the current gate is probably why some users think it "doesn't work".
6. Show an inline empty state inside the dialog when `voterCount === 0` instead of running the allocator.

**Files touched (frontend only):**
- `src/components/polls/TeamDivisionDialog.tsx` — hardened allocator, empty state, error boundary wrapper.
- `src/hooks/usePolls.tsx` — scope team invalidations by pollId, refetch on save.
- `src/components/polls/PollCard.tsx` — relax trigger gate, force refetch after save.

## Part 2 — Android APK with FCM push + background service

Feasible with the existing Capacitor setup. Route: **Capacitor + Firebase Cloud Messaging (FCM)**.

**What I'll add in this project (code + backend):**
1. Install `@capacitor/push-notifications` and `@capacitor-firebase/messaging`.
2. `src/lib/push.ts` — on native app boot: request permission, register with FCM, receive token, upsert to a new `device_tokens` table (`user_id`, `token`, `platform`, `last_seen`), and register foreground/background handlers to route taps to the right route (poll, notification, project).
3. New table `public.device_tokens` with RLS (owner-only insert/update/delete; service_role read).
4. New edge function `send-push`: takes `{ user_ids, title, body, data }`, looks up tokens, sends via FCM HTTP v1 using a service-account secret.
5. Wire existing notification insert paths (poll-notify, project lead assignment, `SendNotificationDialog`, alerts) to also invoke `send-push` alongside the email path — same recipient list, no duplication in the UI.
6. `capacitor.config.ts` — add `PushNotifications` plugin config; keep the hot-reload `server.url` block but document the production toggle.
7. Background support: FCM data-only messages wake the app via the Android messaging service (registered by the plugin). No extra native Java code needed for standard notification delivery; app icon + notification channel added via a small `res/` note in `docs/MOBILE_BUILD.md`.

**What you'll do locally (unchanged from the Capacitor flow already documented):**
1. `git pull`, `npm install`.
2. Create a Firebase project → add Android app with `applicationId = app.lovable.9f6c516d2ea644d189f41b98f40586c1` → download `google-services.json` → place in `android/app/`.
3. Generate a Firebase service-account JSON → paste into a new secret `FCM_SERVICE_ACCOUNT_JSON` via the secret form I'll open after you confirm this plan.
4. `npx cap add android`, `npm run build`, `npx cap sync`, `npx cap open android`, then Build → Build APK(s).

**Files touched (backend + native wiring):**
- New migration: `device_tokens` table with GRANTs, RLS, and index on `user_id`.
- New edge function: `supabase/functions/send-push/index.ts`.
- New client util: `src/lib/push.ts` + init call from `src/App.tsx` guarded by `Capacitor.isNativePlatform()`.
- `capacitor.config.ts` — add PushNotifications plugin block.
- `package.json` — add the two plugins.
- `docs/MOBILE_BUILD.md` — expand with the FCM setup steps.

**Technical notes:**
- Notifications continue to work in the browser via the existing in-app bell + email. Native push is additive.
- iOS is deliberately out of scope for this pass (needs APNs + Apple dev account). Structure is compatible when you add it later.
- No client-side FCM secrets — the service-account JSON stays server-side in the edge function.

**Not doing:**
- No changes to email templates, RLS beyond the new `device_tokens` table, or the existing poll allocation semantics beyond the hardening above.
- No iOS build.
- No offline PWA changes.

Approve to proceed and I'll switch to build mode, run the migration, and open the secret form for `FCM_SERVICE_ACCOUNT_JSON`.
