# Automated Search-Engine Distribution + Ready-to-Post Content Queue

Goal: every new or refreshed page on Meetup gets pushed to search engines automatically, and each day the admin gets a queue of ready-to-post promo content to publish manually. No auto-posting, no link spam — this stays inside Google Search Essentials.

## 1. Auto-submission to search engines

- **IndexNow (Bing, Yandex, Naver, Seznam)**: replace the current single sitemap ping with real per-URL submission. A key file is served at `/<key>.txt`, and after each engine run every created, refreshed, or archived URL is submitted in one batched request.
- **Google Search Console**: sitemap is submitted automatically only when its contents actually change (not on every run), through the Search Console connector. If the connector or a verified property is missing, the run records that and skips instead of failing.
- **Retry/backoff**: failed submissions are stored and retried on the next run; 429 responses honour `Retry-After`, 403 stops the batch.

## 2. Sitemap upgrades

- Split into a sitemap index: pages sitemap, rooms sitemap, and a news-style recent-content sitemap so fresh pages get crawled sooner.
- Add an **RSS/Atom feed** at `/feed.xml` listing newest explore pages — feeds are legitimately picked up by readers, aggregators and crawlers.
- `robots.txt` gains the sitemap index directive.

## 3. Daily promo content queue (manual publishing)

- New table `seo_promos`: one row per generated promo, with channel, headline, body, hashtags, target URL, status (`queued` / `posted` / `skipped`).
- Each engine run generates promo variants for the day's new pages via the existing AI gateway: short post (X/Threads), WhatsApp/Telegram blurb, Reddit-safe descriptive text (no link-drop phrasing), and a one-line meta blurb.
- Content rules baked into the prompt: factual, no fake stats, no clickbait, no repeat-spam wording, always disclose it's an 18+ anonymous chat platform.

## 4. Admin surface

Extend `/seo-dashboard` with:
- **Distribution panel**: last IndexNow batch, URLs submitted, Search Console sitemap status (submitted/errors/warnings counts as reported, with no invented causes), pending retries.
- **Promo queue**: cards with copy-to-clipboard per channel, mark as posted/skip, filter by channel and date.
- **Setup checklist**: Search Console connection state, sitemap submitted, IndexNow key live, feed reachable.

## 5. Per-page share affordances

Explore pages and room pages get a small share row (WhatsApp, X, Telegram, copy link) plus correct self-referencing `og:url` and canonical, so shares render proper previews.

## Technical notes

- Engine changes live in `src/lib/seo/engine.server.ts`, new `src/lib/seo/distribute.server.ts` (IndexNow + GSC calls) and `src/lib/seo/promos.server.ts` (AI promo generation).
- New routes: `src/routes/feed[.]xml.ts`, `src/routes/sitemap-index[.]xml.ts`, `src/routes/[indexnow-key][.]txt.ts`; existing `sitemap[.]xml.ts` and `robots[.]txt.ts` updated in place.
- Search Console calls go server-side only, using the connector gateway; property is resolved by listing verified properties at runtime and asking you to pick if more than one matches. Requires connecting Google Search Console — I'll open the connect card during the build.
- IndexNow key stored as a project secret; migration adds `seo_promos` and `seo_submissions` tables with GRANTs, RLS (admin-only read/write via `has_role`), and admin-only policies.
- No end-user data is used in promo content; only public page facts.

## Out of scope (deliberately)

Automated posting to forums, comment sections, directories, or link networks — that's spam and would get the domain penalized.
