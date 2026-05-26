import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Sparkles, LogOut, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, isPremiumActive } from "@/lib/auth";

const REGIONS = ["India", "South Asia", "Asia", "Europe", "Americas", "Africa", "Oceania"];

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Meetup" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setGender(profile.gender ?? "");
      setRegion(profile.region ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      display_name: name || null,
      gender: gender || null,
      region: region || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    await refreshProfile();
  };

  const premium = isPremiumActive(profile);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link to="/chat" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to chat
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>

        <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${premium ? "bg-teal-grad text-white shadow-glow" : "bg-secondary text-muted-foreground"}`}>
          <Sparkles className="h-3 w-3" /> {premium ? "Premium active" : "Free plan"}
          {premium && profile?.premium_until && (
            <span className="opacity-80">· until {new Date(profile.premium_until).toLocaleDateString()}</span>
          )}
        </div>

        <div className="mt-6 space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div>
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className="mt-1" placeholder="Your name" />
          </div>
          <div>
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-muted-foreground">Required for premium gender filter matching.</p>
          </div>
          <div>
            <Label>Region</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent>
                {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving} variant="hero" className="w-full">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        {!premium && (
          <Link to="/premium" className="mt-4 flex items-center justify-between rounded-3xl border border-teal/30 bg-teal/5 p-5 transition hover:border-teal/60">
            <div>
              <p className="font-display text-lg font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-teal" /> Upgrade to Premium</p>
              <p className="text-xs text-muted-foreground">Unlock gender & region filters, private match queue.</p>
            </div>
            <Sparkles className="h-5 w-5 text-teal" />
          </Link>
        )}

        <Button onClick={() => signOut().then(() => navigate({ to: "/" }))} variant="ghost" className="mt-6 w-full text-muted-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
