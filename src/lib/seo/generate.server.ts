/**
 * Page generation + quality gates.
 *
 * A page is only ever generated from REAL evidence we own (a live community
 * room, a real interest category, or a region where we genuinely have members).
 * Nothing about events, venues, dates or attendance is ever invented.
 */
import {
  MAX_KEYWORD_DENSITY,
  MIN_WORDS,
  SITE_NAME,
  keywordDensity,
  slugify,
  wordCount,
  type ClusterKey,
} from "./taxonomy";

export interface PageEvidence {
  kind: "room" | "category" | "region" | "guide";
  entity: string;
  facts: string[];
  roomSlug?: string;
  category?: string | null;
  city?: string | null;
  country?: string | null;
}

export interface GeneratedPage {
  slug: string;
  kind: string;
  cluster: ClusterKey;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  faqs: { question: string; answer: string }[];
  keywords: string[];
  primaryKeyword: string;
  wordCount: number;
  contentHash: string;
  evidence: PageEvidence;
}

export interface RejectionReason {
  slug: string;
  reason: string;
}

const MODEL = "google/gemini-2.5-flash";

export async function hashContent(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

interface AiPage {
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  faqs: { question: string; answer: string }[];
}

function buildPrompt(primaryKeyword: string, evidence: PageEvidence, related: string[]) {
  const factLines = evidence.facts.map((f) => `- ${f}`).join("\n");
  return `You are writing ONE genuinely useful landing page for ${SITE_NAME}, a privacy-first anonymous video and text chat platform for online communities.

TARGET SEARCH PHRASE: "${primaryKeyword}"
PAGE SUBJECT: ${evidence.entity} (type: ${evidence.kind})

VERIFIED FACTS — these are the ONLY facts you may state about the platform:
${factLines}

RELATED SEARCH PHRASES you may cover naturally: ${related.join(", ") || "none"}

HARD RULES:
- NEVER invent events, dates, venues, ticket prices, organisers, attendance numbers, testimonials, ratings or statistics.
- NEVER claim there are scheduled offline/physical events. This platform hosts online rooms and video/voice chats only.
- If the subject is a city or region, write about people from that place who use the platform online — do not imply local physical events.
- Write for a real reader first. Answer the search intent in the opening paragraph.
- Use the target phrase naturally 3-5 times total. No keyword stuffing, no hidden text.
- Total body length must be between 900 and 1300 words.
- Indian English, plain and warm. No hype, no emojis.

Return STRICT JSON only, with this shape:
{
  "title": "under 60 chars, includes the subject, ends with | ${SITE_NAME}",
  "description": "under 155 chars, benefit-led, no clickbait",
  "h1": "one clear H1, different wording from the title",
  "intro": "2 paragraphs that directly answer the search intent (150-220 words)",
  "sections": [{ "heading": "H2 text", "body": "3-6 paragraphs of prose" }],
  "faqs": [{ "question": "a real question a searcher would type", "answer": "60-110 words, directly answered" }]
}
Provide 5-7 sections and 6 FAQs.`;
}

export async function generatePage(
  primaryKeyword: string,
  evidence: PageEvidence,
  relatedKeywords: string[],
  cluster: ClusterKey,
  slug: string,
): Promise<{ page: GeneratedPage | null; rejection?: RejectionReason }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { page: null, rejection: { slug, reason: "AI gateway key missing" } };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a senior SEO content writer who follows Google's Search Essentials and Helpful Content guidance. You never fabricate facts and you only output valid JSON.",
        },
        { role: "user", content: buildPrompt(primaryKeyword, evidence, relatedKeywords) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { page: null, rejection: { slug, reason: `AI gateway ${res.status}: ${body.slice(0, 200)}` } };
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content;
  if (!raw) return { page: null, rejection: { slug, reason: "empty AI response" } };

  let ai: AiPage;
  try {
    ai = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as AiPage;
  } catch {
    return { page: null, rejection: { slug, reason: "AI response was not valid JSON" } };
  }

  const sections = (ai.sections ?? []).filter((s) => s?.heading && s?.body);
  const faqs = (ai.faqs ?? []).filter((f) => f?.question && f?.answer);
  const fullText = [ai.intro ?? "", ...sections.map((s) => `${s.heading} ${s.body}`), ...faqs.map((f) => `${f.question} ${f.answer}`)].join("\n\n");

  const words = wordCount(fullText);
  if (words < MIN_WORDS) return { page: null, rejection: { slug, reason: `thin content (${words} words < ${MIN_WORDS})` } };
  if (sections.length < 4) return { page: null, rejection: { slug, reason: `only ${sections.length} sections` } };
  if (faqs.length < 4) return { page: null, rejection: { slug, reason: `only ${faqs.length} FAQs` } };

  const density = keywordDensity(fullText, primaryKeyword);
  if (density > MAX_KEYWORD_DENSITY) {
    return { page: null, rejection: { slug, reason: `keyword density ${(density * 100).toFixed(1)}% too high` } };
  }
  if (/\b(tickets?|venue|rsvp|doors open|entry fee)\b/i.test(fullText)) {
    return { page: null, rejection: { slug, reason: "mentions physical event details we cannot verify" } };
  }

  const title = (ai.title ?? evidence.entity).slice(0, 65);
  const description = (ai.description ?? "").slice(0, 158);
  if (!description) return { page: null, rejection: { slug, reason: "missing meta description" } };

  return {
    page: {
      slug: slugify(slug),
      kind: evidence.kind,
      cluster,
      title,
      description,
      h1: (ai.h1 ?? evidence.entity).slice(0, 120),
      intro: ai.intro ?? "",
      sections,
      faqs,
      keywords: [primaryKeyword, ...relatedKeywords].slice(0, 12),
      primaryKeyword,
      wordCount: words,
      contentHash: await hashContent(fullText),
      evidence,
    },
  };
}
