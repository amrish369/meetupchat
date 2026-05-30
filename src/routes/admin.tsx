import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, Loader2, Users, CreditCard, LifeBuoy, ScrollText, LayoutDashboard,
  Search, Check, X, Eye, Plus, Minus, Ban, ShieldCheck, Crown, Star, Gem,
  Download, RefreshCw, ExternalLink,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type Tab = "dashboard" | "users" | "payments" | "tickets" | "logs";

function AdminPage() {
  const { loading } = useAuth();
  const { isAdmin, checking } = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    if (!loading && !checking && isAdmin === false) {
      toast.error("Admin access required");
      navigate({ to: "/" });
    }
  }, [loading, checking, isAdmin, navigate]);

  if (loading || checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) return null;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "tickets", label: "Support", icon: LifeBuoy },
    { id: "logs", label: "Audit Log", icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b sticky top-0 z-30 bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <Shield className="h-5 w-5 text-teal" /> Admin Console
          </div>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to app</Link>
        </div>
        <nav className="mx-auto max-w-7xl px-4 flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                  active ? "border-teal text-teal font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl p-4 md:p-6">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "users" && <UsersTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "tickets" && <TicketsTab />}
        {tab === "logs" && <LogsTab />}
      </main>
      <Toaster />
    </div>
  );
}

/* ===================== Dashboard ===================== */
function StatCard({ label, value, hint }: { label: string; value: any; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value ?? "—"}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState<any>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, su, rv] = await Promise.all([
      supabase.rpc("admin_dashboard_stats"),
      supabase.rpc("admin_daily_signups", { p_days: 14 }),
      supabase.rpc("admin_daily_revenue", { p_days: 14 }),
    ]);
    if (s.error) toast.error(s.error.message);
    setStats(s.data);
    setSignups((su.data ?? []).map((r: any) => ({ ...r, day: r.day?.slice(5) })));
    setRevenue((rv.data ?? []).map((r: any) => ({ ...r, day: r.day?.slice(5) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Platform Overview</h2>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Users" value={stats?.total_users} />
        <StatCard label="Active (7d)" value={stats?.active_users_7d} />
        <StatCard label="Online Now" value={stats?.online_users} />
        <StatCard label="Premium" value={stats?.premium_users} />
        <StatCard label="Gold" value={stats?.gold_users} />
        <StatCard label="Platinum" value={stats?.platinum_users} />
        <StatCard label="Recent Signups (24h)" value={stats?.recent_signups} />
        <StatCard label="Open Tickets" value={stats?.open_tickets} />
        <StatCard label="Total Revenue" value={`₹${stats?.total_revenue ?? 0}`} />
        <StatCard label="Revenue Today" value={`₹${stats?.revenue_today ?? 0}`} />
        <StatCard label="This Month" value={`₹${stats?.revenue_month ?? 0}`} />
        <StatCard label="Pending Payments" value={stats?.pending_payments} hint="Needs review" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="font-semibold mb-3">Daily Signups (14d)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={signups}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="signups" stroke="hsl(var(--teal, 180 60% 40%))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <h3 className="font-semibold mb-3">Revenue (₹, 14d)</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={revenue}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="revenue" fill="hsl(var(--teal, 180 60% 40%))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== Users ===================== */
function UsersTab() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const limit = 25;
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users", {
      p_search: q || null, p_limit: limit, p_offset: page * limit,
    });
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);

  const exportCsv = () => {
    const head = ["user_id","username","display_name","country","plan","is_premium","premium_until","coins","banned_until","created_at"];
    const csv = [head.join(",")].concat(
      rows.map(r => head.map(h => JSON.stringify(r[h] ?? "")).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setPage(0); setQ(e.target.value); }} placeholder="Search by name, username, or user id" className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-right p-3">Coins</th>
                <th className="text-left p-3">Expires</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Joined</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No users</td></tr>}
              {rows.map((u) => (
                <tr key={u.user_id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{u.display_name || u.username || "—"}</div>
                    <div className="text-xs text-muted-foreground">@{u.username || u.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="p-3"><PlanBadge plan={u.plan} active={u.is_premium} /></td>
                  <td className="p-3 text-right font-mono">{u.coins}</td>
                  <td className="p-3 text-xs">{u.premium_until ? new Date(u.premium_until).toLocaleDateString() : "—"}</td>
                  <td className="p-3">
                    {u.banned_until && new Date(u.banned_until) > new Date()
                      ? <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-500 rounded">Banned</span>
                      : <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-600 rounded">Active</span>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelected(u)}>Manage</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={rows.length < limit} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </div>

      {selected && <UserActionsModal user={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function PlanBadge({ plan, active }: { plan: string; active?: boolean }) {
  const map: any = {
    free: { bg: "bg-muted text-foreground", icon: null, label: "Free" },
    premium: { bg: "bg-teal/15 text-teal", icon: ShieldCheck, label: "Premium" },
    gold: { bg: "bg-amber-500/15 text-amber-600", icon: Crown, label: "Gold" },
    platinum: { bg: "bg-violet-500/15 text-violet-500", icon: Gem, label: "Platinum" },
  };
  const m = map[plan] || map.free;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${m.bg} ${plan !== "free" && !active ? "opacity-50" : ""}`}>
      {Icon && <Icon className="h-3 w-3" />} {m.label}
    </span>
  );
}

function UserActionsModal({ user, onClose, onChanged }: { user: any; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [coins, setCoins] = useState(100);

  const grant = async (plan: string, days: number) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_grant_plan", { p_user: user.user_id, p_plan: plan, p_days: days });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${plan} granted for ${days} days`);
    onChanged(); onClose();
  };
  const removePlan = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_grant_plan", { p_user: user.user_id, p_plan: "free", p_days: 0 });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Plan removed"); onChanged(); onClose();
  };
  const adjustCoins = async (delta: number) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_adjust_coins", { p_user: user.user_id, p_delta: delta, p_reason: "admin_manual" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Coins updated"); onChanged();
  };
  const ban = async (days: number) => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_ban_user", { p_user: user.user_id, p_days: days, p_reason: "admin" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Banned ${days} days`); onChanged(); onClose();
  };
  const unban = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_unban_user", { p_user: user.user_id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Unbanned"); onChanged(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-card border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-bold">{user.display_name || user.username}</h3>
            <p className="text-xs text-muted-foreground font-mono">{user.user_id}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="p-4 space-y-5">
          <section>
            <h4 className="text-sm font-semibold mb-2">Grant plan</h4>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" disabled={busy} onClick={() => grant("premium", 30)}><ShieldCheck className="h-3.5 w-3.5 mr-1" />Premium 30d</Button>
              <Button size="sm" disabled={busy} onClick={() => grant("gold", 30)}><Crown className="h-3.5 w-3.5 mr-1" />Gold 30d</Button>
              <Button size="sm" disabled={busy} onClick={() => grant("platinum", 30)}><Gem className="h-3.5 w-3.5 mr-1" />Platinum 30d</Button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => grant(user.plan === "free" ? "premium" : user.plan, 7)}>+7 days</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => grant(user.plan === "free" ? "premium" : user.plan, 30)}>+30 days</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => grant(user.plan === "free" ? "premium" : user.plan, 365)}>+1 year</Button>
            </div>
            <Button size="sm" variant="destructive" className="mt-2 w-full" disabled={busy} onClick={removePlan}>Remove premium</Button>
          </section>

          <section>
            <h4 className="text-sm font-semibold mb-2">Coins (current: {user.coins})</h4>
            <div className="flex gap-2">
              <Input type="number" value={coins} onChange={(e) => setCoins(parseInt(e.target.value) || 0)} />
              <Button size="sm" disabled={busy} onClick={() => adjustCoins(coins)}><Plus className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => adjustCoins(-coins)}><Minus className="h-3.5 w-3.5" /></Button>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold mb-2">Moderation</h4>
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => ban(1)}><Ban className="h-3.5 w-3.5 mr-1" />Ban 1d</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => ban(7)}><Ban className="h-3.5 w-3.5 mr-1" />Ban 7d</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => ban(365)}><Ban className="h-3.5 w-3.5 mr-1" />Ban 1y</Button>
            </div>
            <Button size="sm" variant="outline" className="mt-2 w-full" disabled={busy} onClick={unban}>Unban user</Button>
          </section>

          <Link to="/u/$userId" params={{ userId: user.user_id }} className="text-sm text-teal flex items-center gap-1">
            <ExternalLink className="h-3.5 w-3.5" /> View public profile
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ===================== Payments ===================== */
function PaymentsTab() {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("payment_submissions").select("*").order("created_at", { ascending: false }).limit(100);
    if (filter !== "all") query = query.eq("status", filter);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const viewScreenshot = async (path: string | null) => {
    if (!path) return toast.info("No screenshot");
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    setPreview(data.signedUrl);
  };

  const approve = async (id: string, plan: string, days: number) => {
    const { error } = await supabase.rpc("admin_approve_payment", { p_submission: id, p_plan: plan, p_days: days });
    if (error) return toast.error(error.message);
    toast.success(`Approved as ${plan} ${days}d`); load();
  };
  const reject = async (id: string) => {
    const note = prompt("Rejection reason (optional)") || null;
    const { error } = await supabase.rpc("admin_reject_payment", { p_submission: id, p_note: note });
    if (error) return toast.error(error.message);
    toast.success("Rejected"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(["pending","approved","rejected","all"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-sm rounded-full border ${filter === s ? "bg-teal text-white border-teal" : "bg-card"}`}>
            {s}
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Submitted</th>
                <th className="text-left p-3">User ID</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-right p-3">Amount</th>
                <th className="text-left p-3">UPI Ref</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No submissions</td></tr>}
              {rows.map(r => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3 text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-3 text-xs font-mono">{r.user_id.slice(0, 8)}…</td>
                  <td className="p-3">{r.plan}</td>
                  <td className="p-3 text-right font-mono">₹{r.amount_inr}</td>
                  <td className="p-3 text-xs font-mono">{r.upi_reference || "—"}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      r.status === "approved" ? "bg-green-500/15 text-green-600"
                      : r.status === "rejected" ? "bg-red-500/15 text-red-500"
                      : "bg-amber-500/15 text-amber-600"
                    }`}>{r.status}</span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 justify-end">
                      {r.screenshot_path && (
                        <Button size="sm" variant="outline" onClick={() => viewScreenshot(r.screenshot_path)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => approve(r.id, "premium", r.plan === "yearly" ? 365 : r.plan === "quarterly" ? 90 : 30)}>
                            <Check className="h-3.5 w-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => reject(r.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={preview} alt="Payment proof" className="max-h-[90vh] rounded-lg" />
            <div className="absolute top-2 right-2 flex gap-2">
              <a href={preview} download className="bg-white text-black p-2 rounded-full"><Download className="h-4 w-4" /></a>
              <button onClick={() => setPreview(null)} className="bg-white text-black p-2 rounded-full"><X className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== Support Tickets ===================== */
function TicketsTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [t, r] = await Promise.all([
      supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setTickets(t.data ?? []);
    setReports(r.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const reply = async (id: string) => {
    const msg = prompt("Reply:");
    if (!msg) return;
    const { error } = await supabase.from("support_tickets").update({ admin_reply: msg, status: "answered", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Replied"); load();
  };
  const resolve = async (id: string) => {
    const { error } = await supabase.from("support_tickets").update({ status: "resolved", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Resolved"); load();
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-bold mb-3">Support Tickets ({tickets.length})</h3>
        {tickets.length === 0 ? <p className="text-sm text-muted-foreground">No tickets.</p> : (
          <ul className="space-y-2">
            {tickets.map(t => (
              <li key={t.id} className="border rounded-xl p-3 bg-card">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t.message}</p>
                    {t.admin_reply && <p className="text-sm mt-2 p-2 bg-muted rounded">↳ {t.admin_reply}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{new Date(t.created_at).toLocaleString()} · {t.status}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => reply(t.id)}>Reply</Button>
                    {t.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => resolve(t.id)}>Resolve</Button>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-bold mb-3">Abuse Reports ({reports.length})</h3>
        {reports.length === 0 ? <p className="text-sm text-muted-foreground">No reports.</p> : (
          <ul className="space-y-2">
            {reports.map(r => (
              <li key={r.id} className="border rounded-xl p-3 bg-card text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{r.reason}</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                {r.details && <p className="text-muted-foreground mt-1">{r.details}</p>}
                <p className="text-xs font-mono text-muted-foreground mt-1">reported: {r.reported_session}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ===================== Audit Logs ===================== */
function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) toast.error(error.message);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Admin</th>
              <th className="text-left p-3">Action</th>
              <th className="text-left p-3">Target</th>
              <th className="text-left p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-t">
                <td className="p-3 text-xs">{new Date(l.created_at).toLocaleString()}</td>
                <td className="p-3 text-xs font-mono">{l.admin_id.slice(0, 8)}</td>
                <td className="p-3"><span className="text-xs px-2 py-0.5 bg-secondary rounded">{l.action}</span></td>
                <td className="p-3 text-xs font-mono">{l.target_user_id?.slice(0, 8) || "—"}</td>
                <td className="p-3 text-xs text-muted-foreground font-mono">{l.details ? JSON.stringify(l.details) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
