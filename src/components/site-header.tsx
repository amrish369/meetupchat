import { Link } from "@tanstack/react-router";
import { Shield, Menu, X, Sparkles, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth, isPremiumActive } from "@/lib/auth";

const nav = [
  { to: "/", label: "Home" },
  { to: "/safety", label: "Safety" },
  { to: "/about", label: "About" },
  { to: "/pricing", label: "Pricing" },
  { to: "/premium", label: "Premium" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-grad text-white shadow-soft">
            <Shield className="h-4 w-4" />
          </span>
          <span>Meetup</span>
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            · India
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <AuthButton />
          <Button asChild variant="hero" size="default">
            <Link to="/chat">Start chatting</Link>
          </Button>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-md md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "text-foreground bg-secondary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild variant="hero" className="mt-2">
              <Link to="/chat" onClick={() => setOpen(false)}>
                Start chatting
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}

function AuthButton() {
  const { user, profile } = useAuth();
  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link to="/login"><UserIcon className="h-4 w-4" /> Sign in</Link>
      </Button>
    );
  }
  const premium = isPremiumActive(profile);
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to="/profile">
        {premium && <Sparkles className="h-3.5 w-3.5 text-teal" />}
        {profile?.display_name || user.email?.split("@")[0] || "Profile"}
      </Link>
    </Button>
  );
}
