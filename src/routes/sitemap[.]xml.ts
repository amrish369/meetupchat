import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { SITE_URL } from "@/lib/seo/taxonomy";

interface Entry {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: string;
}

const STATIC: Entry[] = [
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

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = [...STATIC];

        try {
          const { publicSupabase } = await import("@/lib/seo/public.server");
          const sb = publicSupabase();

          const { data: pages } = await sb
            .from("seo_pages")
            .select("slug,refreshed_at,published_at")
            .eq("status", "published")
            .limit(5000);
          for (const p of (pages as { slug: string; refreshed_at: string | null; published_at: string | null }[]) ?? []) {
            entries.push({
              path: `/explore/${p.slug}`,
              lastmod: (p.refreshed_at ?? p.published_at ?? undefined)?.slice(0, 10),
              changefreq: "weekly",
              priority: "0.8",
            });
          }

          const { data: rooms } = await sb.from("rooms").select("slug").limit(1000);
          for (const r of (rooms as { slug: string }[]) ?? []) {
            entries.push({ path: `/rooms/${r.slug}`, changefreq: "daily", priority: "0.7" });
          }
        } catch {
          // Sitemap still serves the static routes if the database is unreachable.
        }

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

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
