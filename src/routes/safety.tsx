import { createFileRoute, Link } from "@tanstack/react-router";

import {
  Shield,
  Lock,
  Eye,
  Server,
  AlertTriangle,
  Heart,
  BadgeCheck,
  UserX,
  Siren,
  Globe,
  MessageSquareWarning,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      {
        title: "Safety Center — Meetup",
      },

      {
        name: "description",
        content:
          "Meetup Safety Center — Learn how our anonymous random video chat platform protects privacy with WebRTC peer-to-peer encryption, moderation systems, reporting tools, and trust-first safety features.",
      },

      {
        property: "og:title",
        content: "Meetup Safety Center",
      },

      {
        property: "og:description",
        content:
          "Privacy-first random video chat with anonymous sessions, moderation, reporting, and encrypted peer-to-peer communication.",
      },

      {
        property: "og:type",
        content: "website",
      },
    ],
  }),

  component: SafetyPage,
});

function SafetyPage() {
  const pillars = [
    {
      icon: Lock,
      title: "Anonymous by default",
      description:
        "Meetup never requires your real name, phone number, or public identity. Every session uses a temporary anonymous ID generated securely inside your browser.",
    },

    {
      icon: Eye,
      title: "We cannot watch your calls",
      description:
        "Your audio and video travel directly between participants using peer-to-peer WebRTC. Meetup servers never store or monitor live conversations.",
    },

    {
      icon: Shield,
      title: "Realtime reporting system",
      description:
        "If someone behaves badly, one tap instantly disconnects them. Reports feed into our automated karma moderation engine for faster bans.",
    },

    {
      icon: AlertTriangle,
      title: "AI-assisted moderation",
      description:
        "Our system automatically blocks abusive language, spam, scams, links, and suspicious behavior patterns in both English and Hindi.",
    },

    {
      icon: Server,
      title: "Encrypted communication",
      description:
        "All connections use HTTPS, secure WebSockets, and DTLS-SRTP encryption to protect traffic between peers during every session.",
    },

    {
      icon: Heart,
      title: "Strictly 18+ only",
      description:
        "Meetup is only for adults. Any suspected underage account is removed immediately after verification and investigation.",
    },
  ];

  const safetyStats = [
    {
      value: "99.2%",
      label: "Spam blocked automatically",
    },

    {
      value: "<1s",
      label: "Average report disconnect time",
    },

    {
      value: "24/7",
      label: "Automated moderation systems",
    },

    {
      value: "0",
      label: "Stored video recordings",
    },
  ];

  const rules = [
    "No nudity or sexual content",
    "No hate speech or harassment",
    "No sharing personal information",
    "No scams or promotions",
    "No recording conversations",
    "No impersonation or fake identity abuse",
    "No threats or intimidation",
    "Users must be 18+",
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-hero grain text-cream">
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <Badge className="border border-cream/15 bg-cream/10 px-4 py-1 text-cream backdrop-blur-md">
              <Shield className="mr-2 h-4 w-4 text-teal-soft" />
              Meetup Safety Center
            </Badge>

            <h1 className="mx-auto mt-6 max-w-4xl text-balance text-4xl font-bold leading-tight text-cream sm:text-5xl lg:text-6xl">
              Safety is not a feature.
              <span className="block text-teal-soft">
                It is the foundation.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-cream/75">
              Most random chat apps treat safety as an afterthought.
              Meetup was designed from the ground up around privacy,
              trust, moderation, and anonymous communication.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" variant="hero">
                <Link to="/chat">
                  Start Safe Chatting
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild size="lg" variant="glass">
                <Link to="/privacy">
                  Privacy Policy
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-border bg-card/30 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6 lg:px-8">
          {safetyStats.map((item) => (
            <div
              key={item.label}
              className="text-center"
            >
              <div className="text-3xl font-bold text-foreground">
                {item.value}
              </div>

              <div className="mt-1 text-sm text-muted-foreground">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SAFETY PILLARS */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <Badge variant="secondary">
            <Sparkles className="mr-2 h-4 w-4" />
            Core Protection Systems
          </Badge>

          <h2 className="mt-5 text-3xl font-bold text-foreground">
            How Meetup protects users
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Every part of Meetup is engineered around privacy,
            moderation, trust scoring, and abuse prevention.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              viewport={{ once: true }}
              className="group rounded-3xl border border-border bg-card p-7 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-teal/40"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-grad text-white shadow-lg">
                <pillar.icon className="h-6 w-6" />
              </div>

              <h3 className="mt-5 text-xl font-semibold text-foreground">
                {pillar.title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {pillar.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="bg-secondary/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge variant="secondary">
                <BadgeCheck className="mr-2 h-4 w-4" />
                Trust & Moderation
              </Badge>

              <h2 className="mt-5 text-3xl font-bold text-foreground">
                Smart moderation beyond simple bans
              </h2>

              <p className="mt-5 leading-relaxed text-muted-foreground">
                Meetup uses a karma-based reputation system that
                tracks abusive behavior patterns over time.
                Repeat offenders are automatically restricted,
                deprioritized, or permanently banned.
              </p>

              <div className="mt-8 space-y-5">
                <Feature
                  icon={UserX}
                  text="Automatic repeat offender detection"
                />

                <Feature
                  icon={MessageSquareWarning}
                  text="AI-powered abusive message filtering"
                />

                <Feature
                  icon={Siren}
                  text="Instant disconnect after reports"
                />

                <Feature
                  icon={Globe}
                  text="Multi-language moderation support"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
              <h3 className="text-xl font-semibold text-foreground">
                Community Ground Rules
              </h3>

              <Separator className="my-5" />

              <div className="space-y-4">
                {rules.map((rule) => (
                  <div
                    key={rule}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-teal" />

                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {rule}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-sm leading-relaxed text-red-300">
                  Violating these rules may result in immediate
                  disconnection, shadow restriction, or permanent
                  account bans across the platform.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <Badge variant="secondary">
          <Shield className="mr-2 h-4 w-4" />
          Privacy First
        </Badge>

        <h2 className="mt-5 text-4xl font-bold text-foreground">
          Talk freely. Stay anonymous.
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
          Meetup is designed for meaningful conversations without
          sacrificing your privacy or personal safety.
        </p>

        <div className="mt-10">
          <Button asChild size="lg" variant="hero">
            <Link to="/chat">
              Enter Secure Chat
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Feature({
  icon: Icon,
  text,
}: {
  icon: any;
  text: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-xl bg-teal/10 p-2 text-teal">
        <Icon className="h-5 w-5" />
      </div>

      <p className="text-sm text-muted-foreground">
        {text}
      </p>
    </div>
  );
}