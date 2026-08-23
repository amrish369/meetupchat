import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo/taxonomy";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /seo-dashboard",
          "Disallow: /api/",
          "",
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          "",
          `# RSS feed: ${SITE_URL}/feed.xml`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
