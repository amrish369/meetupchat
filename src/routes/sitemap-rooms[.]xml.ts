import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/sitemap-rooms.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { roomsSitemap } = await import("@/lib/seo/sitemap.server");
        return new Response(await roomsSitemap(), {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=1800" },
        });
      },
    },
  },
});
