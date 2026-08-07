/**
 * SEO taxonomy — the ONLY topics the growth engine is allowed to work on.
 *
 * Everything here is white-hat by construction:
 *  - a keyword is kept only if it matches the topic allowlist below
 *  - a page is only ever generated for a real entity we own (a live community
 *    room, a real category, or a region where we genuinely have members)
 */

export const SITE_NAME = "Meetup";
export const SITE_URL = "https://meetupchat.lovable.app";

/** Minimum body word count for a topic/city/category landing page. */
export const MIN_WORDS = 800;
/** Maximum allowed density for the primary keyword (keyword-stuffing guard). */
export const MAX_KEYWORD_DENSITY = 0.025;
/** A region page needs at least this many real members before it may exist. */
export const MIN_REGION_MEMBERS = 5;
/** Hard cap on pages produced per daily run (protects crawl budget + quality). */
export const MAX_PAGES_PER_RUN = 4;
/** Refresh a published page at most this often. */
export const REFRESH_AFTER_DAYS = 21;
/** Archive a page whose supporting entity disappeared for this long. */
export const OBSOLETE_AFTER_DAYS = 30;

/**
 * Topic allowlist. A discovered keyword must contain at least one of these
 * terms, otherwise it is discarded as unrelated trending noise.
 */
export const TOPIC_TERMS = [
  "meetup",
  "meetups",
  "meet up",
  "event",
  "events",
  "networking",
  "startup event",
  "startup events",
  "tech meetup",
  "tech event",
  "hackathon",
  "workshop",
  "workshops",
  "college event",
  "college fest",
  "student community",
  "gaming event",
  "gaming community",
  "esports",
  "music event",
  "music community",
  "business event",
  "business networking",
  "dating event",
  "speed dating",
  "local community",
  "online event",
  "online community",
  "online meetup",
  "video meeting",
  "video call",
  "video chat",
  "voice chat",
  "voice call",
  "group chat",
  "chat room",
  "chat rooms",
  "social community",
  "community",
  "communities",
  "talk to strangers",
  "meet new people",
  "make friends online",
  "study group",
  "study room",
  "anime community",
  "cricket fans",
  "coding community",
  "founders community",
];

/** Terms that instantly disqualify a keyword, whatever else it contains. */
export const BLOCKED_TERMS = [
  "porn",
  "nude",
  "nudes",
  "sex",
  "sexy",
  "xxx",
  "escort",
  "hookup",
  "18+ video",
  "dating app crack",
  "mod apk",
  "free coins hack",
  "bot",
  "scam",
  "download apk",
  "torrent",
  "casino",
  "betting",
  "crypto pump",
  "loan",
];

/** Content clusters. Every page belongs to exactly one cluster (topic clusters). */
export const CLUSTERS = {
  community: "Communities & rooms",
  category: "Interests & categories",
  region: "Places & regions",
  guide: "Guides & safety",
} as const;
export type ClusterKey = keyof typeof CLUSTERS;

/** Category → human label + the seed terms used when discovering keywords. */
export const CATEGORIES: Record<string, { label: string; seeds: string[] }> = {
  tech: { label: "Tech & Coding", seeds: ["tech meetup", "coding community", "hackathon", "developer community"] },
  business: { label: "Business & Startups", seeds: ["startup events", "business networking", "founders community"] },
  education: { label: "Study & College", seeds: ["study group online", "college events", "student community"] },
  gaming: { label: "Gaming & Esports", seeds: ["gaming community", "esports event", "gaming voice chat"] },
  music: { label: "Music & Creators", seeds: ["music community", "music event", "online jam session"] },
  sports: { label: "Sports & Cricket", seeds: ["cricket fans community", "sports watch party online"] },
  anime: { label: "Anime & Pop Culture", seeds: ["anime community", "anime watch party"] },
  social: { label: "Social & Making Friends", seeds: ["meet new people online", "make friends online", "video chat with strangers"] },
};

/** Regions we serve, with the state they belong to (used for categorisation). */
export const REGIONS: Record<string, { city: string; state: string; country: string }> = {
  delhi: { city: "Delhi", state: "Delhi", country: "India" },
  mumbai: { city: "Mumbai", state: "Maharashtra", country: "India" },
  bengaluru: { city: "Bengaluru", state: "Karnataka", country: "India" },
  hyderabad: { city: "Hyderabad", state: "Telangana", country: "India" },
  chennai: { city: "Chennai", state: "Tamil Nadu", country: "India" },
  kolkata: { city: "Kolkata", state: "West Bengal", country: "India" },
  pune: { city: "Pune", state: "Maharashtra", country: "India" },
  lucknow: { city: "Lucknow", state: "Uttar Pradesh", country: "India" },
  jaipur: { city: "Jaipur", state: "Rajasthan", country: "India" },
  ahmedabad: { city: "Ahmedabad", state: "Gujarat", country: "India" },
  indore: { city: "Indore", state: "Madhya Pradesh", country: "India" },
  chandigarh: { city: "Chandigarh", state: "Chandigarh", country: "India" },
};

export type SearchIntent = "informational" | "navigational" | "commercial" | "transactional";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 70);
}

export function normalizeKeyword(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function isRelevantKeyword(keyword: string): boolean {
  const k = normalizeKeyword(keyword);
  if (k.length < 8 || k.length > 90) return false;
  if (k.split(" ").length < 2) return false;
  if (BLOCKED_TERMS.some((b) => k.includes(b))) return false;
  return TOPIC_TERMS.some((t) => k.includes(t));
}

export function classifyIntent(keyword: string): SearchIntent {
  const k = normalizeKeyword(keyword);
  if (/\b(buy|price|pricing|plan|premium|subscription|cost)\b/.test(k)) return "commercial";
  if (/\b(join|start|download|sign up|login|app|online now|free)\b/.test(k)) return "transactional";
  if (/\b(best|top|alternative|vs|review)\b/.test(k)) return "commercial";
  if (/\b(how|what|why|guide|tips|safe|is it)\b/.test(k)) return "informational";
  return "navigational";
}

export function detectRegion(keyword: string): { city: string; state: string; country: string; key: string } | null {
  const k = normalizeKeyword(keyword);
  for (const [key, region] of Object.entries(REGIONS)) {
    if (k.includes(region.city.toLowerCase()) || k.includes(key)) return { ...region, key };
  }
  return null;
}

export function detectCategory(keyword: string): string | null {
  const k = normalizeKeyword(keyword);
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (k.includes(key)) return key;
    if (cat.seeds.some((s) => k.includes(normalizeKeyword(s).split(" ")[0]))) return key;
  }
  return null;
}

/** Cheap, honest demand proxy — never presented as real Google volume. */
export function estimateDemand(keyword: string, hits: number): { volume: number; competition: number; trend: number } {
  const words = normalizeKeyword(keyword).split(" ").length;
  const volume = Math.max(10, Math.round((120 / words) * Math.max(1, hits) * 8));
  const competition = Math.min(1, Number((0.15 + words * 0.05 + Math.min(hits, 10) * 0.02).toFixed(2)));
  const trend = Number(Math.min(100, hits * 12 + (words <= 4 ? 20 : 8)).toFixed(1));
  return { volume, competition, trend };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function keywordDensity(text: string, keyword: string): number {
  const body = normalizeKeyword(text);
  const k = normalizeKeyword(keyword);
  if (!k) return 0;
  const total = body.split(" ").filter(Boolean).length || 1;
  const occurrences = body.split(k).length - 1;
  return (occurrences * k.split(" ").length) / total;
}
