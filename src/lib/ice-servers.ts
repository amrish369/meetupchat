/**
 * Shared public STUN servers. These help two devices discover a direct path.
 *
 * NOTE: the old free "Open Relay" TURN host (openrelay.metered.ca) no longer
 * works — its DNS now points to a reserved non-routable address — so it was
 * removed. Real relay (TURN) is supplied by the server function using
 * Cloudflare TURN or self-hosted Coturn credentials.
 */
export const OPEN_RELAY_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:global.stun.twilio.com:3478" },
];
