/**
 * Server functions for the SEO Growth Engine: admin-only trigger + reporting.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SeoRunSummary {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  keywords_found: number;
  keywords_kept: number;
  pages_created: number;
  pages_updated: number;
  pages_archived: number;
  rejected: number;
  traffic_potential: number;
  internal_links: number;
  issues: string[];
  log: string[];
}

export interface SeoReport {
  runs: SeoRunSummary[];
  totals: {
    published: number;
    archived: number;
    keywords: number;
    words: number;
    trafficPotential: number;
  };
  pages: {
    slug: string;
    title: string;
    cluster: string | null;
    primary_keyword: string | null;
    word_count: number;
    status: string;
    published_at: string | null;
    refreshed_at: string | null;
    related_slugs: string[] | null;
  }[];
}

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const { data } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

export const triggerSeoRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { runSeoEngine } = await import("./engine.server");
    return runSeoEngine("manual");
  });

export const getSeoReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeoReport> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          order: (
            c: string,
            o: { ascending: boolean },
          ) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    };

    const { data: runs } = await db
      .from("seo_runs")
      .select(
        "id,source,status,started_at,finished_at,keywords_found,keywords_kept,pages_created,pages_updated,pages_archived,rejected,traffic_potential,internal_links,issues,log",
      )
      .order("started_at", { ascending: false })
      .limit(20);

    const { data: pages } = await db
      .from("seo_pages")
      .select(
        "slug,title,cluster,primary_keyword,word_count,status,published_at,refreshed_at,related_slugs",
      )
      .order("published_at", { ascending: false })
      .limit(500);

    const { data: keywords } = await db
      .from("seo_keywords")
      .select("normalized")
      .order("last_seen_at", { ascending: false })
      .limit(2000);

    const pageRows = (pages as SeoReport["pages"]) ?? [];
    const runRows = (runs as SeoRunSummary[]) ?? [];

    return {
      runs: runRows,
      pages: pageRows,
      totals: {
        published: pageRows.filter((p) => p.status === "published").length,
        archived: pageRows.filter((p) => p.status === "archived").length,
        keywords: ((keywords as unknown[]) ?? []).length,
        words: pageRows.reduce((a, p) => a + (p.word_count ?? 0), 0),
        trafficPotential: runRows.reduce((a, r) => Math.max(a, r.traffic_potential ?? 0), 0),
      },
    };
  });

export interface SeoSubmissionRow {
  id: string;
  target: string;
  engine: string;
  status: string;
  attempts: number;
  http_status: number | null;
  detail: string | null;
  retry_after: string | null;
  created_at: string;
}

export interface SeoPromoRow {
  id: string;
  page_slug: string | null;
  target_url: string;
  channel: string;
  headline: string;
  body: string;
  hashtags: string[];
  status: string;
  posted_at: string | null;
  created_at: string;
}

export interface SeoDistribution {
  submissions: SeoSubmissionRow[];
  promos: SeoPromoRow[];
  indexnowConfigured: boolean;
  keyLocation: string | null;
  searchConsole:
    | { status: "unavailable"; reason: string }
    | {
        status: "ok";
        properties: string[];
        sitemap: {
          lastSubmitted: string | null;
          lastDownloaded: string | null;
          errors: number;
          warnings: number;
        } | null;
      };
}

export const getSeoDistribution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeoDistribution> => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { indexNowKey, indexNowKeyLocation, listVerifiedProperties, sitemapStatus } = await import(
      "./distribute.server"
    );
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: unknown }> };
        };
      };
    };

    const { data: submissions } = await db
      .from("seo_submissions")
      .select("id,target,engine,status,attempts,http_status,detail,retry_after,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: promos } = await db
      .from("seo_promos")
      .select("id,page_slug,target_url,channel,headline,body,hashtags,status,posted_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    let searchConsole: SeoDistribution["searchConsole"];
    const props = await listVerifiedProperties();
    if (props.status === "unavailable") {
      searchConsole = { status: "unavailable", reason: props.reason };
    } else if (props.candidates.length === 1) {
      const status = await sitemapStatus(props.candidates[0]);
      searchConsole = {
        status: "ok",
        properties: props.candidates,
        sitemap:
          status.status === "ok"
            ? {
                lastSubmitted: status.lastSubmitted,
                lastDownloaded: status.lastDownloaded,
                errors: status.errors,
                warnings: status.warnings,
              }
            : null,
      };
    } else {
      searchConsole = { status: "ok", properties: props.candidates, sitemap: null };
    }

    return {
      submissions: (submissions as SeoSubmissionRow[]) ?? [],
      promos: (promos as SeoPromoRow[]) ?? [],
      indexnowConfigured: Boolean(indexNowKey()),
      keyLocation: indexNowKeyLocation(),
      searchConsole,
    };
  });

/** Admin marks a queued promo as posted or discarded. It is never auto-posted. */
export const setPromoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: "queued" | "posted" | "discarded" }) => {
    if (!data?.id || !["queued", "posted", "discarded"].includes(data.status)) {
      throw new Error("Invalid promo update");
    }
    return data;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
      };
    };
    const { error } = await db
      .from("seo_promos")
      .update({ status: data.status, posted_at: data.status === "posted" ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
