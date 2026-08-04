/**
 * 18+ enforcement.
 *
 * - Guests see a blocking "18+ Only" notice before entering the platform.
 * - Signed-in members without a stored adult confirmation must submit their
 *   date of birth; the server computes and stores the verified adult status.
 * - Members recorded as under 18 are permanently blocked from chat and calls.
 */
import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const NOTICE_KEY = "meetup:adult-notice-ack";

export type AgeState = "loading" | "guest-notice" | "needs-dob" | "under-age" | "verified";

export function useAgeVerification() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [ack, setAck] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAck(typeof window !== "undefined" && window.localStorage.getItem(NOTICE_KEY) === "1");
    setHydrated(true);
  }, []);

  const acceptNotice = useCallback(() => {
    try { window.localStorage.setItem(NOTICE_KEY, "1"); } catch { /* noop */ }
    setAck(true);
  }, []);

  let state: AgeState = "loading";
  if (hydrated && !loading) {
    if (!user) state = ack ? "verified" : "guest-notice";
    else if (!profile) state = "loading";
    else if (profile.is_adult) state = "verified";
    else if (profile.age_verified_at) state = "under-age";
    else state = "needs-dob";
  }

  return { state, acceptNotice, refreshProfile };
}

export function AgeGate({ children }: { children: React.ReactNode }) {
  const { state, acceptNotice, refreshProfile } = useAgeVerification();
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === "loading") {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "verified") return <>{children}</>;

  const submit = async () => {
    setError(null);
    if (!dob) return setError("Please enter your date of birth.");
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("confirm_age", { p_dob: dob });
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    const row = Array.isArray(data) ? data[0] : data;
    await refreshProfile();
    if (row && !row.is_adult) setError("You must be 18 or older to use Meetup.");
  };

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-destructive/15 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">18+ Only</h2>
            <p className="text-xs text-muted-foreground">Adults-only community · age verified</p>
          </div>
        </div>

        {state === "guest-notice" && (
          <>
            <p className="text-sm text-muted-foreground">
              Meetup is an adults-only platform. Live video and text chat may put you in contact with
              strangers. By continuing you confirm that you are at least 18 years old and accept our
              community rules: no screen recording, no nudity or sexual content, and no hate speech,
              abuse or harassment.
            </p>
            <div className="mt-5 flex gap-3">
              <Button className="flex-1" onClick={acceptNotice}>I am 18 or older — Enter</Button>
              <Button variant="secondary" className="flex-1" onClick={() => { window.location.href = "https://www.google.com"; }}>
                Exit
              </Button>
            </div>
          </>
        )}

        {state === "needs-dob" && (
          <>
            <p className="text-sm text-muted-foreground">
              Confirm your date of birth to unlock chat and calls. Your adult status is stored
              securely on our servers and is never shown to other members.
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="dob" className="text-xs">Date of birth</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDob(e.target.value)}
                  className="pl-9"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full" onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm age"}
              </Button>
            </div>
          </>
        )}

        {state === "under-age" && (
          <p className="text-sm text-destructive">
            Access denied. Our records show you are under 18, so chat, calls and messaging are
            permanently disabled on this account.
          </p>
        )}
      </div>
    </div>
  );
}
