import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Video, Users, MessageCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/chat", label: "Chat", icon: Video },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/messages", label: "Inbox", icon: MessageCircle },
  { to: "/profile", label: "You", icon: User },
] as const;

/** Mobile-only bottom navigation so private chat + calls are always one tap away. */
export function MobileTabBar() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const load = async () => {
      const { count } = await supabase
        .from("friend_messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);
      setUnread(count ?? 0);
    };
    void load();
    const ch = supabase
      .channel(`tabbar-unread:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_messages", filter: `receiver_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  if (!user) return null;
  // Hide on immersive full-screen surfaces (live chat / active call).
  if (pathname.startsWith("/calls/") || pathname.startsWith("/chat") || pathname.startsWith("/messages/")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-teal" : "text-muted-foreground"}`}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {to === "/messages" && unread > 0 && (
                    <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-teal px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
