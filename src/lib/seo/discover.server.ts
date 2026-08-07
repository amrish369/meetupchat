/**
 * Keyword discovery.
 *
 * Uses the Firecrawl connector's /v2/search endpoint over a set of seed queries
 * built from our own taxonomy + live rooms, then keeps ONLY phrases that pass
 * the topic allowlist. No scraping of copyrighted page bodies — we read result
 * titles/snippets (public SERP metadata) and our own seeds.
 *
 * If Firecrawl is not connected, the engine still runs using deterministic
 * seed expansion, so no part of the pipeline silently breaks.
 */
import {
  CATEGORIES,
  REGIONS,
  classifyIntent,
  detectCategory,
  detectRegion,
  estimateDemand,
  isRelevantKeyword,
  normalizeKeyword,
} from "./taxonomy";

export interface KeywordCandidate {
  keyword: string;
  normalized: string;
  source: string;
  topic: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  category: string | null;
  intent: string;
  volume_estimate: number;
  competition: number;
  trend_score: number;
}

const FIRECRAWL_DIRECT = "https://api.firecrawl.dev/v2";
const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

function seedQueries(roomNames: string[]): string[] {
  const queries: string[] = [];
  for (const cat of Object.values(CATEGORIES)) {
    queries.push(`${cat.seeds[0]} India trending`);
  }
  for (const key of Object.keys(REGIONS).slice(0, 6)) {
    queries.push(`online community meetup ${REGIONS[key].city}`);
  }
  queries.push("best free video chat community 2026");
  queries.push("how to meet new people online safely");
  for (const name of roomNames.slice(0, 4)) {
    queries.push(`${name} online community chat`);
  }
  return queries;
}

/** Extract candidate search phrases from public SERP titles / snippets. */
function phrasesFrom(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/[|·—–:\u2022\-–,.?!]+/).map((p) => p.trim());
  const out: string[] = [];
  for (const part of parts) {
    const words = part.split(" ").filter(Boolean);
    if (words.length < 2 || words.length > 8) continue;
    out.push(words.join(" ").toLowerCase());
  }
  return out;
}

async function firecrawlSearch(query: string): Promise<string[]> {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) return [];
  const gateway = key.startsWith("lovc_");
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (gateway && !lovableKey) return [];

  const res = await fetch(`${gateway ? FIRECRAWL_GATEWAY : FIRECRAWL_DIRECT}/search`, {
    method: "POST",
    headers: gateway
      ? {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": key,
        }
      : { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, limit: 8, lang: "en", country: "in", tbs: "qdr:m" }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl search failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{ title?: string; description?: string }> | { web?: Array<{ title?: string; description?: string }> };
  };
  const rows = Array.isArray(json.data) ? json.data : (json.data?.web ?? []);
  const out: string[] = [];
  for (const row of rows) {
    out.push(...phrasesFrom(`${row.title ?? ""} ${row.description ?? ""}`));
  }
  return out;
}

function fallbackPhrases(roomNames: string[]): string[] {
  const out: string[] = [];
  for (const [catKey, cat] of Object.entries(CATEGORIES)) {
    for (const seed of cat.seeds) {
      out.push(`${seed} online`);
      out.push(`${seed} india`);
      out.push(`free ${seed} community`);
      void catKey;
    }
  }
  for (const region of Object.values(REGIONS)) {
    out.push(`online community meetup ${region.city.toLowerCase()}`);
    out.push(`video chat community ${region.city.toLowerCase()}`);
  }
  for (const name of roomNames) out.push(`${name.toLowerCase()} online community`);
  return out;
}

export async function discoverKeywords(
  roomNames: string[],
  log: (msg: string) => void,
): Promise<{ candidates: KeywordCandidate[]; found: number; sources: string[] }> {
  const counts = new Map<string, { keyword: string; hits: number; source: string }>();
  const sources: string[] = [];
  let found = 0;

  const queries = seedQueries(roomNames);
  let firecrawlWorked = false;

  for (const query of queries) {
    try {
      const phrases = await firecrawlSearch(query);
      if (phrases.length) {
        firecrawlWorked = true;
        found += phrases.length;
        for (const p of phrases) {
          const n = normalizeKeyword(p);
          const prev = counts.get(n);
          if (prev) prev.hits += 1;
          else counts.set(n, { keyword: p, hits: 1, source: "firecrawl:search" });
        }
      }
    } catch (err) {
      log(`Discovery warning for "${query}": ${(err as Error).message}`);
    }
  }
  if (firecrawlWorked) sources.push("firecrawl:search");

  if (!firecrawlWorked) {
    log("Firecrawl unavailable — falling back to taxonomy seed expansion.");
    sources.push("seed-expansion");
    for (const p of fallbackPhrases(roomNames)) {
      found += 1;
      const n = normalizeKeyword(p);
      const prev = counts.get(n);
      if (prev) prev.hits += 1;
      else counts.set(n, { keyword: p, hits: 1, source: "seed-expansion" });
    }
  }

  const candidates: KeywordCandidate[] = [];
  for (const [normalized, row] of counts) {
    if (!isRelevantKeyword(row.keyword)) continue;
    const region = detectRegion(row.keyword);
    const demand = estimateDemand(row.keyword, row.hits);
    candidates.push({
      keyword: row.keyword,
      normalized,
      source: row.source,
      topic: detectCategory(row.keyword) ?? (region ? "region" : "community"),
      country: region?.country ?? "India",
      state: region?.state ?? null,
      city: region?.city ?? null,
      category: detectCategory(row.keyword),
      intent: classifyIntent(row.keyword),
      volume_estimate: demand.volume,
      competition: demand.competition,
      trend_score: demand.trend,
    });
  }

  candidates.sort((a, b) => b.trend_score - a.trend_score);
  return { candidates, found, sources };
}
