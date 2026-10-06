import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Globe2, LockKeyhole, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AdSlot } from "@/components/ad-slot";
import { listSeoPages } from "@/lib/seo/pages.functions";
import type { SeoPageRecord } from "@/lib/seo/public.server";
import { SITE_NAME, SITE_URL } from "@/lib/seo/taxonomy";

const worldwidePages = [
  {
    path: "/safe-random-video-chat",
    title: "Safe random video chat",
    description: "Practical safety boundaries, adult-only use, and how to respond if a conversation feels wrong.",
    icon: ShieldCheck,
  },
  {
    path: "/random-video-chat-worldwide",
    title: "Meet people worldwide",
    description: "What to expect from global random matching, language differences, and connection quality.",
    icon: Globe2,
  },
  {
    path: "/anonymous-video-chat",
    title: "Anonymous video chat",
    description: "Start without a phone number or email, and understand the limits of online anonymity.",
    icon: LockKeyhole,
  },
] as const;

export const Route = createFileRoute("/explore/")({
  loader: async (): Promise<SeoPageRecord[]> => (await listSeoPages()) as SeoPageRecord[],
  head: () => ({
    meta: [
      { title: `Explore communities & guides — ${SITE_NAME}` },
      {
        name: "description",
        content:
          "Browse every Meetup community hub, city page and safety guide — free, anonymous video and text chat with no phone number required.",
      },
      { property: "og:title", content: `Explore communities & guides — ${SITE_NAME}` },
      {
        property: "og:description",
        content: "Community hubs, city pages and safety guides for free anonymous video chat.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/explore` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/explore` }],
  }),
  component: ExploreIndex,
});

function ExploreIndex() {
  const pages = Route.useLoaderData() as SeoPageRecord[];
  const groups = new Map<string, typeof pages>();
  for (const p of pages) {
    const key = p.cluster ?? "other";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-foreground">
          <Compass className="h-7 w-7 text-primary" /> Explore
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Community hubs, city pages and safety guides — every page is built from real rooms and
          real members on {SITE_NAME}.
        </p>

        <section className="mt-8 border-y border-border py-6" aria-labelledby="worldwide-guides">
          <h2 id="worldwide-guides" className="font-display text-lg font-semibold text-foreground">
            Worldwide video chat guides
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Clear, practical information for adults meeting people through random video and text chat.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {worldwidePages.map(({ path, title, description, icon: Icon }) => (
              <li key={path}>
                <Link
                  to={path}
                  className="block h-full border-b-2 border-border py-4 transition-colors hover:border-teal"
                >
                  <Icon aria-hidden="true" className="h-5 w-5 text-teal" />
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {pages.length === 0 && (
          <p className="mt-8 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No explore pages published yet. They appear here as soon as the growth engine finds
            on-topic searches backed by real community activity.
          </p>
        )}

        {[...groups.entries()].map(([cluster, items]) => (
          <section key={cluster} className="mt-8">
            <h2 className="font-display text-lg font-semibold capitalize text-foreground">
              {cluster}
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {items.map((p) => (
                <li key={p.slug}>
                  <Link
                    to="/explore/$slug"
                    params={{ slug: p.slug }}
                    className="block h-full rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                  >
                    <p className="text-sm font-semibold text-card-foreground">{p.h1}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <AdSlot />
      <SiteFooter />
    </div>
  );
}
