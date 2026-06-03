import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Coins, Gift as GiftIcon, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "Gift Shop — Meetup Live" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ to: typeof s.to === "string" ? s.to : undefined }),
  component: ShopPage,
});

interface Gift { code: string; name: string; emoji: string; price_coins: number; sort_order: number; }
interface Recipient { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; relation: string; }

function ShopPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { to: preselectedTo } = Route.useSearch();
  const nav = useNavigate();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [busy, setBusy] = useState(true);
  const [openGift, setOpenGift] = useState<Gift | null>(null);
  const [recipientId, setRecipientId] = useState<string>(preselectedTo ?? "");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [received, setReceived] = useState<Array<any>>([]);

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: g }, { data: r }, { data: rec }] = await Promise.all([
        supabase.from("gifts").select("*").order("sort_order"),
        supabase.from("gift_transactions").select("*").eq("receiver_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.rpc("gift_recipients"),
      ]);
      setGifts((g ?? []) as Gift[]);
      setReceived(r ?? []);
      setRecipients((rec ?? []) as Recipient[]);
      setBusy(false);
    })();
  }, [user?.id]);

  const filteredRecipients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(r =>
      (r.display_name ?? "").toLowerCase().includes(q) ||
      (r.username ?? "").toLowerCase().includes(q)
    );
  }, [recipients, search]);

  const selectedRecipient = recipients.find(r => r.user_id === recipientId);

  const send = async () => {
    if (!openGift || !recipientId) return;
    setSending(true);
    const { error } = await supabase.rpc("send_gift", {
      p_receiver: recipientId,
      p_gift_code: openGift.code,
      p_message: message.trim() || undefined,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${openGift.emoji} sent to ${selectedRecipient?.display_name || "user"}!`);
    setOpenGift(null); setMessage("");
    void refreshProfile?.();
  };

  if (loading || busy) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/rewards" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2"><GiftIcon className="text-teal" /> Gift Shop</h1>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-sm font-bold text-amber-500">
            <Coins className="h-4 w-4" /> {profile?.coins ?? 0}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {gifts.map(g => (
            <button key={g.code} onClick={() => setOpenGift(g)}
              className="rounded-2xl border border-border bg-card p-4 text-center hover:border-teal-500/50 transition">
              <div className="text-5xl">{g.emoji}</div>
              <p className="mt-2 font-semibold">{g.name}</p>
              <p className="mt-1 text-sm font-bold text-amber-500 flex items-center justify-center gap-1">
                <Coins className="h-3.5 w-3.5" /> {g.price_coins}
              </p>
            </button>
          ))}
        </div>

        <h2 className="mt-8 font-semibold">Received</h2>
        <div className="mt-3 space-y-2">
          {received.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">No gifts yet.</p>
          ) : received.map(r => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <span className="text-2xl">{gifts.find(g => g.code === r.gift_code)?.emoji ?? "🎁"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{gifts.find(g => g.code === r.gift_code)?.name}</p>
                {r.message && <p className="text-xs text-muted-foreground truncate">"{r.message}"</p>}
              </div>
              <Link to="/u/$userId" params={{ userId: r.sender_id }} className="text-xs text-teal hover:underline">View</Link>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!openGift} onOpenChange={(o) => !o && setOpenGift(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-3xl">{openGift?.emoji}</span> Send {openGift?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Send to</label>
              {recipients.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto h-6 w-6 opacity-60" />
                  <p className="mt-1">Follow someone first to send them a gift.</p>
                  <Button asChild size="sm" variant="outline" className="mt-2"><Link to="/leaderboard">Find people</Link></Button>
                </div>
              ) : (
                <>
                  <div className="relative mt-1">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search followers / following..." className="pl-8" />
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto space-y-1 rounded-xl border border-border p-1">
                    {filteredRecipients.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No matches.</p>
                    ) : filteredRecipients.map(r => (
                      <button key={r.user_id} onClick={() => setRecipientId(r.user_id)}
                        className={`w-full flex items-center gap-2 rounded-lg p-2 text-left hover:bg-secondary transition ${recipientId === r.user_id ? 'bg-teal/15 ring-1 ring-teal' : ''}`}>
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-secondary grid place-items-center shrink-0">
                          {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-bold">{(r.display_name || "?")[0]}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.display_name || r.username || "User"}</p>
                          {r.username && <p className="text-[10px] text-muted-foreground truncate">@{r.username}</p>}
                        </div>
                        <span className="text-[10px] uppercase text-muted-foreground">{r.relation}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Message (optional)</label>
              <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="From your secret admirer" maxLength={200} />
            </div>
            <p className="text-xs text-muted-foreground">Cost: <span className="font-bold text-amber-500">{openGift?.price_coins} coins</span> · Recipient receives 50%</p>
            <Button onClick={send} disabled={sending || !recipientId} className="w-full" variant="hero">
              {sending ? <Loader2 className="animate-spin h-4 w-4" /> : `Send ${openGift?.emoji}${selectedRecipient ? ` to ${selectedRecipient.display_name || selectedRecipient.username || "user"}` : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
