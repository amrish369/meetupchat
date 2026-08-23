import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/sitemap-recent.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { recentSitemap } = await import("@/lib/seo/sitemap.server");
        return new Response(await recentSitemap(), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=600" },
        });
      },
    },
  },
});
