import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/sitemap-static.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { urlsetXml, STATIC_ENTRIES } = await import("@/lib/seo/sitemap.server");
        return new Response(urlsetXml(STATIC_ENTRIES), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
