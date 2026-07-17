## Goal

When a user sends notifications through the Notification tab, deliver both an in-app notification AND an email (via Gmail App connector) to each selected recipient, using a clean Todoist-style template.

## Approach

Use the **Gmail App connector** (workspace-owned Gmail account, free, ~500/day, sends to any address). All notification emails go out from your connected Gmail as the "Krypton Space" sender.

## Steps

1. **Link Gmail App connector**
  - Connect via `standard_connectors--connect` (connector_id: `google_mail`) with scope `gmail.send`.
  - This exposes `LOVABLE_API_KEY` + `GOOGLE_MAIL_API_KEY` in edge functions and routes through the Lovable gateway (auto token refresh).
2. **New edge function `send-notification-email**` (`verify_jwt = false`, service-role client)
  - Input: `{ recipients: [{ user_id, title, message, type }] }` or a single recipient shape.
  - For each recipient:
    - Look up email via `auth.admin.getUserById` (service role) + full_name from `profiles`.
    - Build RFC-2822 MIME message with a Todoist-style HTML template (see below), base64url-encode.
    - POST to `https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send` with gateway auth headers.
  - Sends run in parallel with `Promise.allSettled`; returns per-recipient success/failure.
  - Uses shared CORS headers; validates input with zod.
3. **Todoist-style HTML template** (inline styles, single file inside the edge function)
  - White background, max-width 560px card, subtle border.
  - Header: small "Krypton Space" wordmark + type badge (info/success/warning colored pill).
  - Body: bold title (Segoe UI/Inter), message paragraph, muted meta line ("Sent by {sender} • {date}").
  - CTA button "Open Krypton Space" → published URL.
  - Footer: small muted text with app name and a note that this is an automated message. No unsubscribe link (internal team app).
4. **Wire `SendNotificationDialog**`
  - After the existing in-app insert into `grouping_notifications` succeeds for the selected recipients, call `supabase.functions.invoke('send-notification-email', { body: { recipients: [...] } })` in the background (non-blocking).
  - Toast still shows "Notification sent" immediately; a second toast reports email delivery count once resolved (e.g. "Emailed 4/5 recipients").
  - Failures are logged but do not block the in-app notification.
5. **Sender identity**
  - `From: "Krypton Space" <your-connected-gmail@gmail.com>` (Gmail forces the connected account address; display name is customizable).
  - `Reply-To` set to the sender's own email so replies go to the human who triggered it.

## Technical notes

- Gmail App connector = builder's Gmail sends on behalf of the app (matches the free-plan requirement, no domain needed).
- Gateway auth: `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_MAIL_API_KEY}`.
- No new tables; no schema changes.
- No changes to `send-notification` (Resend function) — leaves the registration approval flow intact.

## Confirm before I build

- OK to use the **Gmail App connector** (your Gmail account as the sender for all app notifications)? okkey
- Sender display name: **"Teamskrypton"** — good, or different?  
also: Sender name