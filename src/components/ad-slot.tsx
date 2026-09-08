import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, adsEnabled } from "@/lib/ads";

const SCRIPT_ID = "adsbygoogle-js";

function ensureScript() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SCRIPT_ID)) return;
  const s = document.createElement("script");
  s.id = SCRIPT_ID;
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}

type AdSlotProps = {
  /** Ad unit ID from AdSense (data-ad-slot). Leave empty for auto ads only. */
  slot?: string;
  format?: string;
  className?: string;
  label?: string;
};

/**
 * Renders a responsive AdSense unit. Safe to place on content pages only.
 * Renders nothing until a publisher ID is configured in src/lib/ads.ts.
 */
export function AdSlot({ slot, format = "auto", className, label = "Advertisement" }: AdSlotProps) {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!adsEnabled() || pushed.current) return;
    ensureScript();
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      /* ad blocker or script not ready — ignore */
    }
  }, []);

  if (!adsEnabled()) return null;

  return (
    <aside className={className ?? "mx-auto my-10 w-full max-w-4xl px-4"}>
      <p className="mb-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        {...(slot ? { "data-ad-slot": slot } : {})}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
