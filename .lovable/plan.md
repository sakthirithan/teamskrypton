## GP Redeem v3 — Full CRUD + Open-Anywhere + Power Features

Three intents in this request:

1. Make sure every uploader can fully CRUD their own uploads (with confirmations + UX polish).
2. Let viewers choose between **"Open inside app"** (current secure viewer) and **"Open in new tab"** when they have valid access — so renters can use the link in a real browser if they need to.
3. Add useful, well-thought-out features that increase the value of Golden Points and make the page feel like a real marketplace.

---

### 1. Full CRUD on My Uploads

Currently uploaders can edit, pause/resume, soft-delete. We'll harden it:

- **Delete confirmation dialog** (replacing native `confirm()`) with two clear options:
  - *Remove from listing* — sets `status='removed'`; existing renters keep access until expiry. (current behavior, kept)
  - *Hard delete* — only allowed when `purchase_count = 0` and no active rentals; permanently removes the row + access logs.
- **Edit dialog enhancement**: allow editing **all** safe fields (title, description, keywords, domain, price/day, min/max days, discounts, thumbnail). Source URL stays locked once published (already enforced) to prevent bait-and-switch on existing renters.
- **Inline status toggle** with a tiny toast explaining the effect ("Paused — hidden from Browse, existing renters still have access").
- **Bulk actions in My Uploads** (when more than 1 upload): Pause all / Resume all / Select-and-delete.
- **Upload validation**: block duplicate `source_url` for the same uploader (friendly error).

### 2. Open inside vs. Open in new tab

Renters/owners with valid access get **two buttons** on accessible cards and inside the viewer header:

- **Open inside app** — current secure `MaterialViewer` (sandbox iframe, watermark, blocked downloads/right-click, auto-close on expiry). Default for PDF/Drive/YouTube/image/url.
- **Go to web** — opens the real `source_url` in a new tab via `window.open(url, '_blank', 'noopener,noreferrer')`. We log this as `action='external_open'` in `marketplace_access_log` so uploaders/leadership can see it.

GitHub specifically: since GitHub blocks iframe embedding, the inside-app viewer will show a friendly "GitHub repos open best in a new tab" card with a single "Go to web" button — fixes the current dead-end UX.

Access still requires an active rental — both buttons call `marketplace-access` first to verify, so an expired user can't bypass via the new-tab button.

### 3. New high-value features

**a. Wishlist / Save for later**

- New `marketplace_wishlist` table `(user_id, material_id, created_at, unique)`.
- Heart icon on every browse card; new "Wishlist" tab with count badge.
- Notify wishlist users (in-app `grouping_notifications`) when the uploader drops the price or runs a flash sale.

**b. Flash sales & featured boosts (sinks for GP → drives GP demand)**

- Uploaders can pay GP from their balance to boost their listing:
  - **Featured for 24h** = 50 GP, **7d** = 250 GP. Uses existing `featured_until` column.
  - **Flash sale** = uploader sets a temp discount % + end date stored on the material.
- New edge function `marketplace-boost` handles atomic GP debit → update.

**c. Star ratings & reviews**

- Wire the existing `marketplace_reviews` table into the UI:
  - After a rental ends, prompt the renter to leave a 1–5 star review.
  - Show average rating, review count and latest 3 reviews on a new "Details" sheet that opens when clicking the title.
- Helpful for buyers; also drives quality (high-rated = more rentals = more GP for uploader).

**d. Free preview window**

- New material field `free_preview_minutes` (0–10). When set, anyone can open the material once for that many minutes; access auto-revokes. Tracked via `marketplace_purchases` rows with `gp_paid=0` and short `expires_at`.
- Encourages confident rentals.

**e. Earn more GP — Refer-a-Renter**

- When a buyer rents a material, the uploader gets a referral code. If a *new* renter clicks a uploader's share link and rents anything within 24h, the uploader gets +5 bonus GP. Stored in a small `marketplace_referrals` table.

**f. Smarter Browse**

- Sort dropdown: **Newest / Most rented / Top rated / Cheapest / Featured first** (currently hardcoded).
- "Trending now" row at the top of Browse — top 5 by purchases in the last 7 days.
- Server-side full-text search via the existing `search_vec` tsvector column (already in DB) — replaces the current `ilike` for far better matching of keywords/domain.

**g. Earnings tab upgrade**

- Real chart (last 30 days GP earned) using existing `points_history` filtered by `operation_type='marketplace'`.
- Per-material breakdown: rentals, GP earned, avg rating, conversion (views → rentals).
- "Payout pulse" card: 90% to you, 10% to treasury — running totals.

**h. Anti-abuse**

- Rate-limit material creation (max 5/day per user) via a check inside the existing insert RLS path — prevents spam.
- Min price floor of 1 GP/day, max 100 GP/day to keep economy healthy.

### 4. Technical changes

```text
DB migrations
├─ marketplace_wishlist (user_id, material_id, created_at, PK composite)
│   └─ RLS: own rows only
├─ marketplace_referrals (referrer_id, referred_buyer_id, material_id, awarded, created_at)
├─ marketplace_materials  (+ flash_sale_pct INT default 0,
│                          + flash_sale_until TIMESTAMPTZ,
│                          + free_preview_minutes INT default 0)
└─ Trigger: on marketplace_purchases insert where gp_paid=0 → mark as preview row

Edge functions
├─ marketplace-purchase (existing) — extend to handle preview (gp_paid=0, expires_at=now+preview_minutes)
├─ marketplace-boost     (NEW) — atomic GP debit + featured_until / flash_sale set
├─ marketplace-access    (existing) — also accept preview rentals; log external_open action
└─ marketplace-review    (NEW) — verify rental existed before insert; recompute rating_sum/count

Frontend
├─ MaterialCard: hasAccess → split "Open inside" + "Go to web" buttons; wishlist heart; flash-sale ribbon
├─ MaterialViewer: header gets "Open in new tab" link; GitHub friendly fallback
├─ GroupingMarketplace: Wishlist tab; sort dropdown; trending row; details sheet w/ reviews
├─ PurchaseDialog: show preview option if available; flash-sale price line
├─ BoostDialog (NEW): featured/flash sale purchase
├─ ReviewDialog (NEW): post-rental star + comment
└─ EarningsChart (NEW) inside Earnings tab
```

### 5. What stays the same

- Inside-app viewer remains the default secure path with watermark, sandbox, no downloads — unchanged for current users.
- Existing rentals, history, GP balances, and treasury logic are untouched.
- All new features additive; no breaking schema changes.

If you'd like, I can scope down to just **(1) + (2) + a/c/f** for a faster first ship, then layer the rest. Otherwise I'll implement everything above on approval.  
  
  
Also , Correct & Fix Inside-app Viewer use iframe for all type of materials & Files.If possible run Browser inside website