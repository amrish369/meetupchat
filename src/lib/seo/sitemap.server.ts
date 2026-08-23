/**
 * Sitemap builders. /sitemap.xml is a sitemap index that points at the
 * per-section sitemaps so fresh content gets crawled sooner.
 */
import { SITE_URL } from "./taxonomy";
import { publicSupabase } from "./public.server";

export interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const STATIC_ENTRIES: Entry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/explore", changefreq: "daily", priority: "0.9" },
  { path: "/rooms", changefreq: "daily", priority: "0.8" },
  { path: "/leaderboard", changefreq: "daily", priority: "0.5" },
  { path: "/pricing", changefreq: "monthly", priority: "0.6" },
  { path: "/premium", changefreq: "monthly", priority: "0.6" },
  { path: "/safety", changefreq: "monthly", priority: "0.7" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/support", changefreq: "monthly", priority: "0.4" },
];

export function urlsetXml(entries: Entry[]): string {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${SITE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

export function sitemapIndexXml(paths: string[]): string {
  const now = new Date().toISOString();
  const items = paths.map((p) =>
    ["  <sitemap>", `    <loc>${SITE_URL}${p}</loc>`, `    <lastmod>${now}</lastmod>`, "  </sitemap>"].join("\n"),
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...items,
    "</sitemapindex>",
  ].join("\n");
}

interface PageRow {
  slug: string;
  title: string;
  description: string;
  refreshed_at: string | null;
  published_at: string | null;
}

export async function publishedPageRows(limit = 5000): Promise<PageRow[]> {
  try {
    const { data } = await publicSupabase()
      .from("seo_pages")
      .select("slug,title,description,refreshed_at,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    return (data as PageRow[]) ?? [];
  } catch {
    return [];
  }
}

export async function roomSlugs(): Promise<string[]> {
  try {
    const { data } = await publicSupabase().from("rooms").select("slug").limit(1000);
    return ((data as { slug: string }[]) ?? []).map((r) => r.slug);
  } catch {
    return [];
  }
}

export async function pagesSitemap(): Promise<string> {
  const rows = await publishedPageRows();
  return urlsetXml(
    rows.map((p) => ({
      path: `/explore/${p.slug}`,
      lastmod: (p.refreshed_at ?? p.published_at ?? undefined)?.slice(0, 10),
      changefreq: "weekly" as const,
      priority: "0.8",
    })),
  );
}

export async function roomsSitemap(): Promise<string> {
  const slugs = await roomSlugs();
  return urlsetXml(slugs.map((s) => ({ path: `/rooms/${s}`, changefreq: "daily" as const, priority: "0.7" })));
}

/** Pages touched in the last 3 days — crawled far more aggressively. */
export async function recentSitemap(): Promise<string> {
  const rows = await publishedPageRows(500);
  const cutoff = Date.now() - 3 * 86_400_000;
  const fresh = rows.filter((p) => {
    const stamp = new Date(p.refreshed_at ?? p.published_at ?? 0).getTime();
    return stamp >= cutoff;
  });
  return urlsetXml(
    fresh.map((p) => ({
      path: `/explore/${p.slug}`,
      lastmod: (p.refreshed_at ?? p.published_at ?? undefined)?.slice(0, 10),
      changefreq: "hourly" as const,
      priority: "0.9",
    })),
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** RSS 2.0 feed of the newest explore pages. */
export async function feedXml(): Promise<string> {
  const rows = (await publishedPageRows(50)).slice(0, 50);
  const items = rows.map((p) => {
    const link = `${SITE_URL}/explore/${p.slug}`;
    const date = new Date(p.published_at ?? p.refreshed_at ?? Date.now()).toUTCString();
    return [
      "    <item>",
      `      <title>${escapeXml(p.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <description>${escapeXml(p.description)}</description>`,
      `      <pubDate>${date}</pubDate>`,
      "    </item>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Meetup — new community guides</title>",
    `    <link>${SITE_URL}/explore</link>`,
    "    <description>New guides and community pages from Meetup, India's free anonymous 18+ video and text chat platform.</description>",
    "    <language>en-in</language>",
    `    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />`,
    ...items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
