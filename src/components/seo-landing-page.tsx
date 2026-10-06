import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SITE_NAME, SITE_URL } from "@/lib/seo/taxonomy";

export interface SeoLandingSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface SeoLandingFaq {
  question: string;
  answer: string;
}

export interface SeoLandingContent {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  sections: SeoLandingSection[];
  faqs: SeoLandingFaq[];
  safetyNote: string;
}

const relatedPages = [
  { path: "/safe-random-video-chat", label: "Safe random video chat" },
  { path: "/random-video-chat-worldwide", label: "Meet people worldwide" },
  { path: "/anonymous-video-chat", label: "Anonymous video chat" },
] as const;

export function SeoLandingPage({ page }: { page: SeoLandingContent }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b border-border bg-secondary/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal">
                <span className="h-2 w-2 rounded-full bg-teal" /> {page.eyebrow}
              </p>
              <h1 className="mt-5 text-balance font-display text-4xl font-bold leading-tight text-foreground sm:text-5xl">
                {page.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {page.intro}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="hero" size="lg">
                  <Link to="/chat">
                    Start a random chat <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/safety">Read the safety center</Link>
                </Button>
              </div>
              <p className="mt-5 text-sm text-muted-foreground">For adults 18 and older. Free to start; no phone number or email is needed for random chat.</p>
            </div>
          </div>
        </section>

        <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
            <Link to="/explore" className="hover:text-foreground">Explore</Link>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
            <span aria-current="page" className="truncate text-foreground">{page.eyebrow}</span>
          </nav>

          <p className="text-lg leading-relaxed text-foreground">{page.description}</p>
          {page.sections.map((section, index) => (
            <section key={section.heading} className="border-b border-border py-8 last:border-b-0">
              <p className="text-xs font-semibold uppercase text-teal">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 border-l-2 border-teal/50 pl-4 text-sm leading-relaxed text-foreground">
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="border-t border-border py-9" aria-labelledby="landing-faq-title">
            <h2 id="landing-faq-title" className="font-display text-2xl font-semibold text-foreground">Common questions</h2>
            <dl className="mt-5 divide-y divide-border">
              {page.faqs.map((faq) => (
                <div key={faq.question} className="py-5">
                  <dt className="font-semibold text-foreground">{faq.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="flex gap-3 border-y border-border py-5 text-sm leading-relaxed text-muted-foreground">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
            <p>{page.safetyNote}</p>
          </aside>

          <nav aria-label="Related guides" className="mt-10">
            <h2 className="font-display text-lg font-semibold text-foreground">More from {SITE_NAME}</h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {relatedPages.filter((item) => item.path !== page.path).map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="text-teal underline-offset-4 hover:underline">{item.label}</Link>
                </li>
              ))}
              <li><Link to="/safety" className="text-teal underline-offset-4 hover:underline">Safety center</Link></li>
            </ul>
          </nav>
          <p className="mt-8 text-xs text-muted-foreground">{SITE_NAME} is an online service; availability and call quality depend on your device, browser, network, and people currently online.</p>
          <p className="mt-2 text-xs text-muted-foreground">Page address: {SITE_URL}{page.path}</p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}