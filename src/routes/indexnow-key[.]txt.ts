/**
 * IndexNow key verification file. Bing/Yandex fetch this to confirm we own
 * the host before accepting URL submissions.
 */
import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/indexnow-key.txt")({
  server: {
    handlers: {
      GET: async () => {
        const { indexNowKey } = await import("@/lib/seo/distribute.server");
        const key = indexNowKey();
        if (!key) return new Response("Not found", { status: 404 });
        return new Response(key, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" },
        });
      },
    },
  },
});
