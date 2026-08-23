import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Play, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { useIsAdmin } from "@/lib/admin";
import { SeoDistributionPanels } from "@/components/seo-distribution";
import { getSeoReport, triggerSeoRun, type SeoReport } from "@/lib/seo/seo.functions";

export const Route = createFileRoute("/seo-dashboard")({
  head: () => ({
    meta: [
      { title: "SEO Growth Engine — Meetup admin" },
      { name: "description", content: "Admin reporting for the automated SEO growth engine." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SeoDashboard,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-card-foreground">{value}</p>
    </div>
  );
}

function SeoDashboard() {
  const { isAdmin, checking } = useIsAdmin();
  const fetchReport = useServerFn(getSeoReport);
  const runEngine = useServerFn(triggerSeoRun);
  const [report, setReport] = useState<SeoReport | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setReport(await fetchReport());
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-20 text-center">
          <h1 className="font-display text-xl font-bold text-foreground">Admins only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This dashboard is restricted to platform administrators.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const run = async () => {
    setBusy(true);
    try {
      const res = await runEngine();
      if (res.status === "skipped") toast.info("A run already happened in the last hour.");
      else if (res.status === "failed") toast.error("Run failed — see the log below.");
      else
        toast.success(
          `Run complete: ${res.pagesCreated} new, ${res.pagesUpdated} refreshed, ${res.pagesArchived} archived.`,
        );
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const latest = report?.runs[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      <SiteHeader />
      <Toaster />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground">
              <TrendingUp className="h-6 w-6 text-primary" /> SEO Growth Engine
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs daily. Every page is generated from real rooms, real members and real search
              demand — nothing is fabricated.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={load} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button onClick={run} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run now
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Published pages" value={report?.totals.published ?? 0} />
          <Stat label="Archived" value={report?.totals.archived ?? 0} />
          <Stat label="Keywords tracked" value={report?.totals.keywords ?? 0} />
          <Stat label="Total words" value={(report?.totals.words ?? 0).toLocaleString()} />
          <Stat label="Est. monthly clicks" value={report?.totals.trafficPotential ?? 0} />
        </div>

        {latest && (
          <section className="mt-8 rounded-xl border border-border bg-card p-4">
            <h2 className="font-display text-lg font-semibold text-card-foreground">
              Latest run — {latest.status} ({latest.source})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(latest.started_at).toLocaleString()} · {latest.keywords_found} keywords found
              · {latest.keywords_kept} kept · {latest.pages_created} created ·{" "}
              {latest.pages_updated} refreshed · {latest.pages_archived} archived ·{" "}
              {latest.rejected} rejected by quality gates
            </p>
            {latest.issues?.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-amber-500">
                {latest.issues.map((i, idx) => (
                  <li key={idx}>• {i}</li>
                ))}
              </ul>
            )}
            {latest.log?.length > 0 && (
              <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {latest.log.join("\n")}
              </pre>
            )}
          </section>
        )}

        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-foreground">Pages</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Page</th>
                  <th className="p-2">Cluster</th>
                  <th className="p-2">Primary keyword</th>
                  <th className="p-2">Words</th>
                  <th className="p-2">Links</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Refreshed</th>
                </tr>
              </thead>
              <tbody>
                {(report?.pages ?? []).map((p) => (
                  <tr key={p.slug} className="border-t border-border">
                    <td className="p-2">
                      <Link
                        to="/explore/$slug"
                        params={{ slug: p.slug }}
                        className="text-primary hover:underline"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="p-2 capitalize text-muted-foreground">{p.cluster ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{p.primary_keyword ?? "—"}</td>
                    <td className="p-2 text-muted-foreground">{p.word_count}</td>
                    <td className="p-2 text-muted-foreground">{p.related_slugs?.length ?? 0}</td>
                    <td className="p-2 text-muted-foreground">{p.status}</td>
                    <td className="p-2 text-muted-foreground">
                      {p.refreshed_at ? new Date(p.refreshed_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {!report?.pages.length && (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-muted-foreground">
                      No pages yet — run the engine to generate the first batch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <SeoDistributionPanels />
      </main>
    </div>
  );
}
