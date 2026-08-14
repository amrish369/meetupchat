/**
 * Ready-to-post promo copy for pages the engine published.
 *
 * Nothing is auto-posted anywhere. Each run drops factual, channel-specific
 * copy into seo_promos, which the admin reviews and posts by hand.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_NAME, SITE_URL } from "./taxonomy";

const MODEL = "google/gemini-2.5-flash";

export type PromoChannel = "x" | "whatsapp" | "telegram" | "reddit" | "meta";

const CHANNELS: { key: PromoChannel; brief: string }[] = [
  { key: "x", brief: "A single post under 240 characters for X/Threads. Plain, factual, no hype, at most 3 hashtags." },
  { key: "whatsapp", brief: "A 2-3 sentence WhatsApp/status blurb a real person could forward. Warm, no emoji spam, no hashtags." },
  { key: "telegram", brief: "A 3-4 sentence Telegram channel post with a short bulleted highlight list. No hashtags." },
  {
    key: "reddit",
    brief:
      "A descriptive, self-contained comment/post body (80-140 words) that explains the topic and would be useful even without clicking the link. Never say things like 'check out my site' or 'click here'. No hashtags.",
  },
  { key: "meta", brief: "One factual sentence under 150 characters usable as a link description anywhere." },
];

interface PromoDraft {
  channel: PromoChannel;
  headline: string;
  body: string;
  hashtags: string[];
}

interface AiPromos {
  promos?: { channel?: string; headline?: string; body?: string; hashtags?: string[] }[];
}

function buildPrompt(title: string, description: string, url: string, facts: string[]) {
  return `Write promotional copy for one page on ${SITE_NAME} (${SITE_URL}).

PAGE TITLE: ${title}
PAGE DESCRIPTION: ${description}
PAGE URL: ${url}
VERIFIED FACTS (use only these; never invent numbers, testimonials, ratings or user counts):
${facts.map((f) => `- ${f}`).join("\n")}

HARD RULES:
- Factual only. No fabricated statistics, no fake reviews, no "world's #1", no urgency or clickbait.
- Always make clear this is an anonymous 18+ video and text chat platform.
- No spam patterns: no repeated keywords, no ALL CAPS, no chains of emojis, no "link in bio" tricks.
- Each channel gets distinct wording — never the same sentence twice.
- Never claim physical meetups or events; the platform is online only.

Produce copy for exactly these channels:
${CHANNELS.map((c) => `- ${c.key}: ${c.brief}`).join("\n")}

Return ONLY valid JSON:
{ "promos": [ { "channel": "x", "headline": "short internal label", "body": "the post text", "hashtags": ["tag"] } ] }`;
}

export async function generatePromos(input: {
  title: string;
  description: string;
  url: string;
  facts: string[];
}): Promise<PromoDraft[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return [];

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You write honest, non-spammy promotional copy that complies with platform community guidelines. You never fabricate facts and you only output valid JSON.",
        },
        { role: "user", content: buildPrompt(input.title, input.description, input.url, input.facts) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return [];

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) return [];

  let parsed: AiPromos;
  try {
    parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as AiPromos;
  } catch {
    return [];
  }

  const allowed = new Set(CHANNELS.map((c) => c.key));
  const seen = new Set<string>();
  const drafts: PromoDraft[] = [];

  for (const p of parsed.promos ?? []) {
    const channel = String(p.channel ?? "").toLowerCase() as PromoChannel;
    if (!allowed.has(channel) || seen.has(channel)) continue;
    const body = String(p.body ?? "").trim();
    if (body.length < 20) continue;
    // Reject spam patterns defensively, even if the model slipped.
    if (/click here|link in bio|check out my|100% free forever|guaranteed/i.test(body)) continue;
    if (channel === "x" && body.length > 260) continue;
    seen.add(channel);
    drafts.push({
      channel,
      headline: String(p.headline ?? input.title).slice(0, 120),
      body,
      hashtags: (p.hashtags ?? [])
        .map((h) => String(h).replace(/^#/, "").trim())
        .filter(Boolean)
        .slice(0, 3),
    });
  }

  return drafts;
}

/** Generate and store the promo queue rows for one page. */
export async function queuePromosForPage(
  db: SupabaseClient,
  page: { slug: string; title: string; description: string; facts: string[] },
  runId: string | null,
): Promise<number> {
  const url = `${SITE_URL}/explore/${page.slug}`;
  const drafts = await generatePromos({
    title: page.title,
    description: page.description,
    url,
    facts: page.facts,
  });
  if (!drafts.length) return 0;

  const { error } = await db.from("seo_promos").insert(
    drafts.map((d) => ({
      page_slug: page.slug,
      target_url: url,
      channel: d.channel,
      headline: d.headline,
      body: d.body,
      hashtags: d.hashtags,
      status: "queued",
      run_id: runId,
    })),
  );
  return error ? 0 : drafts.length;
}
