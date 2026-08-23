import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { feedXml } = await import("@/lib/seo/sitemap.server");
        return new Response(await feedXml(), {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=1800" },
        });
      },
    },
  },
});
