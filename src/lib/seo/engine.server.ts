/**
 * SEO Growth Engine orchestrator.
 *
 * Runs the full daily pipeline:
 *   discover → filter → categorise → evidence check → generate → quality gate
 *   → publish → refresh → prune/redirect → internal links → ping → report
 *
 * White-hat guarantees enforced in code:
 *   - a page needs real supporting data (a live room / real members) to exist
 *   - <800 words, thin, stuffed, or event-fabricating drafts are rejected
 *   - duplicate slugs and duplicate content hashes are never published
 *   - obsolete pages are archived with a redirect target instead of left to rot
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { discoverKeywords, type KeywordCandidate } from "./discover.server";
import { distribute } from "./distribute.server";
import { queuePromosForPage } from "./promos.server";
import { generatePage, type PageEvidence, type RejectionReason } from "./generate.server";
import {
  CATEGORIES,
  CLUSTERS,
  MAX_PAGES_PER_RUN,
  MIN_REGION_MEMBERS,
  OBSOLETE_AFTER_DAYS,
  REFRESH_AFTER_DAYS,
  REGIONS,
  SITE_NAME,
  SITE_URL,
  normalizeKeyword,
  type ClusterKey,
} from "./taxonomy";

export interface EngineResult {
  runId: string | null;
  status: "completed" | "skipped" | "failed";
  keywordsFound: number;
  keywordsKept: number;
  pagesCreated: number;
  pagesUpdated: number;
  pagesArchived: number;
  rejected: number;
  trafficPotential: number;
  internalLinks: number;
  indexnowSubmitted: number;
  sitemapSubmitted: boolean;
  promosQueued: number;
  issues: string[];
  log: string[];
}

interface Target {
  slug: string;
  cluster: ClusterKey;
  evidence: PageEvidence;
  keywordMatchers: string[];
}

const DAY = 86_400_000;

export async function runSeoEngine(source: "cron" | "manual"): Promise<EngineResult> {
  // The generated Database types do not yet include the seo_* tables, so use
  // an untyped view of the admin client for these queries.
  const db = supabaseAdmin as unknown as SupabaseClient;
  const log: string[] = [];
  const issues: string[] = [];
  const push = (msg: string) => {
    log.push(`${new Date().toISOString()} — ${msg}`);
  };

  const result: EngineResult = {
    runId: null,
    status: "completed",
    keywordsFound: 0,
    keywordsKept: 0,
    pagesCreated: 0,
    pagesUpdated: 0,
    pagesArchived: 0,
    rejected: 0,
    trafficPotential: 0,
    internalLinks: 0,
    indexnowSubmitted: 0,
    sitemapSubmitted: false,
    promosQueued: 0,
    issues,
    log,
  };

  // Abuse / cost guard: at most one run per hour whatever the trigger.
  const { data: recent } = await db.from("seo_runs")
    .select("id,started_at")
    .order("started_at", { ascending: false })
    .limit(1);
  const last = recent?.[0];
  if (last && Date.now() - new Date(last.started_at as string).getTime() < 3_600_000) {
    push("Skipped — a run already happened within the last hour.");
    return { ...result, status: "skipped" };
  }

  const { data: runRow, error: runErr } = await db.from("seo_runs")
    .insert({ source, status: "running" })
    .select("id")
    .single();
  if (runErr || !runRow) {
    issues.push(`Could not start run: ${runErr?.message ?? "unknown"}`);
    return { ...result, status: "failed" };
  }
  result.runId = runRow.id as string;

  try {
    // ---------- 1. Evidence: what do we actually have? ----------
    const { data: rooms } = await db.from("rooms")
      .select("slug,name,description,category,emoji,is_official");
    const roomList = rooms ?? [];

    const { data: msgRows } = await db.from("room_messages").select("room_id");
    const messageTotal = msgRows?.length ?? 0;

    const { data: profileRows } = await db.from("profiles")
      .select("region,country,is_adult");
    const members = profileRows ?? [];
    const regionCounts = new Map<string, number>();
    for (const p of members) {
      const r = (p.region as string | null)?.toLowerCase();
      if (!r) continue;
      regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1);
    }
    push(`Evidence: ${roomList.length} rooms, ${members.length} members, ${messageTotal} room messages.`);

    // ---------- 2. Discovery + filtering ----------
    const { candidates, found, sources } = await discoverKeywords(
      roomList.map((r) => r.name as string),
      push,
    );
    result.keywordsFound = found;
    result.keywordsKept = candidates.length;
    push(`Discovery via ${sources.join(", ")}: ${found} raw phrases → ${candidates.length} on-topic keywords.`);

    if (candidates.length) {
      const { error } = await db.from("seo_keywords").upsert(
        candidates.map((c) => ({
          keyword: c.keyword,
          normalized: c.normalized,
          source: c.source,
          topic: c.topic,
          country: c.country,
          state: c.state,
          city: c.city,
          category: c.category,
          intent: c.intent,
          volume_estimate: c.volume_estimate,
          competition: c.competition,
          trend_score: c.trend_score,
          is_relevant: true,
          last_seen_at: new Date().toISOString(),
        })),
        { onConflict: "normalized" },
      );
      if (error) issues.push(`Keyword upsert: ${error.message}`);
    }

    // ---------- 3. Candidate pages, only where evidence exists ----------
    const targets: Target[] = [];

    for (const room of roomList) {
      targets.push({
        slug: `${room.slug}-online-community`,
        cluster: "community",
        keywordMatchers: [String(room.name), String(room.category ?? "")],
        evidence: {
          kind: "room",
          entity: `${room.name} — a live public room on ${SITE_NAME}`,
          roomSlug: room.slug as string,
          category: (room.category as string | null) ?? null,
          country: "India",
          facts: [
            `"${room.name}" is a real, live public chat room on ${SITE_NAME} at ${SITE_URL}/rooms/${room.slug}.`,
            room.description ? `Room description: ${room.description}` : `The room is in the ${room.category ?? "general"} category.`,
            `${SITE_NAME} is free, needs no phone number and no email, and pairs people for anonymous one-to-one video or text chat.`,
            `Members can also follow each other, then start private video or voice calls once the follow is mutual.`,
            `Safety features: report and block, 18+ age verification, live moderation for abuse, nudity and screen recording.`,
          ],
        },
      });
    }

    const categoriesWithRooms = new Set(
      roomList.map((r) => String(r.category ?? "").toLowerCase()).filter(Boolean),
    );
    for (const [key, cat] of Object.entries(CATEGORIES)) {
      const matching = roomList.filter(
        (r) => String(r.category ?? "").toLowerCase() === key || String(r.category ?? "").toLowerCase().includes(key),
      );
      if (!matching.length && !categoriesWithRooms.has(key)) continue;
      targets.push({
        slug: `${key}-communities-india`,
        cluster: "category",
        keywordMatchers: [key, cat.label, ...cat.seeds],
        evidence: {
          kind: "category",
          entity: `${cat.label} communities on ${SITE_NAME}`,
          category: key,
          country: "India",
          facts: [
            `${SITE_NAME} hosts ${matching.length} live public room(s) in the ${cat.label} space: ${matching.map((m) => m.name).join(", ") || "general rooms"}.`,
            `Rooms are online only — text chat plus anonymous one-to-one video matching. There are no ticketed or physical events.`,
            `Joining is free, anonymous, and needs no phone number or email.`,
            `Premium members can filter matches by region and gender; everyone gets random matching.`,
          ],
        },
      });
    }

    for (const [key, region] of Object.entries(REGIONS)) {
      const count = regionCounts.get(key) ?? regionCounts.get(region.city.toLowerCase()) ?? 0;
      if (count < MIN_REGION_MEMBERS) continue;
      targets.push({
        slug: `video-chat-${key}`,
        cluster: "region",
        keywordMatchers: [region.city, key, region.state],
        evidence: {
          kind: "region",
          entity: `${SITE_NAME} members in ${region.city}`,
          city: region.city,
          country: region.country,
          facts: [
            `${count} members on ${SITE_NAME} have set their region to ${region.city}, ${region.state}.`,
            `This is an online-only community page: members from ${region.city} chat by anonymous video and text on the platform. No physical meetups are organised.`,
            `Region-based match filtering is available to premium members; free members are matched randomly.`,
            `All chats are 18+, moderated for abuse and nudity, and screen recording is blocked.`,
          ],
        },
      });
    }

    const guides: { slug: string; entity: string; matchers: string[] }[] = [
      { slug: "safe-anonymous-video-chat-guide", entity: "Staying safe in anonymous video chat", matchers: ["safe", "safety", "strangers"] },
      { slug: "how-to-meet-new-people-online", entity: "How to meet new people online", matchers: ["meet new people", "make friends online"] },
      { slug: "online-community-vs-offline-meetup", entity: "Online communities compared with offline meetups", matchers: ["meetup", "community", "online event"] },
    ];
    for (const g of guides) {
      targets.push({
        slug: g.slug,
        cluster: "guide",
        keywordMatchers: g.matchers,
        evidence: {
          kind: "guide",
          entity: g.entity,
          country: "India",
          facts: [
            `${SITE_NAME} is a free, anonymous video and text chat platform at ${SITE_URL}. No phone number, no email, no registration to start.`,
            `Built-in safety: 18+ age verification, report and block, live abuse/nudity moderation, screen-recording blocking, and account suspension after repeated violations.`,
            `Public community rooms exist for tech, study, business, gaming, music, sports and anime interests.`,
            `Private video and voice calls are only possible between members who follow each other mutually.`,
          ],
        },
      });
    }

    // ---------- 4. Existing pages, refresh + dedupe state ----------
    const { data: existingRows } = await db.from("seo_pages")
      .select("slug,status,content_hash,cluster,published_at,refreshed_at,room_slug,primary_keyword,kind,category,city");
    const existing = existingRows ?? [];
    const bySlug = new Map(existing.map((p) => [p.slug as string, p]));
    const hashes = new Set(existing.map((p) => p.content_hash as string).filter(Boolean));

    const usedKeywords = new Set(existing.map((p) => normalizeKeyword(String(p.primary_keyword ?? ""))));

    function pickKeyword(t: Target): { primary: string; related: string[] } | null {
      const scored = candidates
        .filter((c) => !usedKeywords.has(c.normalized))
        .map((c) => {
          const n = c.normalized;
          const score = t.keywordMatchers.reduce(
            (acc, m) => acc + (m && n.includes(normalizeKeyword(m)) ? 2 : 0),
            0,
          );
          return { c, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || b.c.trend_score - a.c.trend_score);
      if (!scored.length) return null;
      const primary = scored[0].c;
      return {
        primary: primary.keyword,
        related: scored.slice(1, 6).map((s) => s.c.keyword),
      };
    }

    // ---------- 5. Create new pages ----------
    const rejections: RejectionReason[] = [];
    let created = 0;
    const changedUrls: string[] = [];
    const newPages: { slug: string; title: string; description: string; facts: string[] }[] = [];

    for (const target of targets) {
      if (created >= MAX_PAGES_PER_RUN) break;
      if (bySlug.has(target.slug)) continue;

      const kw = pickKeyword(target);
      if (!kw) {
        rejections.push({ slug: target.slug, reason: "no on-topic keyword with real search demand yet" });
        continue;
      }

      const { page, rejection } = await generatePage(kw.primary, target.evidence, kw.related, target.cluster, target.slug);
      if (!page) {
        if (rejection) rejections.push(rejection);
        push(`Rejected ${target.slug}: ${rejection?.reason ?? "unknown"}`);
        continue;
      }
      if (hashes.has(page.contentHash)) {
        rejections.push({ slug: target.slug, reason: "duplicate content hash" });
        continue;
      }

      const { error } = await db.from("seo_pages").insert({
        slug: page.slug,
        kind: page.kind,
        status: "published",
        title: page.title,
        description: page.description,
        h1: page.h1,
        intro: page.intro,
        sections: page.sections,
        faqs: page.faqs,
        keywords: page.keywords,
        primary_keyword: page.primaryKeyword,
        category: target.evidence.category ?? null,
        city: target.evidence.city ?? null,
        country: target.evidence.country ?? "India",
        cluster: page.cluster,
        room_slug: target.evidence.roomSlug ?? null,
        word_count: page.wordCount,
        content_hash: page.contentHash,
        evidence: target.evidence,
        published_at: new Date().toISOString(),
        refreshed_at: new Date().toISOString(),
      });
      if (error) {
        issues.push(`Insert ${page.slug}: ${error.message}`);
        continue;
      }
      hashes.add(page.contentHash);
      usedKeywords.add(normalizeKeyword(page.primaryKeyword));
      bySlug.set(page.slug, { slug: page.slug, status: "published", cluster: page.cluster } as never);
      created += 1;
      changedUrls.push(`${SITE_URL}/explore/${page.slug}`);
      newPages.push({
        slug: page.slug,
        title: page.title,
        description: page.description,
        facts: target.evidence.facts,
      });
      result.trafficPotential += Math.round(
        (candidates.find((c) => c.keyword === page.primaryKeyword)?.volume_estimate ?? 40) * 0.18,
      );
      push(`Published /explore/${page.slug} (${page.wordCount} words) for "${page.primaryKeyword}".`);
      await db.from("seo_keywords")
        .update({ used_for_page: page.slug })
        .eq("normalized", normalizeKeyword(page.primaryKeyword));
    }
    result.pagesCreated = created;

    // ---------- 6. Refresh stale pages ----------
    let updated = 0;
    for (const row of existing) {
      if (row.status !== "published") continue;
      const stamp = new Date(String(row.refreshed_at ?? row.published_at ?? 0)).getTime();
      if (Date.now() - stamp < REFRESH_AFTER_DAYS * DAY) continue;
      if (updated >= 2) break;

      const target = targets.find((t) => t.slug === row.slug);
      if (!target) continue;
      const primary = String(row.primary_keyword ?? "");
      if (!primary) continue;

      const { page } = await generatePage(primary, target.evidence, [], target.cluster, target.slug);
      if (!page || page.contentHash === row.content_hash) continue;

      const { error } = await db.from("seo_pages")
        .update({
          title: page.title,
          description: page.description,
          h1: page.h1,
          intro: page.intro,
          sections: page.sections,
          faqs: page.faqs,
          word_count: page.wordCount,
          content_hash: page.contentHash,
          evidence: target.evidence,
          refreshed_at: new Date().toISOString(),
        })
        .eq("slug", row.slug);
      if (error) issues.push(`Refresh ${row.slug}: ${error.message}`);
      else {
        updated += 1;
        changedUrls.push(`${SITE_URL}/explore/${row.slug}`);
        push(`Refreshed /explore/${row.slug} with new information.`);
      }
    }
    result.pagesUpdated = updated;

    // ---------- 7. Archive obsolete pages with a redirect ----------
    const liveRoomSlugs = new Set(roomList.map((r) => r.slug as string));
    let archived = 0;
    for (const row of existing) {
      if (row.status !== "published") continue;
      const roomSlug = row.room_slug as string | null;
      const stamp = new Date(String(row.published_at ?? 0)).getTime();
      const obsolete = roomSlug && !liveRoomSlugs.has(roomSlug) && Date.now() - stamp > OBSOLETE_AFTER_DAYS * DAY;
      if (!obsolete) continue;
      const { error } = await db.from("seo_pages")
        .update({ status: "archived", redirect_to: "/rooms" })
        .eq("slug", row.slug);
      if (error) issues.push(`Archive ${row.slug}: ${error.message}`);
      else {
        archived += 1;
        changedUrls.push(`${SITE_URL}/explore/${row.slug}`);
        push(`Archived /explore/${row.slug} (its room no longer exists) → redirects to /rooms.`);
      }
    }
    result.pagesArchived = archived;

    // ---------- 8. Internal linking (topic clusters) ----------
    const { data: publishedRows } = await db.from("seo_pages")
      .select("slug,cluster,category,city,related_slugs")
      .eq("status", "published");
    const published = publishedRows ?? [];
    let linkUpdates = 0;
    for (const page of published) {
      const related = published
        .filter((p) => p.slug !== page.slug)
        .sort((a, b) => {
          const score = (x: typeof a) =>
            (x.cluster === page.cluster ? 2 : 0) +
            (x.category && x.category === page.category ? 2 : 0) +
            (x.city && x.city === page.city ? 1 : 0);
          return score(b) - score(a);
        })
        .slice(0, 4)
        .map((p) => p.slug as string);
      const current = ((page.related_slugs as string[] | null) ?? []).join(",");
      if (current === related.join(",")) continue;
      const { error } = await db.from("seo_pages")
        .update({ related_slugs: related })
        .eq("slug", page.slug);
      if (!error) linkUpdates += related.length;
    }
    result.internalLinks = linkUpdates;
    if (linkUpdates) push(`Refreshed ${linkUpdates} internal links across topic clusters.`);

    // ---------- 9. Search-engine distribution (IndexNow + Search Console) ----------
    // Google retired the sitemap ping endpoint in 2023, so Google discovery goes
    // through a Search Console sitemap submission instead.
    try {
      const dist = await distribute(db, changedUrls, result.runId, push);
      result.indexnowSubmitted = dist.indexnowSubmitted;
      result.sitemapSubmitted = dist.sitemapSubmitted;
      if (dist.retriesFlushed) push(`Retried ${dist.retriesFlushed} previously failed URL submission(s).`);
      if (!dist.sitemapSubmitted && dist.sitemapDetail.includes("not connected")) {
        issues.push("Google Search Console is not connected — Google discovery still relies on its own crawl schedule.");
      }
    } catch (err) {
      issues.push(`Distribution failed: ${(err as Error).message}`);
    }

    // ---------- 9b. Ready-to-post promo copy (no auto-posting) ----------
    let promos = 0;
    for (const page of newPages.slice(0, 3)) {
      try {
        promos += await queuePromosForPage(db, page, result.runId);
      } catch (err) {
        issues.push(`Promo copy for ${page.slug}: ${(err as Error).message}`);
      }
    }
    result.promosQueued = promos;
    if (promos) push(`Queued ${promos} ready-to-post promo drafts for review.`);

    // ---------- 10. Technical checks ----------
    if (!process.env["INDEXNOW_KEY"]) {
      issues.push("INDEXNOW_KEY is missing — Bing/Yandex URL submission is disabled.");
    }
    if (!process.env["FIRECRAWL_API_KEY"]) {
      issues.push("Firecrawl is not connected — keyword discovery is running on seed expansion only, without live trend data.");
    }
    for (const row of published) {
      if (!(row.related_slugs as string[] | null)?.length && published.length > 1) {
        issues.push(`/explore/${row.slug} has no internal links yet.`);
      }
    }
    if (!published.length) {
      issues.push("No published SEO pages yet — the engine needs on-topic keywords with real supporting data.");
    }
    result.rejected = rejections.length;
    for (const r of rejections.slice(0, 10)) issues.push(`Rejected ${r.slug}: ${r.reason}`);

    await db.from("seo_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        keywords_found: result.keywordsFound,
        keywords_kept: result.keywordsKept,
        pages_created: result.pagesCreated,
        pages_updated: result.pagesUpdated,
        pages_archived: result.pagesArchived,
        rejected: result.rejected,
        traffic_potential: result.trafficPotential,
        internal_links: result.internalLinks,
        issues,
        log,
      })
      .eq("id", result.runId);

    void CLUSTERS;
    return result;
  } catch (err) {
    const message = (err as Error).message;
    issues.push(message);
    await db.from("seo_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), issues, log })
      .eq("id", result.runId);
    return { ...result, status: "failed" };
  }
}
