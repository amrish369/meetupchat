import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const XML = { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" };

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { sitemapIndexXml } = await import("@/lib/seo/sitemap.server");
        const xml = sitemapIndexXml([
          "/sitemap-static.xml",
          "/sitemap-pages.xml",
          "/sitemap-rooms.xml",
          "/sitemap-recent.xml",
        ]);
        return new Response(xml, { headers: XML });
      },
    },
  },
});
