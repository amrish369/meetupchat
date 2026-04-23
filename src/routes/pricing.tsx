import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Meetup" },
      {
        name: "description",
        content:
          "Meetup is free forever. Upgrade to Premium for gender filters, country filters, unlimited skips, and reconnect.",
      },
      { property: "og:title", content: "Pricing — Meetup" },
      {
        property: "og:description",
        content: "Free random video chat. Optional Premium for filters and reconnect.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal">Pricing</p>
          <h1 className="mt-2 text-4xl font-bold text-foreground sm:text-5xl text-balance">
            Free for everyone. Powerful for fans.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            The core experience is free, forever. Upgrade only if you want filters and extra control.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {/* Free */}
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
            <h2 className="font-display text-2xl font-bold">Free</h2>
            <p className="mt-1 text-sm text-muted-foreground">For everyone, forever.</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold">₹0</span>
              <span className="text-sm text-muted-foreground">/ always</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Unlimited random video chat",
                "Anonymous sessions",
                "Text chat with moderation",
                "10 skips per hour",
                "Report & block",
              ].map((f) => (
                <li key={f} className="flex gap-2 text-foreground">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-teal" /> {f}
                </li>
              ))}
            </ul>
            <Button asChild variant="cream" className="mt-7 w-full" size="lg">
              <Link to="/chat">Start free</Link>
            </Button>
          </div>

          {/* Premium */}
          <div className="relative overflow-hidden rounded-3xl bg-deep p-8 text-cream shadow-elev">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal/20 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-grad px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3 w-3" /> Coming soon
              </span>
              <h2 className="mt-3 font-display text-2xl font-bold">Premium</h2>
              <p className="mt-1 text-sm text-cream/65">For power users.</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display text-5xl font-bold">₹149</span>
                <span className="text-sm text-cream/65">/ month</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Everything in Free",
                  "Gender filter",
                  "Country / region filter",
                  "Unlimited skips",
                  "Reconnect to last match",
                  "Priority matching queue",
                  "Verified badge",
                ].map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-teal-soft" /> {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant="hero" className="mt-7 w-full" size="lg">
                <Link to="/" hash="waitlist">Join waitlist</Link>
              </Button>
              <p className="mt-3 text-center text-xs text-cream/55">
                Pay via Razorpay. Cancel anytime.
              </p>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-muted-foreground">
          Prices in INR, inclusive of GST. Premium launches with our Phase 2 release —
          waitlist members get 30 days free.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}
