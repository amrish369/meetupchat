import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Check, Upload, Loader2, ShieldCheck, Copy, CheckCircle2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "sonner";
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

const UPI_ID = "9838906467@ptaxis";

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 inline-flex items-center text-muted-foreground hover:text-teal transition-colors">
      {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
};

export const Route = createFileRoute("/premium")({
  component: PremiumPage,
});

function PremiumPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(PLANS[0]);
  const [upiRef, setUpiRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    loadSubs();
    const channel = supabase.channel('payment_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_submissions', filter: `user_id=eq.${user.id}` }, 
        () => { loadSubs(); refreshProfile(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadSubs = async () => {
    const { data } = await supabase.from("payment_submissions").select("*").order("created_at", { ascending: false }).limit(5);
    setSubmissions(data ?? []);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 2 * 1024 * 1024) return toast.error("File too large (Max 2MB)");
    if (!selected.type.startsWith("image/")) return toast.error("Only images allowed");
    setFile(selected);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiRef.trim() && !file) return toast.error("Transaction ID or Screenshot required");
    if (upiRef && !/^\d{10,12}$/.test(upiRef)) return toast.error("Invalid Transaction ID format");

    setBusy(true);
    let screenshotPath = null;
    if (file) {
      const { data, error } = await supabase.storage.from("payment-proofs").upload(`${user!.id}/${Date.now()}`, file);
      if (error) { setBusy(false); return toast.error(error.message); }
      screenshotPath = data.path;
    }

    const { error } = await supabase.from("payment_submissions").insert({
      user_id: user!.id, plan: plan.id, amount_inr: plan.price,
      upi_reference: upiRef.trim() || null, screenshot_path: screenshotPath, status: "pending",
    });

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted! We will verify within 24 hours.");
    setUpiRef(""); setFile(null);
  };

  const premium = isPremiumActive(profile);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=upi://pay?pa=${UPI_ID}&pn=Meetup&am=${plan.price}&cu=INR`;

  return (
    <div className="min-h-screen bg-background p-4 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/chat" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="h-4 w-4" /> Back</Link>

        {premium && (
          <div className="mb-6 rounded-2xl border border-teal/40 bg-teal/10 p-4 text-center text-teal">
            <ShieldCheck className="mx-auto h-6 w-6" />
            <p className="font-semibold">Premium Active</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <button key={p.id} onClick={() => setPlan(p)} className={`rounded-2xl border p-4 text-left ${plan.id === p.id ? "border-teal bg-teal/5 shadow-lg" : "border-border"}`}>
              <p className="text-xs uppercase text-muted-foreground">{p.label}</p>
              <p className="text-2xl font-bold">₹{p.price}</p>
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="border border-border p-6 rounded-3xl bg-card text-center">
            <img src={qrSrc} alt="QR" className="mx-auto rounded-xl border p-2 bg-white" />
            <p className="mt-4 font-mono font-semibold">{UPI_ID} <CopyButton text={UPI_ID} /></p>
          </div>
          
          <form onSubmit={submit} className="space-y-4">
            <Input placeholder="12-Digit Transaction ID" value={upiRef} onChange={(e) => setUpiRef(e.target.value)} />
            <label className="flex items-center gap-2 border border-dashed p-3 rounded-md cursor-pointer hover:border-teal">
               <Upload className="h-4 w-4" /> {file?.name || "Upload screenshot"}
               <input type="file" className="hidden" onChange={handleFileChange} />
            </label>
            <Button type="submit" className="w-full" disabled={busy || (!upiRef && !file)}>
              {busy ? <Loader2 className="animate-spin" /> : "Submit for Verification"}
            </Button>
          </form>
        </div>

        <div className="mt-10">
          <h3 className="font-bold mb-4">Submission History</h3>
          {submissions.length === 0 ? (
            <div className="text-center py-10 border rounded-2xl border-dashed text-muted-foreground">
              <Inbox className="mx-auto mb-2 opacity-50" /> No submissions yet.
            </div>
          ) : (
            <ul className="divide-y border rounded-2xl">
              {submissions.map(s => (
                <li key={s.id} className="p-4 flex justify-between items-center text-sm">
                  <span>{s.plan.toUpperCase()}</span>
                  <span className={`px-2 py-1 rounded-full text-[10px] ${s.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
