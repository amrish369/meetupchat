import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Meetup" },
      {
        name: "description",
        content:
          "Meetup is an India-first anonymous video chat platform built around safety, privacy, and respect.",
      },
      { property: "og:title", content: "About Meetup" },
      {
        property: "og:description",
        content: "Why we're building India's safest random video chat.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal">Our story</p>
        <h1 className="mt-2 text-4xl font-bold text-foreground sm:text-5xl text-balance">
          A safer way for India to meet new people online.
        </h1>
        <div className="prose prose-neutral mt-8 max-w-none text-muted-foreground">
          <p className="text-lg leading-relaxed">
            We grew up with random chat apps that promised connection and delivered creeps. Most
            apps treat safety like a setting buried five menus deep. We thought: what if safety
            was the product itself?
          </p>
          <p className="mt-4 leading-relaxed">
            Meetup is built for India. Optimised for the networks people actually use, the phones
            people actually own, and the languages people actually speak. Hindi-aware moderation,
            data-light video, and zero personal info collected — ever.
          </p>
          <p className="mt-4 leading-relaxed">
            Our promise is simple: we will never ask for your name, phone number, or email to use
            the core product. We don't store your video. We don't track you across the web. Your
            conversation is yours.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { v: "0", l: "Personal data collected" },
            { v: "100%", l: "Peer-to-peer video" },
            { v: "🇮🇳", l: "Made in India" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
              <div className="font-display text-3xl font-bold text-foreground">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild variant="hero" size="lg">
            <Link to="/chat">Try Meetup</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
