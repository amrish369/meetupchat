import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, ShieldCheck, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { ShareRow } from "@/components/share-row";
import { SiteFooter } from "@/components/site-footer";
import { getSeoPage } from "@/lib/seo/pages.functions";
import type { SeoPageRecord } from "@/lib/seo/public.server";
import { SITE_NAME, SITE_URL } from "@/lib/seo/taxonomy";

export const Route = createFileRoute("/explore/$slug")({
  loader: async ({ params }): Promise<SeoPageRecord> => {
    const page = (await getSeoPage({ data: { slug: params.slug } })) as SeoPageRecord | null;
    if (!page) throw notFound();
    return page;
  },
  head: ({ params, loaderData }) => {
    const url = `${SITE_URL}/explore/${params.slug}`;
    if (!loaderData) return { meta: [{ title: `Explore — ${SITE_NAME}` }] };
    return {
      meta: [
        { title: loaderData.title },
        { name: "description", content: loaderData.description },
        { name: "keywords", content: loaderData.keywords.join(", ") },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: loaderData.title },
        { name: "twitter:description", content: loaderData.description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: loaderData.h1,
                description: loaderData.description,
                mainEntityOfPage: url,
                datePublished: loaderData.published_at,
                dateModified: loaderData.refreshed_at ?? loaderData.published_at,
                author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
                publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                  { "@type": "ListItem", position: 2, name: "Explore", item: `${SITE_URL}/explore` },
                  { "@type": "ListItem", position: 3, name: loaderData.h1, item: url },
                ],
              },
              ...(loaderData.faqs.length
                ? [
                    {
                      "@type": "FAQPage",
                      mainEntity: loaderData.faqs.map((f) => ({
                        "@type": "Question",
                        name: f.question,
                        acceptedAnswer: { "@type": "Answer", text: f.answer },
                      })),
                    },
                  ]
                : []),
            ],
          }),
        },
      ],
    };
  },
  component: ExplorePage,
});

function ExplorePage() {
  const page = Route.useLoaderData() as SeoPageRecord;

  return (
    <div className="min-h-screen bg-background pb-24">
      <SiteHeader />

      <article className="mx-auto max-w-3xl px-4 py-8">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span className="mx-1">/</span>
          <Link to="/explore" className="hover:text-foreground">Explore</Link>
          <span className="mx-1">/</span>
          <span className="text-foreground">{page.h1}</span>
        </nav>

        <h1 className="font-display text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          {page.h1}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{page.intro}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/chat">
              <Video className="mr-2 h-4 w-4" /> Start a free video chat
            </Link>
          </Button>
          {page.room_slug ? (
            <Button variant="secondary" asChild>
              <Link to="/rooms/$slug" params={{ slug: page.room_slug }}>
                <MessageCircle className="mr-2 h-4 w-4" /> Open this room
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <Link to="/rooms">
                <Users className="mr-2 h-4 w-4" /> Browse community rooms
              </Link>
            </Button>
          )}
        </div>

        {page.sections.map((section) => (
          <section key={section.heading} className="mt-8">
            <h2 className="font-display text-xl font-semibold text-foreground">{section.heading}</h2>
            {section.body.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {para}
              </p>
            ))}
          </section>
        ))}

        {page.faqs.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Frequently asked questions
            </h2>
            <dl className="mt-4 space-y-4">
              {page.faqs.map((faq) => (
                <div key={faq.question} className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-sm font-semibold text-card-foreground">{faq.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <aside className="mt-10 rounded-xl border border-border bg-muted/40 p-4">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            {SITE_NAME} is an online-only, 18+ community. Every chat is moderated for abuse and
            explicit content, screen recording is blocked, and you can report or block anyone
            instantly. We do not organise physical events.
          </p>
        </aside>

        <ShareRow url={`${SITE_URL}/explore/${page.slug}`} title={page.title} />

        {page.related_slugs?.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-semibold text-foreground">Related pages</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {page.related_slugs.map((slug) => (
                <li key={slug}>
                  <Link
                    to="/explore/$slug"
                    params={{ slug }}
                    className="block rounded-lg border border-border bg-card px-3 py-2 text-sm text-card-foreground transition-colors hover:border-primary"
                  >
                    {slug.replace(/-/g, " ")}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10">
          <Link
            to="/explore"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Explore
          </Link>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}
