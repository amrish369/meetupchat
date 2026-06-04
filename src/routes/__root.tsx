import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Meetup — India's safest anonymous video chat" },
      {
        name: "description",
        content:
          "Free random video chat for India. No login, no phone number, fully anonymous. Safer alternative to OmeTV with built-in moderation.",
      },
      { name: "author", content: "Meetup" },
      { property: "og:title", content: "Meetup — India's safest anonymous video chat" },
      {
        property: "og:description",
        content: "Free random video chat for India. No login required. 100% anonymous.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@meetup" },
      { name: "theme-color", content: "#0C2340" },
      { name: "twitter:title", content: "Meetup — India's safest anonymous video chat" },
      { name: "description", content: "Connect Safely offers anonymous, random video chats with enhanced privacy and safety features." },
      { property: "og:description", content: "Connect Safely offers anonymous, random video chats with enhanced privacy and safety features." },
      { name: "twitter:description", content: "Connect Safely offers anonymous, random video chats with enhanced privacy and safety features." },
      
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e10ad92c-7bfe-457b-a716-10bdb5c76eef/id-preview-f0946eda--8aefbe33-0e82-4b79-b045-00a70c1ae815.lovable.app-1776938161959.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}
