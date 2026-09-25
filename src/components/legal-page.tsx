import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const GRIEVANCE = {
  name: "Amrish Yadav",
  email: "grievance@meetup.app",
  address: "Meetup, India",
};

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
