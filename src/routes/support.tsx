import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LifeBuoy, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support — Meetup Live" }] }),
  component: SupportPage,
});

interface Ticket { id: string; subject: string; message: string; status: string; category: string; admin_reply: string | null; created_at: string; }

function SupportPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading, nav]);

  const load = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setTickets((data ?? []) as Ticket[]);
    setBusy(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const submit = async () => {
    if (!user || !subject.trim() || !message.trim()) return;
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id, subject: subject.trim().slice(0, 200), message: message.trim().slice(0, 2000), category,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket submitted!");
    setOpen(false); setSubject(""); setMessage(""); setCategory("general");
    void load();
  };

  if (loading || busy) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/profile" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2"><LifeBuoy className="text-teal" /> Support</h1>
          <Button onClick={() => setOpen(true)} variant="hero"><Plus className="h-4 w-4 mr-1" /> New ticket</Button>
        </div>

        <div className="mt-6 space-y-3">
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-8 text-center">
              No tickets yet. Need help? Open one.
            </p>
          ) : tickets.map(t => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <h3 className="font-semibold">{t.subject}</h3>
                <Badge variant={t.status === "open" ? "default" : "secondary"}>{t.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t.category} · {new Date(t.created_at).toLocaleString()}</p>
              <p className="mt-2 text-sm whitespace-pre-wrap">{t.message}</p>
              {t.admin_reply && (
                <div className="mt-3 rounded-xl bg-teal/10 border border-teal-500/30 p-3">
                  <p className="text-xs font-semibold text-teal uppercase tracking-wide">Reply from team</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{t.admin_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New support ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                <option value="general">General</option>
                <option value="payment">Payment</option>
                <option value="bug">Bug report</option>
                <option value="abuse">Abuse / safety</option>
                <option value="account">Account</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Describe the issue</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={2000} />
            </div>
            <Button onClick={submit} className="w-full" variant="hero">Submit ticket</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
