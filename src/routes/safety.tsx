import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Lock, Eye, Server, AlertTriangle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety center — Meetup" },
      {
        name: "description",
        content:
          "How Meetup keeps random video chat safe: peer-to-peer video, anonymous sessions, instant reporting and karma-based moderation.",
      },
      { property: "og:title", content: "Safety center — Meetup" },
      {
        property: "og:description",
        content: "Privacy-first random video chat. Learn how we keep you safe.",
      },
    ],
  }),
  component: SafetyPage,
});

function SafetyPage() {
  const pillars = [
    {
      icon: Lock,
      t: "Anonymous by default",
      d: "Every session uses a random ID generated in your browser. We never ask for your name, phone, or email. You can reset your ID anytime by clearing site data.",
    },
    {
      icon: Eye,
      t: "We can't see your call",
      d: "Video and audio go peer-to-peer over WebRTC. Once you're matched, your stream goes directly to the other person. Our servers don't see, store, or relay any of it.",
    },
    {
      icon: Shield,
      t: "Instant reports & karma bans",
      d: "Tap Report and you're disconnected immediately. Reports feed into a karma score — repeat offenders are auto-banned across all future sessions.",
    },
    {
      icon: AlertTriangle,
      t: "Text chat moderation",
      d: "Our text chat blocks abusive language, phone numbers, and external links automatically — in both English and Hindi.",
    },
    {
      icon: Server,
      t: "Encrypted in transit",
      d: "All signaling uses HTTPS + secure WebSockets. Media uses DTLS-SRTP encryption (a WebRTC requirement) end-to-end between peers.",
    },
    {
      icon: Heart,
      t: "Strict 18+",
      d: "You must be 18 or older to use Meetup. If a stranger appears underage, please report them — we take this very seriously.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="bg-hero grain text-cream">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/5 px-3 py-1 text-xs font-medium backdrop-blur">
            <Shield className="h-3.5 w-3.5 text-teal-soft" /> Safety center
          </span>
          <h1 className="mt-5 text-4xl font-bold text-cream sm:text-5xl text-balance">
            Your safety is the whole product.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-cream/75">
            Other random chat apps add safety as an afterthought. Meetup was built around it.
            Here's everything we do — and don't do — to keep you safe.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {pillars.map((p) => (
            <div key={p.t} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-grad text-white">
                <p.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-foreground">{p.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
          <h2 className="text-xl font-bold text-foreground">Community ground rules</h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>• No nudity, sexual content, or sexual solicitation.</li>
            <li>• No harassment, hate speech, or discrimination.</li>
            <li>• No sharing of personal contact info (yours or anyone else's).</li>
            <li>• No spam, scams, or self-promotion.</li>
            <li>• No recording or screenshotting your matches.</li>
            <li>• You must be 18 or older.</li>
          </ul>
          <p className="mt-5 text-sm text-muted-foreground">
            Breaking these rules results in instant disconnect and an automatic ban.
          </p>
        </div>

        <div className="mt-10 text-center">
          <Button asChild variant="hero" size="lg">
            <Link to="/chat">Start chatting safely</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
