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
