/**
 * Google AdSense configuration.
 *
 * Paste your AdSense publisher ID below (looks like "ca-pub-1234567890123456").
 * While it is empty, no ad code loads anywhere on the site.
 *
 * Ads are intentionally shown ONLY on content pages (home feed, Explore,
 * About, Safety) and never on video/chat screens, which AdSense policy
 * does not allow for user-generated live media.
 */
export const ADSENSE_CLIENT = (import.meta.env["VITE_ADSENSE_CLIENT"] as string | undefined) ?? "";

/** Optional named ad slot IDs from your AdSense account. */
export const ADSENSE_SLOTS = {
  contentTop: "",
  contentBottom: "",
} as const;

export const adsEnabled = () => ADSENSE_CLIENT.startsWith("ca-pub-");
