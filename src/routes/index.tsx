import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { listSeoPages } from "@/lib/seo/pages.functions";
import type { SeoPageRecord } from "@/lib/seo/public.server";

import {
  Shield,
  Lock,
  Globe2,
  Sparkles,
  Zap,
  UserX,
  Check,
  X as XIcon,
  ArrowRight,
  Camera,
  MessageSquare,
  Users,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { PrivateCta } from "@/components/private-cta";
import { SiteFooter } from "@/components/site-footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meetup — Safe anonymous video chat in India (OmeTV alternative)" },
      {
        name: "description",
        content:
          "Random video chat with strangers across India. No login, no phone number, no tracking. Built-in safety features make it the best OmeTV alternative.",
      },
      { property: "og:title", content: "Meetup — Safe anonymous video chat in India" },
      {
        property: "og:description",
        content: "Free random video chat. 100% anonymous. India-focused. Safer than OmeTV.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    debug: typeof search.debug === "string" ? search.debug : undefined,
  }),
  loader: async (): Promise<FeedData> => {
    const startedAt = Date.now();
    try {
      const all = (await listSeoPages()) as SeoPageRecord[];
      return {
        pages: all.slice(0, 6),
        total: all.length,
        error: null,
        ms: Date.now() - startedAt,
        fetchedAt: new Date().toISOString(),
      };
    } catch (e) {
      return {
        pages: [],
        total: 0,
        error: e instanceof Error ? e.message : String(e),
        ms: Date.now() - startedAt,
        fetchedAt: new Date().toISOString(),
      };
    }
  },
  component: HomePage,
});

interface FeedData {
  pages: SeoPageRecord[];
  total: number;
  error: string | null;
  ms: number;
  fetchedAt: string;
}

function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <Hero />
      <SocialProof />
      <FreshToday />
      <PrivateCta />
      <FeatureGrid />
      <SafetySection />
      <ComparisonTable />
      <HowItWorks />
      <FAQ />
      <Waitlist />
      <SiteFooter />
      <Toaster richColors position="top-center" />
    </div>
  );
}

function FreshToday() {
  const data = Route.useLoaderData() as FeedData;
  const { debug } = Route.useSearch();
  const debugOn = debug === "feed" || debug === "1";
  const pages = data.pages;

  if (!pages.length && !debugOn) return null;

  const dateFmt = (v: string | null) =>
    v
      ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal">
            New every day
          </p>
          <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl text-balance">
            Fresh from Meetup today
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            New guides, city rooms and safety tips are published here daily.
          </p>
        </div>
        <Button asChild variant="cream" size="lg">
          <Link to="/explore">See everything</Link>
        </Button>
      </div>

      {debugOn && (
        <pre className="mt-8 overflow-x-auto rounded-xl border border-border bg-secondary/50 p-4 text-xs text-foreground">
{JSON.stringify(
  {
    published_total: data.total,
    shown: pages.length,
    loader_ms: data.ms,
    fetched_at: data.fetchedAt,
    error: data.error,
    slugs: pages.map((p) => p.slug),
  },
  null,
  2,
)}
        </pre>
      )}

      {!pages.length ? (
        <p className="mt-10 rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No published pages found yet. The daily content engine publishes new pages automatically;
          an admin can also run it now from the SEO dashboard.
        </p>
      ) : (
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => (
            <Link
              key={p.slug}
              to="/explore/$slug"
              params={{ slug: p.slug }}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elev"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-teal">
                {p.category ?? p.kind}
              </span>
              <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground">{p.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>
              <span className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                {dateFmt(p.published_at ?? p.updated_at)}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}



function Hero() {
  return (
    <section className="bg-hero grain relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-teal/30 blur-3xl animate-float" />
        <div className="absolute right-0 top-40 h-96 w-96 rounded-full bg-teal-soft/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="text-cream">
            <div className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/5 px-3 py-1.5 text-xs font-medium text-cream/85 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
              </span>
              India's anonymous video chat — built privacy-first
            </div>

            <h1 className="mt-6 text-4xl font-bold leading-[1.05] text-cream sm:text-5xl lg:text-6xl text-balance">
              Talk to <span className="text-teal-soft">someone new</span> without giving up your identity.
            </h1>

            <p className="mt-5 max-w-xl text-base text-cream/75 sm:text-lg">
              Random one-on-one video chat for India. No phone number. No email. No login.
              Just press start and meet someone in seconds — with safety built in by default.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="xl">
                <Link to="/chat">
                  Start chatting free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="cream" size="xl">
                <Link to="/safety">How we keep you safe</Link>
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-cream/70">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-teal-soft" /> No sign-up</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-teal-soft" /> Works on 2G/3G</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-teal-soft" /> Free forever</span>
            </div>
          </div>

          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative aspect-[9/12] overflow-hidden rounded-3xl border border-cream/10 bg-deep/60 p-3 shadow-elev backdrop-blur">
        <div className="grid h-full grid-rows-2 gap-3">
          <div className="relative overflow-hidden rounded-2xl bg-teal-grad">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,white_0%,transparent_50%)] opacity-30" />
            <div className="absolute bottom-3 left-3 rounded-full bg-deep/70 px-3 py-1 text-xs font-medium text-cream backdrop-blur">
              Stranger · Mumbai
            </div>
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-success/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Live
            </div>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-deep to-teal/40">
            <div className="absolute bottom-3 left-3 rounded-full bg-deep/70 px-3 py-1 text-xs font-medium text-cream backdrop-blur">
              You · Anonymous
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-cream px-5 py-3 shadow-elev">
        <div className="flex items-center gap-3 text-deep">
          <button className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><Camera className="h-4 w-4" /></button>
          <button className="grid h-12 w-12 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-soft animate-pulse-ring">
            <ArrowRight className="h-5 w-5" />
          </button>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><MessageSquare className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

function SocialProof() {
  return (
    <section className="border-y border-border bg-background py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {[
            { v: "0", l: "Personal data stored" },
            { v: "100%", l: "Peer-to-peer video" },
            { v: "<2s", l: "Match time" },
            { v: "24/7", l: "Auto-moderation" },
          ].map((s) => (
            <div key={s.l}>
              <div className="font-display text-3xl font-bold text-foreground sm:text-4xl">{s.v}</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  const features = [
    {
      icon: Lock,
      title: "Truly anonymous",
      desc: "We don't ask for your name, email or phone. Each session uses a random ID that never leaves your device.",
    },
    {
      icon: Shield,
      title: "Safety by default",
      desc: "Auto-disconnect on abuse signals, instant report button, and karma-based bans for repeat offenders.",
    },
    {
      icon: Zap,
      title: "Built for India",
      desc: "Optimised for low-bandwidth networks. Works smoothly on entry-level Android phones over 3G/4G.",
    },
    {
      icon: Globe2,
      title: "Peer-to-peer video",
      desc: "Your video & audio go directly between you and the stranger. We never see, store, or record any of it.",
    },
    {
      icon: UserX,
      title: "One tap to skip",
      desc: "Don't like the vibe? Skip instantly. Match again in under two seconds.",
    },
    {
      icon: Sparkles,
      title: "Premium filters",
      desc: "Upgrade to choose gender, country, and unlock unlimited skips & reconnect.",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal">Why Meetup</p>
        <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl text-balance">
          Random chat without the random risk
        </h2>
        <p className="mt-4 text-muted-foreground">
          Most random video apps feel sketchy. We built Meetup to feel like meeting someone new
          at a chai stall — friendly, low-pressure, and safe.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elev"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-grad text-white shadow-soft">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SafetySection() {
  const items = [
    "End-to-end encrypted signaling (HTTPS + WSS)",
    "No video, audio, or chat is ever stored",
    "AI-assisted abuse detection on text chat",
    "Instant report → instant disconnect",
    "Reputation system bans repeat offenders",
    "Strict 18+ enforcement on every session",
  ];

  return (
    <section className="bg-deep text-cream">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-soft">Safety center</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl text-balance">
            Privacy isn't a setting. It's the default.
          </h2>
          <p className="mt-4 text-cream/70">
            Most chat apps trade your data for "personalisation". We don't collect anything to begin with.
            No accounts means no leaks, no breaches, no tracking pixels following you around.
          </p>
          <Button asChild variant="hero" size="lg" className="mt-7">
            <Link to="/safety">Read the safety promise</Link>
          </Button>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <li
              key={it}
              className="flex items-start gap-3 rounded-xl border border-cream/10 bg-cream/5 p-4 text-sm backdrop-blur"
            >
              <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-teal text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-cream/90">{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ComparisonTable() {
  const rows = [
    { f: "No login required", us: true, ome: true, others: false },
    { f: "No phone number ever", us: true, ome: false, others: false },
    { f: "Peer-to-peer video (we never see it)", us: true, ome: false, others: false },
    { f: "India-optimised low-bandwidth mode", us: true, ome: false, others: false },
    { f: "Free unlimited matches", us: true, ome: true, others: false },
    { f: "Hindi keyword moderation", us: true, ome: false, others: false },
    { f: "Karma-based safety system", us: true, ome: false, others: false },
    { f: "No third-party ad tracking", us: true, ome: false, others: false },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal">Comparison</p>
        <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl text-balance">
          Meetup vs OmeTV vs the rest
        </h2>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-left">
                <th className="p-4 font-semibold text-foreground">Feature</th>
                <th className="p-4 text-center font-semibold text-teal">Meetup</th>
                <th className="p-4 text-center font-medium text-muted-foreground">OmeTV</th>
                <th className="p-4 text-center font-medium text-muted-foreground">Others</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.f}
                  className={i % 2 === 0 ? "bg-background" : "bg-secondary/30"}
                >
                  <td className="p-4 text-foreground">{r.f}</td>
                  <Cell yes={r.us} highlight />
                  <Cell yes={r.ome} />
                  <Cell yes={r.others} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Cell({ yes, highlight }: { yes: boolean; highlight?: boolean }) {
  return (
    <td className="p-4 text-center">
      <span
        className={`inline-grid h-7 w-7 place-items-center rounded-full ${
          yes
            ? highlight
              ? "bg-teal text-white"
              : "bg-success/15 text-success"
            : "bg-destructive/10 text-destructive"
        }`}
      >
        {yes ? <Check className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
      </span>
    </td>
  );
}

function HowItWorks() {
  const steps = [
    { i: Camera, t: "Allow camera + mic", d: "One-tap browser permission. We never record." },
    { i: Users, t: "Auto-match in seconds", d: "Our queue pairs you with the next available person." },
    { i: MessageSquare, t: "Talk or chat", d: "Use video, voice, or text. Skip anytime." },
    { i: Heart, t: "Make a connection", d: "Stay anonymous, or upgrade for filters & reconnect." },
  ];
  return (
    <section className="bg-cream-grad py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal">How it works</p>
          <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl text-balance">
            Live chat in four taps
          </h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, idx) => (
            <div
              key={s.t}
              className="relative rounded-2xl border border-border bg-card p-6 shadow-soft"
            >
              <div className="font-display text-5xl font-bold text-teal/15">0{idx + 1}</div>
              <div className="-mt-4 grid h-10 w-10 place-items-center rounded-xl bg-teal-grad text-white shadow-soft">
                <s.i className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const qa = [
    {
      q: "Is Meetup really free?",
      a: "Yes. Random video chat is free forever. We offer optional Premium for filters, unlimited skips, and reconnect — but the core experience is 100% free.",
    },
    {
      q: "Do I need to sign up?",
      a: "No. There's no email, no phone, no Google login. Just open the chat page and tap start. Your browser holds an anonymous session ID that you can reset anytime.",
    },
    {
      q: "Is my video saved anywhere?",
      a: "Never. Video and audio go peer-to-peer between you and the stranger using WebRTC. Our servers only help you find each other — they don't see the call.",
    },
    {
      q: "Will it work on my old Android phone?",
      a: "Yes. Meetup is built mobile-first and tested on entry-level Androids over 3G. We auto-adjust video quality based on your network.",
    },
    {
      q: "What if someone misbehaves?",
      a: "Tap the Report button and you're disconnected instantly. Our karma system auto-bans repeat offenders across sessions.",
    },
    {
      q: "Is this an OmeTV alternative?",
      a: "Yes — and we believe a safer one. OmeTV requires phone verification and stores chat history; Meetup does neither.",
    },
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal">FAQ</p>
        <h2 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">Frequently asked</h2>
      </div>
      <div className="mt-10 space-y-3">
        {qa.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-border bg-card p-5 shadow-soft transition-all open:shadow-elev"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-foreground">
              {item.q}
              <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-secondary text-muted-foreground transition-transform group-open:rotate-45">
                <ArrowRight className="h-4 w-4 -rotate-45" />
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Waitlist() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: trimmed, referral_source: "landing" });
    setLoading(false);
    if (error && !error.message.includes("duplicate")) {
      toast.error("Something went wrong. Try again.");
      return;
    }
    setDone(true);
    toast.success("You're on the list. Check your inbox soon!");
  }

  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl bg-deep p-8 text-cream shadow-elev sm:p-12">
        <div className="grid gap-8 lg:grid-cols-[1.2fr,1fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl text-balance">
              Be first to get Premium perks
            </h2>
            <p className="mt-3 text-cream/70">
              Join the waitlist for early access to gender filters, country filters, and the
              India-only mode. Plus referral rewards.
            </p>
          </div>
          {done ? (
            <div className="rounded-2xl border border-teal/30 bg-teal/10 p-5 text-center">
              <Check className="mx-auto mb-2 h-7 w-7 text-teal-soft" />
              <p className="font-semibold">You're in!</p>
              <p className="mt-1 text-sm text-cream/65">
                We'll email you when Premium opens up.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                className="h-12 border-cream/15 bg-cream/5 text-cream placeholder:text-cream/40 focus-visible:ring-teal"
              />
              <Button type="submit" variant="hero" size="lg" disabled={loading}>
                {loading ? "Joining…" : "Join waitlist"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
