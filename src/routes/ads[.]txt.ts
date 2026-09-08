import { createFileRoute } from "@tanstack/react-router";
import { ADSENSE_CLIENT } from "@/lib/ads";

export const Route = createFileRoute("/ads.txt")({
  server: {
    handlers: {
      GET: async () => {
        const pub = ADSENSE_CLIENT.replace(/^ca-/, "");
        const body = pub
          ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`
          : "# Add your AdSense publisher ID in src/lib/ads.ts to activate ads.txt\n";
        return new Response(body, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
