/**
 * Server-side read access to published SEO pages using the publishable key.
 * Only rows with status = 'published' are readable (enforced by RLS).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SeoFaq {
  question: string;
  answer: string;
}
export interface SeoSection {
  heading: string;
  body: string;
}

export interface SeoPageRecord {
  slug: string;
  kind: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  sections: SeoSection[];
  faqs: SeoFaq[];
  keywords: string[];
  primary_keyword: string | null;
  category: string | null;
  city: string | null;
  country: string | null;
  cluster: string | null;
  room_slug: string | null;
  related_slugs: string[];
  word_count: number;
  published_at: string | null;
  refreshed_at: string | null;
  updated_at: string;
}

export function publicSupabase(): SupabaseClient {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!;
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers: h });
      },
    },
  });
}

const COLUMNS =
  "slug,kind,title,description,h1,intro,sections,faqs,keywords,primary_keyword,category,city,country,cluster,room_slug,related_slugs,word_count,published_at,refreshed_at,updated_at";

export async function fetchPublishedPage(slug: string): Promise<SeoPageRecord | null> {
  const { data } = await publicSupabase()
    .from("seo_pages")
    .select(COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as unknown as SeoPageRecord) ?? null;
}

export async function fetchPublishedIndex(): Promise<SeoPageRecord[]> {
  const { data } = await publicSupabase()
    .from("seo_pages")
    .select(COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);
  return (data as unknown as SeoPageRecord[]) ?? [];
}
