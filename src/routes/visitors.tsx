import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { downloadCSV } from "@/lib/csv";

export const Route = createFileRoute("/visitors")({
  head: () => ({ meta: [{ title: "Profile Visitors — Meetup Live" }] }),
  component: VisitorsPage,
});

interface Row { id: string; visitor_id: string; display_name: string | null; username: string | null; avatar_url: string | null; visited_at: string }
const PAGE = 25;

function VisitorsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const load = useCallback(async (p: number) => {
    setBusy(true);
    const { data } = await supabase.rpc("my_visitors", { p_limit: PAGE + 1, p_offset: p * PAGE });
    const arr = (data as Row[]) ?? [];
    setHasMore(arr.length > PAGE);
    setRows(arr.slice(0, PAGE));
    setBusy(false);
  }, []);

  useEffect(() => { if (user) void load(page); }, [user?.id, page, load]);

  const exportAll = async () => {
    const all: Row[] = [];
    for (let p = 0; p < 200; p++) {
      const { data } = await supabase.rpc("my_visitors", { p_limit: 500, p_offset: p * 500 });
      const arr = (data as Row[]) ?? [];
      all.push(...arr);
      if (arr.length < 500) break;
    }
    downloadCSV(`visitors-${Date.now()}.csv`, all as any, ["visited_at", "display_name", "username", "visitor_id"]);
  };

  if (loading || (busy && rows.length === 0)) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold flex items-center gap-2"><Eye className="text-teal" /> Profile Visitors</h1>
          <Button variant="outline" size="sm" onClick={exportAll}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>
        <p className="text-sm text-muted-foreground">People who recently viewed your profile.</p>

        <div className="mt-6 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">No visitors yet.</p>
          ) : rows.map((v) => (
            <Link key={v.id} to="/u/$userId" params={{ userId: v.visitor_id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/40">
              <Avatar className="h-10 w-10">
                <AvatarImage src={v.avatar_url ?? undefined} />
                <AvatarFallback>{(v.display_name || v.username || "?").slice(0,1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{v.display_name || v.username || "Anonymous"}</p>
                <p className="text-xs text-muted-foreground">{new Date(v.visited_at).toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0 || busy} onClick={() => setPage(p => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button variant="outline" size="sm" disabled={!hasMore || busy} onClick={() => setPage(p => p + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
