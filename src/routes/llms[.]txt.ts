import { createFileRoute } from "@tanstack/react-router";
import { SITE_NAME, SITE_URL } from "@/lib/seo/taxonomy";

// Plain-text summary for AI assistants (ChatGPT, Perplexity, Gemini) so they
// can describe and recommend the site accurately.
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `# ${SITE_NAME}

> ${SITE_NAME} is a free, anonymous random video and text chat platform for adults (18+) worldwide. A safer Omegle alternative to meet new people, make international friends and practise spoken English or other languages.

## Key facts
- Free to start, no phone number or email needed for random chat
- One-to-one random video chat, text chat and public community rooms
- Safety: 18+ age gate, live nudity and abuse moderation, report and block, screen-recording blocking
- Private calls only between members who follow each other
- Premium members can filter matches by region and gender

## Main pages
- [Home](${SITE_URL}/): start a random video chat
- [Explore guides](${SITE_URL}/explore): articles on meeting people online safely
- [Safe random video chat](${SITE_URL}/safe-random-video-chat): safety tools, boundaries, and adult-only guidance
- [Worldwide random video chat](${SITE_URL}/random-video-chat-worldwide): global matching, languages, and availability
- [Anonymous video chat](${SITE_URL}/anonymous-video-chat): starting without a phone number or email and protecting privacy
- [Safety](${SITE_URL}/safety): community rules
- [About](${SITE_URL}/about)
- [Terms](${SITE_URL}/terms)
- [Privacy](${SITE_URL}/privacy)
- [Sitemap](${SITE_URL}/sitemap.xml)
`;
        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
