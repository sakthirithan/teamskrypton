## Goals

1. Let uploaders set/edit a **thumbnail image** for each material.
2. Make the **Edit upload** dialog correctly prefill all previously saved values.
3. Add high-impact rental-marketplace features to **GP Redeem** that nudge users to rent (inspired by Airbnb / Udemy / Skillshare / Kindle Unlimited).

---

## 1. Thumbnails for uploads

`marketplace_materials.thumbnail_url` already exists in the type. We will use a public **Lovable Cloud storage bucket** so any user can upload an image for their own material.

**Migration**

- Create public bucket `marketplace-thumbnails`.
- RLS on `storage.objects`:
  - `select`: public (bucket is public).
  - `insert / update / delete`: only `auth.uid()` matching the file's first folder segment (`{user_id}/...`).

`**UploadMaterialDialog.tsx**`

- Add a "Thumbnail" field with:
  - File picker (image/* only, max ~2 MB, downscaled client-side via canvas to 800px wide WebP).
  - Live preview, "Remove" button, fallback to type-icon banner if empty.
  - On submit: upload to `marketplace-thumbnails/{user_id}/{materialId-or-uuid}.webp`, save `getPublicUrl()` into `thumbnail_url`.
- Auto-suggest: when AI Assist runs on YouTube links, also pull `https://img.youtube.com/vi/{id}/hqdefault.jpg` as a default thumbnail.

`**MaterialCard.tsx**`

- If `material.thumbnail_url` exists → render it as a 16:9 cover image in the header band; type-icon shrinks to a corner chip. Otherwise keep current gradient + big icon.

---

## 2. Edit dialog must show last-saved values

Current bug: `useState` defaults are initialized once when the dialog file mounts; opening Edit for a different row, or after a save, can show stale values.

Fix in `UploadMaterialDialog.tsx`:

- Wrap field state init in a `useEffect([editing, open])` that resets every field from the latest `editing` row when the dialog opens (including `thumbnail_url`, `domain`, `discount_pct_7d`, `discount_pct_30d`, `min_days`, `max_days`, `keywords`, etc.).
- On close, clear local state so a subsequent "Upload" opens clean.
- Keep `source_url` disabled in edit mode (already done) but show it.

---

## 3. GP Redeem — features to drive rentals

### a. Trust & social proof on every card

- ⭐ Average rating + review count (already partly there) — show as `4.8 ★ (23)`; add tooltip "Top rated this week" if avg ≥ 4.5 and ≥ 5 reviews.
- 🔥 **Trending badge** when `purchase_count` in last 7 days ≥ threshold (computed in hook from a lightweight query on `marketplace_purchases`).
- 👤 **Uploader chip** (avatar + name) clickable → opens their public profile.
- 🆕 "New" pill for materials created within 72 h.

### b. Urgency & savings

- **Discount ribbon**: if `discount_pct_7d > 0` show a corner ribbon "Save {n}% on 7-day rent". Same for 30 d.
- **Live "X people rented this week"** counter under the title.
- "Only Y GP — less than a coffee" microcopy under price.

### c. Risk-reversal CTAs

- Free **30-second preview** button on viewer (no GP charge, watermarked, locked after 30 s) — reuses `marketplace-access` with `action: 'preview'`; backend issues a 30 s temp grant. (Light implementation; if blocked iframe, fall back to "Open external preview").
- Show "Cancel anytime — no auto-renew" line in the Purchase dialog.

### d. Personalization

- **"Recommended for you"** strip at the top of Browse: filter by user's tracked skill domains (from `member_skills`) ordered by rating × popularity.
- **"Continue learning"** strip: active rentals in My Library that are < 24 h from expiry, with one-click *Extend +7 d* (auto-applies discount).
- **Wishlist / Save for later** ❤️ icon on each card — new table `marketplace_wishlist (user_id, material_id, created_at)` with simple RLS (owner-only).

### e. Gamification

- **Rental streak** chip in the hero: "3-day study streak — rent 1 more material this week to keep it." (Counts active rentals/day.)
- **First rental bonus**: if user has 0 rentals ever, show banner "Get 10 GP back on your first rent" (refund handled by `marketplace-purchase` edge fn checking purchase count).
- **Milestone toasts**: "🎉 5th rental this month — earned a 'Knowledge Seeker' badge."

### f. Discovery

- **Category chips row** below hero (DSA, Web, ML, System Design, Aptitude…) computed from existing `domain` values; clicking sets `filterType`/domain.
- **"Top this week" carousel** in Browse — top 5 by recent purchases, larger cards with cover image.
- **Smart search**: client-side highlight of matching keywords in title/description.

### g. Hero polish

- Replace static GP chip with a small ring showing "GP balance / cost of cheapest active material" so user instantly sees what they can afford.
- CTA "What's hot →" smooth-scrolls to the Top this week carousel.

---

## Technical details

### Files to edit

- `src/components/marketplace/UploadMaterialDialog.tsx` — thumbnail picker + reset effect.
- `src/components/marketplace/MaterialCard.tsx` — cover image, ribbons, trending/new badges, uploader chip, wishlist heart.
- `src/pages/GroupingMarketplace.tsx` — recommended/continue/top strips, category chips, hero ring.
- `src/hooks/useMarketplace.tsx` — add `wishlist`, `recommended`, `trending`, `weeklyRentals` queries; `toggleWishlist` mutation.
- `src/components/marketplace/PurchaseDialog.tsx` — "no auto-renew" copy, first-rental bonus hint.
- `src/components/marketplace/MaterialViewer.tsx` — 30 s preview mode.
- `supabase/functions/marketplace-access/index.ts` — accept `action: 'preview'`, issue 30 s grant without GP charge.
- `supabase/functions/marketplace-purchase/index.ts` — apply 10 GP refund on user's first successful rental.

### Migrations

1. Create public storage bucket `marketplace-thumbnails` + RLS.
2. New table `marketplace_wishlist (id, user_id, material_id, created_at)` + RLS (user CRUD own rows; uniqueness on `user_id,material_id`).
3. Index `marketplace_purchases (created_at desc)` for trending query.

### Design tokens

Stick to existing yellow/amber GP palette + emerald (active) + rose (expired). No new global tokens.

### Out of scope

- Real money payments, refunds beyond GP, multi-image galleries.  
  
🎨 UI/UX Improvements
  # 1. Hover Video Preview
  Like:
  - Netflix
  - Udemy
  Hover card:
  - auto-play 5s preview GIF/video or Description visibility through AI or Uploader's Description
  Massive conversion boost.
  ---
  # 2. Skeleton Loading
  For:
  - cards
  - thumbnails
  - carousels
  Makes app feel premium.