import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSeoDistribution, setPromoStatus, type SeoDistribution } from "@/lib/seo/seo.functions";

const CHANNEL_LABEL: Record<string, string> = {
  x: "X / Threads",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  reddit: "Reddit",
  meta: "Link description",
};

export function SeoDistributionPanels() {
  const fetchDistribution = useServerFn(getSeoDistribution);
  const updatePromo = useServerFn(setPromoStatus);
  const [data, setData] = useState<SeoDistribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setData((await fetchDistribution()) as SeoDistribution);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mark = async (id: string, status: "posted" | "discarded") => {
    try {
      await updatePromo({ data: { id, status } });
      toast.success(status === "posted" ? "Marked as posted." : "Draft discarded.");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const copy = async (id: string, body: string) => {
    try {
      await navigator.clipboard.writeText(body);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error("Could not copy — select the text manually.");
    }
  };

  const gsc = data?.searchConsole;
  const queued = (data?.promos ?? []).filter((p) => p.status === "queued");

  return (
    <>
      <section className="mt-8 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-card-foreground">
            Search-engine distribution
          </h2>
          <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3 text-xs">
            <p className="font-semibold text-card-foreground">IndexNow (Bing, Yandex, Naver)</p>
            <p className="mt-1 text-muted-foreground">
              {data?.indexnowConfigured
                ? `Active. Key file: ${data.keyLocation}`
                : "Not configured — the INDEXNOW_KEY secret is missing."}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3 text-xs">
            <p className="font-semibold text-card-foreground">Google Search Console</p>
            {!gsc && <p className="mt-1 text-muted-foreground">Loading…</p>}
            {gsc?.status === "unavailable" && (
              <p className="mt-1 text-amber-500">{gsc.reason}</p>
            )}
            {gsc?.status === "ok" && (
              <div className="mt-1 space-y-1 text-muted-foreground">
                <p>
                  Verified properties:{" "}
                  {gsc.properties.length ? gsc.properties.join(", ") : "none covering this site"}
                </p>
                {gsc.sitemap && (
                  <p>
                    Sitemap last downloaded:{" "}
                    {gsc.sitemap.lastDownloaded ?? "never"} · errors {gsc.sitemap.errors} · warnings{" "}
                    {gsc.sitemap.warnings}
                  </p>
                )}
                {gsc.properties.length > 1 && (
                  <p className="text-amber-500">
                    Multiple properties match — pick one in Search Console so submission is unambiguous.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-2">URL</th>
                <th className="p-2">Engine</th>
                <th className="p-2">Status</th>
                <th className="p-2">Tries</th>
                <th className="p-2">Detail</th>
                <th className="p-2">When</th>
              </tr>
            </thead>
            <tbody>
              {(data?.submissions ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="max-w-[220px] truncate p-2 text-muted-foreground">{s.target}</td>
                  <td className="p-2 text-muted-foreground">{s.engine}</td>
                  <td className="p-2">
                    <span
                      className={
                        s.status === "submitted"
                          ? "text-emerald-500"
                          : s.status === "failed"
                            ? "text-destructive"
                            : "text-amber-500"
                      }
                    >
                      {s.status}
                      {s.http_status ? ` (${s.http_status})` : ""}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">{s.attempts}</td>
                  <td className="max-w-[260px] truncate p-2 text-muted-foreground">{s.detail ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!data?.submissions.length && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No submissions yet — they are created when the engine publishes or refreshes a page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold text-foreground">
          Promo queue ({queued.length} waiting)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Ready-to-post copy for pages the engine published. Nothing is posted automatically — copy a
          draft, post it yourself where you are an actual participant, then mark it posted.
        </p>
        <div className="mt-3 space-y-3">
          {queued.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">
                    {CHANNEL_LABEL[p.channel] ?? p.channel} · {p.headline}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{p.target_url}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => copy(p.id, `${p.body}\n${p.target_url}`)}>
                    {copiedId === p.id ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    Copy
                  </Button>
                  <Button size="sm" onClick={() => mark(p.id, "posted")}>
                    Mark posted
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => mark(p.id, "discarded")}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.body}</p>
              {p.hashtags?.length > 0 && (
                <p className="mt-2 text-xs text-primary">{p.hashtags.map((h) => `#${h}`).join(" ")}</p>
              )}
            </div>
          ))}
          {!queued.length && (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No drafts waiting. The engine writes new copy whenever it publishes a page.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
