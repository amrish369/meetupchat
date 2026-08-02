import { Link } from "@tanstack/react-router";
import { MessageCircle, Phone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/** Home-page entry point into the private (mutual-follow) chat + call section. */
export function PrivateCta() {
  const { user } = useAuth();

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-border bg-card p-8 sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-medium text-teal">
              <Users className="h-3.5 w-3.5" /> Private section
            </div>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
              WhatsApp jaisa private chat &amp; calling
            </h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Jab aap aur koi user ek dusre ko follow kar lete hain, wo aapke friends ban jaate hain — phir unlimited
              personal messages, voice call aur video call, sab sirf aap dono ke beech.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {user ? (
                <>
                  <Button asChild variant="hero" size="lg">
                    <Link to="/friends"><MessageCircle className="h-4 w-4" /> My friends</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/calls"><Phone className="h-4 w-4" /> Private calls</Link>
                  </Button>
                </>
              ) : (
                <Button asChild variant="hero" size="lg">
                  <Link to="/login">Sign in to unlock private chat</Link>
                </Button>
              )}
            </div>
          </div>
          <ul className="grid gap-3 text-sm sm:w-64">
            <li className="rounded-2xl border border-border bg-background p-3">1:1 encrypted-in-transit calling</li>
            <li className="rounded-2xl border border-border bg-background p-3">Sirf mutual followers ke saath</li>
            <li className="rounded-2xl border border-border bg-background p-3">Voice, video, camera flip &amp; gifts</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
