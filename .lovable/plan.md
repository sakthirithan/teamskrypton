# Monitoring & Alerts — Full Restructure

## The real problem first

The Monitoring & Alerts tab writes to five tables that **do not exist** in the database:
`monitoring_targets`, `individual_monitoring_targets`, `daily_survey_responses`,
`monitoring_meeting_records`, `scheduled_monitoring_alerts`.

Today the code silently swallows those errors and falls back to `localStorage`. That is why targets,
meeting status, survey counts and scheduled alerts look saved but do not persist, do not sync between
users, and behave differently on each device. Nothing else in this plan works reliably until this is fixed.

So step one is creating those tables properly (with access rules), then removing every silent-failure
fallback so a genuine failure surfaces as a toast instead of fake success.

## New structure — one tabbed workspace

A single page with a sticky header (title, live status, search, Refresh, Targets, Send Alert) and five tabs.
Nothing else scrolls the whole page away — filters and bulk bar stay pinned.

```text
Monitoring & Alerts            [Live]  [search]  [Targets] [Send Alert]
[ Overview | Members | Alerts | Daily Survey | History ]
------------------------------------------------------------------
KPI chips (click to filter): Eligible / Completed / Missing / AP / PS / Survey / Meeting
------------------------------------------------------------------
tab content (only this region scrolls)
```

1. **Overview** — compliance snapshot: the KPI chips, team completion ring, today's biggest gaps,
   and a "needs attention" shortlist where each row has one-click actions.
2. **Members** — the matrix (table / list / cards, same three view modes as today) with inline
   editing of AP, PS, survey count and meeting status. Row click opens the **member drawer**.
3. **Alerts** — send now (all / filtered / selected members), plus automation rules and the
   scheduled-alert queue with cancel.
4. **Daily Survey** — the survey command center: who has responded, who hasn't, one-tap nudge,
   and the survey form for the current user.
5. **History** — recent changes: AP edits, PS/meeting/survey status flips, alerts sent, by whom and when.

## Member detail drawer — "everything in one place"

Click any member → side sheet (bottom sheet on mobile), no page navigation, no scroll hunting:

- Header: avatar, name, role, department, overall met/missing badge.
- **Edit all four criteria inline in the drawer**: AP points, PS status, survey count, meeting status —
  each saved on change, optimistically.
- **Per-member target overrides** edited right here (AP / PS / survey / meeting targets), so leads never
  have to leave for the Targets modal to change one person.
- Recent activity for that member (AP changes, PS entries, survey responses, alerts received).
- Footer actions: Send alert to this member, Request survey, Mark all complete.

## Alert automation rules

New `monitoring_alert_rules` table. A rule is: *criterion* (AP / PS / survey / meeting / any) +
*time of day* + *repeat* (once, weekdays, daily) + title/message. At the scheduled time the existing
dispatch worker evaluates who is still unmet and sends an actionable notification + push to exactly
those members. Rules list shows enabled/disabled toggle, last run, recipients last run, and delete.

Scheduled one-off alerts keep working, now stored in the database so every lead sees the same queue.

## Actionable notifications become editable

Today an actionable notification only offers `[Completed]` / `[Not Yet]`. It will gain an inline
**Update my details** panel so a member can fix their own numbers straight from the notification —
no going to the site → Targets tab → member row:

- AP achieved (if the member is allowed), PS done today, survey done, meeting attended.
- Submits in one tap, updates the same records the monitoring tab reads, marks the notification resolved.
- Works from the Notifications page, the My Space notifications panel, and the deep link a push opens.

## Access

Members get the **full read-only view**: all tabs, all members, KPIs, drawer — but every editor,
bulk action, alert sender and rule control is hidden/disabled for them. Their own row and their own
actionable-notification updates remain editable.

## Instant UI/UX

- **Optimistic everything**: AP edits, PS/meeting/survey toggles, bulk actions, target changes and rule
  toggles all repaint immediately and roll back with a toast if the server rejects them.
- `placeholderData` so filter/tab switches never flash a skeleton; cached data renders first paint.
- Realtime subscriptions extended to the new tables (targets, survey, meeting, alerts) so one lead's
  edit appears on every other screen without a refresh.
- Debounced search, memoized rows, virtualized member list when the roster is large.
- Skeletons only on genuine first load.

## Technical notes

Database migration (one call, before any code):

- `monitoring_targets` — global AP / PS / survey / meeting targets, single active row.
- `individual_monitoring_targets` — per-user overrides, unique on `user_id`.
- `daily_survey_responses` — `user_id`, `survey_date`, `response_count`, answers JSON, unique on
  (`user_id`, `survey_date`).
- `monitoring_meeting_records` — `user_id`, `meeting_date`, `status`, unique on (`user_id`, `meeting_date`).
- `scheduled_monitoring_alerts` — title, message, `scheduled_at`, `target_filter`, `target_user_ids`,
  status, `created_by`.
- `monitoring_alert_rules` — criterion, `run_at_time`, repeat mode, title, message, enabled, `last_run_at`.
- `monitoring_audit_log` — actor, target user, field, old/new value, timestamp (powers the History tab).

Access rules: all authenticated users can read; only leadership (captain / vice captain / strategist /
team manager) can write. Each table gets grants to `authenticated` and `service_role`, RLS enabled,
and `updated_at` triggers.

Code:

- `useCentralizedMonitoring.ts` — drop `as any` casts and the `isMissingTableError` localStorage
  fallbacks, add optimistic `onMutate`/rollback to every mutation, add audit writes, extend realtime.
- New `useMonitoringAlertRules.ts` for rule CRUD and rule evaluation in the dispatch worker.
- `CentralizedMonitoring.tsx` split into `MonitoringHeader`, `MonitoringKpiBar`, and per-tab panels
  (`OverviewTab`, `MembersTab`, `AlertsTab`, `SurveyTab`, `HistoryTab`) — the current 1079-line page
  becomes a thin shell.
- New `MonitoringMemberDrawer.tsx`, `AlertRulesPanel.tsx`, `MonitoringHistoryPanel.tsx`.
- `NotificationActionPanel.tsx` — the inline self-update panel, reused by the notifications page and
  the My Space panel.
- Verification: typecheck plus a browser pass driving each tab, an inline edit, a drawer edit, a rule
  create and an actionable-notification update, confirming no console or network errors.
