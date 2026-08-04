/**
 * Shared ICE server configuration.
 *
 * Uses the free public "Open Relay" TURN project (Metered) so calls can
 * connect worldwide — including mobile data / symmetric NAT / strict
 * firewalls where plain STUN + P2P fails. TCP/443 variants are included
 * because many corporate and mobile networks only allow HTTPS ports.
 *
 * These credentials are intentionally public (the project publishes them);
 * they are not secrets. If you later add your own TURN server, set
 * TURN_SHARED_SECRET + TURN_URLS and the server function will mint
 * short-lived credentials instead.
 */
export const OPEN_RELAY_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:openrelay.metered.ca:80" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:80?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turns:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];
