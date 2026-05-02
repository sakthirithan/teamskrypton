# Golden Points Redeem — Study Material Marketplace

A new sidebar section where members **monetise their study materials** with Golden Points (GP). Uploaders set a daily price; buyers rent access for X days; content opens **inside an in-app secure viewer** with downloads, sharing and right-click blocked. This dramatically increases GP utility (currently only earned via challenges; never spent).

## Concept Overview

```text
Earner  ─►  Uploads material (link/PDF/repo) ─►  Sets GP/day price
                                                       │
Buyer   ─►  Browses / searches by keywords/tags  ─►  Picks N days  ─►  Pays N×price GP
                                                       │
                                  In-app secure viewer (expires automatically)
```

- Uploader receives 90% of GP paid; 10% goes to a "Team Treasury" wallet (sink to keep economy balanced).
- Materials can be: **PDFs**, **Google Drive links**, **YouTube**, **GitHub repos**, **generic URLs**, **images**.
- Viewer is mandatory — clicking a material card opens a modal viewer; the underlying URL is never exposed in the DOM as an anchor.

## Sidebar entry

New top-level item under Dashboard: **Golden Marketplace** (Coins icon), route `/grouping/marketplace`. Tabs inside:
1. **Browse** — search, filter by domain/keyword/price, sort by popularity/newest/cheapest.
2. **My Library** — materials the user has active access to (with countdown).
3. **My Uploads** — CRUD on own materials, earnings, view stats.
4. **Earnings** — GP earned, transaction log, treasury info.
5. **Leaderboard tile** — top earners / top sellers (re-uses existing leaderboard styling).

## Database (new tables)

All RLS-enforced. Migration creates:

- `marketplace_materials`
  - id, uploader_id, title, description, material_type (`pdf|drive|youtube|github|url|image`), source_url, thumbnail_url, keywords text[], domain, price_per_day int, min_days int default 1, max_days int default 30, status (`active|paused|removed`), view_count, purchase_count, avg_rating numeric, created_at, updated_at.
- `marketplace_keywords` (denormalised for fast search) OR use Postgres `tsvector` column + GIN index on title+description+keywords for ranked full-text search.
- `marketplace_purchases`
  - id, material_id, buyer_id, uploader_id, days_purchased, gp_paid, expires_at, created_at, status (`active|expired|refunded`). Unique partial index `(material_id, buyer_id) where status='active'` to prevent duplicate concurrent rentals (extends instead).
- `marketplace_reviews` — buyer_id, material_id, rating 1-5, comment, created_at.
- `marketplace_treasury` — single-row wallet tracking 10% commissions (visible to leadership).
- `marketplace_access_log` — material_id, user_id, action (`view|attempt_copy|attempt_download|attempt_print`), created_at — used for anti-piracy heuristics + analytics.

GP balance is already tracked by `useUserPoints`; we'll add an `operation_type='marketplace_spend' | 'marketplace_earn' | 'marketplace_refund'` to `points_history`.

## RLS / Security Model

- Anyone authenticated can SELECT `marketplace_materials` where `status='active'` (browse).
- Only uploader OR leadership can UPDATE/DELETE own materials. Leadership can moderate (remove inappropriate uploads).
- `marketplace_purchases`: buyer can SELECT own; uploader can SELECT purchases of their materials (for stats, no buyer name leaked beyond display name); leadership can view all.
- **All purchases go through an Edge Function** `marketplace-purchase` that:
  1. Verifies JWT.
  2. Locks the buyer's points row, validates balance ≥ days × price.
  3. Atomically: deducts buyer GP, credits uploader 90%, credits treasury 10%, creates purchase row with `expires_at = now() + days * 1 day` (extends if active purchase exists), inserts 3 `points_history` rows.
  4. Returns updated balances.
- `source_url` is **never returned by SELECT to non-owners**. We use a Postgres view `marketplace_materials_public` that omits `source_url`. Buyers retrieve the URL only via Edge Function `marketplace-access` which:
  1. Verifies active purchase (`expires_at > now()`).
  2. Returns a **short-lived signed token** (JWT, 5 min TTL) bound to `(user_id, material_id)`.
  3. Logs the view in `marketplace_access_log`.
- All viewer requests pass that token back; an Edge Function `marketplace-stream` validates token and proxies/redirects.

## In-App Secure Viewer

A single `<MaterialViewer>` modal/route renders content based on `material_type`:

| Type | Renderer | Anti-leak measures |
|---|---|---|
| PDF | `<iframe src="/api/marketplace-stream?token=…#toolbar=0&navpanes=0">` (Edge Function streams the bytes with `Content-Disposition: inline`, `X-Frame-Options: SAMEORIGIN`). | PDF.js viewer with print/download buttons removed; page rendered to canvas to defeat copy. |
| Google Drive | Edge Function fetches Drive **preview** URL (`/preview` variant, not `/view`) and proxies it inside iframe. | Google's own preview already disables download. We add overlay + sandbox attrs. |
| YouTube | Embed with `?rel=0&modestbranding=1&controls=1` in sandboxed iframe. | – |
| GitHub | Edge Function fetches repo file tree via GitHub API and renders read-only file browser inside the app (Markdown via `react-markdown`, code via `prismjs`). User never leaves site. | Clone/download buttons absent. |
| Generic URL | Sandboxed iframe (`sandbox="allow-scripts allow-same-origin"`, no `allow-downloads`, no `allow-popups`). | If site sets `X-Frame-Options: DENY`, we show a friendly fallback explaining material can't be embedded — uploader is asked to use a Drive/PDF mirror. |
| Image | Canvas-rendered (not `<img>` `src`), with watermark overlay. | – |

Viewer wrapper applies on the modal:
- `onContextMenu={e => e.preventDefault()}` (right-click block).
- `user-select: none`, `-webkit-touch-callout: none`.
- Overlay watermark layer with the buyer's name + email faintly tiled across the iframe (deters screenshots).
- Keyboard handler blocks `Ctrl/Cmd+S`, `Ctrl+P`, `PrintScreen`, `Ctrl+C` while viewer focused.
- `iframe` always has `sandbox` and `referrerPolicy="no-referrer"`; **no `download` attribute anywhere**.
- All material links rendered in cards are `<button>` elements that open the viewer — not `<a href>` — so URL never appears in DOM/inspect/copy-link.
- Live countdown badge shows time remaining; viewer auto-closes when `expires_at` passes.

> Honest limitation we'll document in the UI for uploaders: a determined user can still screenshot or photograph the screen. The combination of watermark + access logs + the GP cost makes piracy traceable and economically unattractive, but no web tech provides true DRM. We recommend uploaders price valuable content per-day rather than expose one-time PDFs.

## Auto-detection of Material Type

When the uploader pastes a URL we detect type client-side:
- `drive.google.com` → drive (auto-extract file id, switch to `/preview`).
- `youtube.com|youtu.be` → youtube (extract videoId).
- `github.com/<owner>/<repo>` → github.
- `.pdf` extension or `application/pdf` HEAD content-type → pdf.
- Image extensions → image.
- else → url.

Title/description/keywords can be auto-suggested via existing **Lovable AI Gateway** (`google/gemini-2.5-flash`) — Edge Function `marketplace-suggest-meta` takes the URL, returns title/keywords/short description for the uploader to accept/edit.

## Search

- Postgres `tsvector` column `search_vec` populated by trigger from `title || description || array_to_string(keywords,' ')`.
- GIN index. Browse tab uses `websearch_to_tsquery` with `ts_rank` ordering.
- Filters: domain (skill domain enum), price range (slider on GP/day), material type pill tabs.

## GP Economy Boost

To make GP feel valuable rather than vestigial:
1. **Spending sink**: marketplace is the first real GP spend.
2. **Treasury**: 10% commission accumulates; Team Captain can run periodic "treasury auctions" (special premium materials only treasury can unlock for the whole team) — future hook.
3. **Earner badges**: "First Sale", "1k GP Earned", "Top Seller of the Week" auto-awarded via existing badges framework.
4. **Featured slot**: uploader can "boost" a listing for 50 GP/day — shown at top of Browse. Self-spend reinforces sink.
5. **Refund safety**: if uploader removes material while purchases are active, the Edge Function refunds remaining days pro-rata.
6. **Bundle pricing**: optional `discount_pct_7d`, `discount_pct_30d` fields encourage longer rentals.

## Permissions Recap

- **Members**: upload, edit/delete own, buy, review, view active library.
- **Project Leads & Leadership**: same + moderate (remove/edit any), view treasury, view all purchases, ban an uploader.
- **Team Members (read-only mode)**: per existing constraint memory — they can browse and buy in their own workspace; cannot upload while viewing other workspaces.
- Closed-session lock does **not** apply (marketplace is global, not session-bound).

## Files to Create / Edit

**New files**
- `supabase/migrations/<ts>_marketplace.sql` — tables, RLS, view, tsvector trigger, indexes.
- `supabase/functions/marketplace-purchase/index.ts`
- `supabase/functions/marketplace-access/index.ts` (issues short-lived signed access token)
- `supabase/functions/marketplace-stream/index.ts` (proxies PDFs/Drive previews, validates token, sets headers)
- `supabase/functions/marketplace-suggest-meta/index.ts` (Lovable AI metadata helper)
- `src/hooks/useMarketplace.tsx` (TanStack Query: list, search, my-uploads, my-library, purchase mutation)
- `src/pages/GroupingMarketplace.tsx` (tabbed page)
- `src/components/marketplace/MaterialCard.tsx`
- `src/components/marketplace/MaterialViewer.tsx` (the secure modal)
- `src/components/marketplace/UploadMaterialDialog.tsx`
- `src/components/marketplace/PurchaseDialog.tsx` (day picker + price preview)
- `src/components/marketplace/MyLibraryList.tsx`
- `src/components/marketplace/EarningsPanel.tsx`
- `src/components/marketplace/SearchBar.tsx`
- `src/components/marketplace/WatermarkOverlay.tsx`

**Edited files**
- `src/components/grouping/GroupingSidebar.tsx` — add "Golden Marketplace" item with Coins icon under Dashboard.
- `src/App.tsx` — register `/grouping/marketplace` route.
- `src/hooks/useUserPoints.tsx` — add `marketplace_spend|earn|refund` operation types and helper `spendPoints`.
- `supabase/config.toml` — register new functions (verify_jwt=false, manual auth like the others).

## Edge Cases Handled

- Buyer extends an active rental → `expires_at` is *added to*, not replaced.
- Uploader edits price while a rental is active → existing purchase unaffected; new buyers see new price.
- Material removed → status→`removed`, hidden from browse, existing buyers retain access until expiry; refund optional via leadership.
- Buyer's own uploads are free to view (no purchase row needed; access function checks `uploader_id = auth.uid()`).
- Insufficient GP → friendly modal with "Earn more via Skill Challenges" link.
- Self-purchase blocked at function level.
- Race condition on points: handled via `for update` row lock inside the Edge Function transaction.

## Out of Scope (can be added later)

- Comments / Q&A thread on a material.
- Subscription bundles ("all materials by uploader X for 100 GP/month").
- Cross-team marketplace.
- Mobile-native PDF viewer hardening via Capacitor plugins.

After your approval I'll implement migrations, edge functions, hooks, and UI in one pass.