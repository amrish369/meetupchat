/**
 * Daily SEO Growth Engine trigger, called by a scheduled job.
 * Public prefix, so the caller is verified with the project's publishable key.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/seo-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
          "";
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { runSeoEngine } = await import("@/lib/seo/engine.server");
        const result = await runSeoEngine("cron");
        return Response.json(result, { status: result.status === "failed" ? 500 : 200 });
      },
    },
  },
});
