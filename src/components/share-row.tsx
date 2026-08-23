import { useState } from "react";
import { Check, Copy, Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Manual share row. Opens the platform's own composer with the page title and
 * canonical URL prefilled — nothing is posted automatically.
 */
export function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${title}`;

  const targets = [
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    },
    {
      label: "Telegram",
      icon: Send,
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    },
    {
      label: "X",
      icon: Share2,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
      label: "Reddit",
      icon: Link2,
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title, url });
      } catch {
        /* user dismissed */
      }
    } else {
      void copy();
    }
  };

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-card-foreground">Share this page</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {targets.map((t) => (
          <Button key={t.label} asChild variant="secondary" size="sm">
            <a href={t.href} target="_blank" rel="noreferrer nofollow">
              <t.icon className="mr-2 h-4 w-4" /> {t.label}
            </a>
          </Button>
        ))}
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button size="sm" onClick={nativeShare}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </Button>
      </div>
    </div>
  );
}
