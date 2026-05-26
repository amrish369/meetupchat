import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Check, Upload, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isPremiumActive } from "@/lib/auth";

const PLANS = [
  { id: "monthly", label: "Monthly", price: 149, sub: "/ month" },
  { id: "quarterly", label: "Quarterly", price: 399, sub: "/ 3 months", save: "Save 11%" },
  { id: "yearly", label: "Yearly", price: 1299, sub: "/ year", save: "Best value · Save 27%" },
];

const FEATURES = [
  "Gender filter (male / female / any)",
  "Region filter",
  "Private match queue (premium-only pool)",
  "Unlimited skips",
  "Priority matching",
  "Verified badge",
];

const UPI_ID = "meetup@upi"; // TODO: replace with your real UPI

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Premium — Meetup" },
      { name: "description", content: "Unlock gender & region filters, private rooms and more on Meetup Premium." },
    ],
  }),
  component: PremiumPage,
});

interface Submission { id: string; status: string; plan: string; amount_inr: number; created_at: string; }

function PremiumPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(PLANS[0]);
  const [upiRef, setUpiRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const loadSubs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("payment_submissions")
      .select("id,status,plan,amount_inr,created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    setSubmissions((data as Submission[]) ?? []);
  };

  useEffect(() => { void loadSubs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!upiRef.trim() && !file) {
      return toast.error("Add UPI transaction reference or upload screenshot");
    }
    setBusy(true);
    let screenshotPath: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
      screenshotPath = path;
    }
    const { error } = await supabase.from("payment_submissions").insert({
      user_id: user.id, plan: plan.id, amount_inr: plan.price,
      upi_reference: upiRef.trim() || null, screenshot_path: screenshotPath, status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment submitted! We will verify within 24 hours.");
    setUpiRef(""); setFile(null);
    await loadSubs();
    await refreshProfile();
  };

  const premium = isPremiumActive(profile);
  const upiLink = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=Meetup&am=${plan.price}&cu=INR&tn=${encodeURIComponent("Meetup Premium " + plan.id)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiLink)}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/chat" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-6 text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-grad px-3 py-1 text-xs font-semibold text-white shadow-glow">
            <Sparkles className="h-3 w-3" /> Premium
          </span>
          <h1 className="mt-3 font-display text-4xl font-bold">Match smarter, not random</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Choose who you meet with gender & region filters and the private premium-only queue.
          </p>
        </div>

        {premium && (
          <div className="mt-6 rounded-2xl border border-teal/40 bg-teal/10 p-4 text-center text-sm text-teal">
            <ShieldCheck className="mx-auto h-5 w-5" />
            <p className="mt-1 font-semibold">Premium is active{profile?.premium_until ? ` until ${new Date(profile.premium_until).toLocaleDateString()}` : ""}</p>
          </div>
        )}

        {/* Plan picker */}
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => {
            const active = plan.id === p.id;
            return (
              <button key={p.id} type="button" onClick={() => setPlan(p)}
                className={`rounded-2xl border p-4 text-left transition ${active ? "border-teal bg-teal/5 shadow-glow" : "border-border bg-card hover:border-teal/40"}`}>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.label}</p>
                <p className="mt-1 font-display text-2xl font-bold">₹{p.price}<span className="text-xs font-normal text-muted-foreground">{p.sub}</span></p>
                {p.save && <p className="mt-1 text-[11px] font-medium text-teal">{p.save}</p>}
              </button>
            );
          })}
        </div>

        <ul className="mt-6 grid gap-2 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 flex-none text-teal" /> {f}
            </li>
          ))}
        </ul>

        {/* Payment */}
        <div className="mt-8 grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-soft sm:grid-cols-2">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Scan & pay ₹{plan.price}</p>
            <img src={qrSrc} alt="UPI QR code" className="mx-auto mt-3 rounded-xl border border-border bg-white p-2" width={240} height={240} />
            <p className="mt-3 text-xs text-muted-foreground">UPI ID</p>
            <p className="font-mono text-sm font-semibold">{UPI_ID}</p>
            <a href={upiLink} className="mt-3 inline-block text-xs font-medium text-teal underline">Open in UPI app</a>
            <p className="mt-3 text-[11px] text-muted-foreground">
              QR is a placeholder. Owner can replace UPI ID in <code>src/routes/premium.tsx</code> or upload a static QR image.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="ref" className="text-xs">UPI transaction reference</Label>
              <Input id="ref" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} placeholder="e.g. 4123456789" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="shot" className="text-xs">Payment screenshot (optional)</Label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground hover:border-teal/60">
                <Upload className="h-4 w-4" /> {file?.name ?? "Choose image"}
                <input id="shot" type="file" accept="image/*" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <Button type="submit" disabled={busy} variant="hero" className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Submitting…" : "Submit for verification"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              We will verify your payment within 24 hours and activate premium on this account.
            </p>
          </form>
        </div>

        {submissions.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-lg font-semibold">Your submissions</h3>
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
              {submissions.map(s => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="capitalize">{s.plan} · ₹{s.amount_inr}</span>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.status === "approved" ? "bg-success/15 text-success" : s.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-amber-400/15 text-amber-500"}`}>{s.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
