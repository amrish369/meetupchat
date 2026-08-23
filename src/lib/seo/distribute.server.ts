/**
 * Automated search-engine distribution.
 *
 * Two white-hat channels only:
 *   1. IndexNow (Bing, Yandex, Naver, Seznam) — per-URL push for URLs we
 *      actually created, refreshed or archived.
 *   2. Google Search Console sitemap submission — only when the sitemap's
 *      contents actually changed, through the Lovable connector gateway.
 *
 * Nothing here posts links anywhere else. Failures are recorded in
 * seo_submissions and retried on the next run with backoff.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_URL } from "./taxonomy";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const MAX_ATTEMPTS = 5;

export interface DistributionResult {
  indexnowSubmitted: number;
  indexnowStatus: number | null;
  indexnowDetail: string | null;
  sitemapSubmitted: boolean;
  sitemapDetail: string;
  retriesFlushed: number;
}

/** IndexNow keys allow only letters, digits and dashes. */
export function indexNowKey(): string | null {
  const raw = process.env["INDEXNOW_KEY"];
  if (!raw) return null;
  const clean = raw.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  return clean.length >= 8 ? clean : null;
}

export function indexNowKeyLocation(): string | null {
  const key = indexNowKey();
  return key ? `${SITE_URL}/indexnow-key.txt` : null;
}

async function record(
  db: SupabaseClient,
  rows: {
    target: string;
    engine: "indexnow" | "google_search_console";
    status: "pending" | "submitted" | "failed" | "skipped";
    http_status?: number | null;
    detail?: string | null;
    retry_after?: string | null;
    attempts?: number;
    run_id?: string | null;
  }[],
) {
  if (!rows.length) return;
  await db.from("seo_submissions").insert(rows);
}

/**
 * Push a batch of URLs to IndexNow. Returns the HTTP status so the caller can
 * decide whether to keep the URLs queued for a later retry.
 */
async function pushIndexNow(urls: string[]): Promise<{ status: number; detail: string; retryAfter: string | null }> {
  const key = indexNowKey();
  if (!key) return { status: 0, detail: "INDEXNOW_KEY is not configured", retryAfter: null };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE_URL).host,
      key,
      keyLocation: `${SITE_URL}/indexnow-key.txt`,
      urlList: urls,
    }),
  });

  const text = await res.text().catch(() => "");
  let retryAfter: string | null = null;
  if (res.status === 429) {
    const header = res.headers.get("retry-after");
    const seconds = header && /^\d+$/.test(header) ? Number(header) : 3600;
    retryAfter = new Date(Date.now() + seconds * 1000).toISOString();
  }
  return { status: res.status, detail: text.slice(0, 300) || `HTTP ${res.status}`, retryAfter };
}

/** Collect the pending URLs that are due for a retry. */
async function duePending(db: SupabaseClient): Promise<{ id: string; target: string; attempts: number }[]> {
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("seo_submissions")
    .select("id,target,attempts,retry_after")
    .eq("engine", "indexnow")
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(200);
  return ((data as { id: string; target: string; attempts: number; retry_after: string | null }[]) ?? [])
    .filter((r) => !r.retry_after || r.retry_after <= nowIso)
    .map((r) => ({ id: r.id, target: r.target, attempts: r.attempts }));
}

async function currentSitemapUrls(db: SupabaseClient): Promise<string[]> {
  const { data: pages } = await db
    .from("seo_pages")
    .select("slug,refreshed_at")
    .eq("status", "published")
    .limit(5000);
  const { data: rooms } = await db.from("rooms").select("slug").limit(1000);
  const list = [
    ...((pages as { slug: string; refreshed_at: string | null }[]) ?? []).map(
      (p) => `/explore/${p.slug}@${p.refreshed_at ?? ""}`,
    ),
    ...((rooms as { slug: string }[]) ?? []).map((r) => `/rooms/${r.slug}`),
  ];
  return list.sort();
}

async function hashList(list: string[]): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(list.join("|")));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

interface GscSite {
  siteUrl: string;
  permissionLevel?: string;
}

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

function gscHeaders(): Record<string, string> | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connectionKey };
}

/** Verified properties from the connected account that cover our site. */
export async function listVerifiedProperties(): Promise<
  { status: "unavailable"; reason: string } | { status: "ok"; candidates: string[] }
> {
  const headers = gscHeaders();
  if (!headers) return { status: "unavailable", reason: "Google Search Console is not connected." };

  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
  if (!res.ok) {
    return { status: "unavailable", reason: `Search Console list failed [${res.status}]: ${(await res.text()).slice(0, 200)}` };
  }
  const { siteEntry = [] } = (await res.json()) as { siteEntry?: GscSite[] };
  const target = new URL(SITE_URL);
  const candidates = siteEntry
    .filter((e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target))
    .map((e) => e.siteUrl);
  return { status: "ok", candidates };
}

/** Sitemap status for a chosen property. Counts are reported as-is. */
export async function sitemapStatus(siteUrl: string): Promise<
  | { status: "unavailable"; reason: string }
  | { status: "ok"; lastSubmitted: string | null; lastDownloaded: string | null; errors: number; warnings: number }
> {
  const headers = gscHeaders();
  if (!headers) return { status: "unavailable", reason: "Google Search Console is not connected." };
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { headers },
  );
  if (!res.ok) {
    return { status: "unavailable", reason: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  const body = (await res.json()) as {
    lastSubmitted?: string;
    lastDownloaded?: string;
    errors?: string | number;
    warnings?: string | number;
  };
  return {
    status: "ok",
    lastSubmitted: body.lastSubmitted ?? null,
    lastDownloaded: body.lastDownloaded ?? null,
    errors: Number(body.errors ?? 0),
    warnings: Number(body.warnings ?? 0),
  };
}

async function submitSitemap(db: SupabaseClient, runId: string | null): Promise<{ submitted: boolean; detail: string }> {
  const headers = gscHeaders();
  if (!headers) return { submitted: false, detail: "Google Search Console is not connected — sitemap submission skipped." };

  // Only submit when the sitemap's contents actually changed.
  const hash = await hashList(await currentSitemapUrls(db));
  const { data: lastRows } = await db
    .from("seo_submissions")
    .select("detail,status")
    .eq("engine", "google_search_console")
    .eq("status", "submitted")
    .order("created_at", { ascending: false })
    .limit(1);
  const last = (lastRows as { detail: string | null }[] | null)?.[0]?.detail ?? "";
  if (last.includes(hash)) {
    return { submitted: false, detail: "Sitemap contents unchanged since the last submission — nothing to submit." };
  }

  const props = await listVerifiedProperties();
  if (props.status === "unavailable") return { submitted: false, detail: props.reason };
  if (props.candidates.length === 0) {
    return { submitted: false, detail: "No verified Search Console property covers this site." };
  }
  if (props.candidates.length > 1) {
    return {
      submitted: false,
      detail: `Multiple verified properties match (${props.candidates.join(", ")}) — pick one in the dashboard.`,
    };
  }

  const siteUrl = props.candidates[0];
  const sitemapUrl = `${SITE_URL}/sitemap.xml`;
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { method: "PUT", headers },
  );
  const ok = res.ok;
  const detail = ok
    ? `Sitemap submitted to ${siteUrl} (hash ${hash}).`
    : `Search Console rejected the sitemap [${res.status}]: ${(await res.text()).slice(0, 200)}`;
  await record(db, [
    {
      target: sitemapUrl,
      engine: "google_search_console",
      status: ok ? "submitted" : "failed",
      http_status: res.status,
      detail,
      attempts: 1,
      run_id: runId,
    },
  ]);
  return { submitted: ok, detail };
}

/**
 * Run the whole distribution step: flush pending retries, push the new URLs,
 * then submit the sitemap when it changed.
 */
export async function distribute(
  db: SupabaseClient,
  urls: string[],
  runId: string | null,
  push: (msg: string) => void,
): Promise<DistributionResult> {
  const result: DistributionResult = {
    indexnowSubmitted: 0,
    indexnowStatus: null,
    indexnowDetail: null,
    sitemapSubmitted: false,
    sitemapDetail: "",
    retriesFlushed: 0,
  };

  const pending = await duePending(db);
  result.retriesFlushed = pending.length;

  const unique = Array.from(new Set([...pending.map((p) => p.target), ...urls])).slice(0, 10_000);

  if (unique.length) {
    const { status, detail, retryAfter } = await pushIndexNow(unique);
    result.indexnowStatus = status || null;
    result.indexnowDetail = detail;
    const ok = status === 200 || status === 202;
    const permanent = status === 403 || status === 422;

    if (ok) {
      result.indexnowSubmitted = unique.length;
      push(`IndexNow accepted ${unique.length} URL(s).`);
    } else if (permanent) {
      push(`IndexNow rejected the batch (HTTP ${status}) — stopping this batch: ${detail}`);
    } else {
      push(`IndexNow failed (HTTP ${status}) — URLs stay queued for the next run.`);
    }

    // Mark the retried rows.
    if (pending.length) {
      for (const p of pending) {
        await db
          .from("seo_submissions")
          .update({
            status: ok ? "submitted" : permanent ? "failed" : "pending",
            attempts: p.attempts + 1,
            http_status: status || null,
            detail,
            retry_after: retryAfter,
          })
          .eq("id", p.id);
      }
    }

    // Record the fresh URLs.
    await record(
      db,
      urls.map((u) => ({
        target: u,
        engine: "indexnow" as const,
        status: ok ? ("submitted" as const) : permanent ? ("failed" as const) : ("pending" as const),
        http_status: status || null,
        detail,
        retry_after: retryAfter,
        attempts: 1,
        run_id: runId,
      })),
    );
  }

  const sitemap = await submitSitemap(db, runId);
  result.sitemapSubmitted = sitemap.submitted;
  result.sitemapDetail = sitemap.detail;
  push(sitemap.detail);

  return result;
}
