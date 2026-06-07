import { Link } from "@tanstack/react-router";
import { Shield, Menu, X, Sparkles, User as UserIcon, Search, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth, isPremiumActive } from "@/lib/auth";

const nav = [
  { to: "/", label: "Home" },
  { to: "/chat", label: "Chat" },
  { to: "/rooms", label: "Rooms" },
  { to: "/messages", label: "Inbox" },
  { to: "/calls", label: "Calls" },
  { to: "/shop", label: "Gifts" },
  { to: "/leaderboard", label: "Top" },
  { to: "/rewards", label: "Rewards" },
  { to: "/premium", label: "Premium" },
  { to: "/support", label: "Support" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => setIsMounted(true), []);

  if (!isMounted) return null; // Hydration fix

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal text-white">
            <Shield className="h-4 w-4" />
          </span>
          Meetup
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className="text-sm font-medium text-muted-foreground hover:text-teal transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button className="text-muted-foreground hover:text-foreground"><Search className="h-5 w-5" /></button>
          <AuthButton />
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden border-t p-4 flex flex-col gap-4 animate-in slide-in-from-top-5">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="text-lg">{item.label}</Link>
          ))}
          <AuthButton isMobile />
        </div>
      )}
    </header>
  );
}

function AuthButton({ isMobile }: { isMobile?: boolean }) {
  const { user, profile } = useAuth();
  const premium = isPremiumActive(profile);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));
    });
  }, [user]);

  if (!user) {
    return (
      <Button asChild size="sm" variant={isMobile ? "default" : "outline"}>
        <Link to="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Link to="/admin" className="text-xs px-2 py-1 rounded bg-teal/15 text-teal font-semibold">Admin</Link>
      )}
      <Link to="/profile" className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-full text-sm font-medium">
        {premium && <Sparkles className="h-3.5 w-3.5 text-teal" />}
        {profile?.display_name || "Profile"}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal"></span>
        </span>
      </Link>
    </div>
  );
}
