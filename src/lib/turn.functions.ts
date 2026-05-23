/**
 * Short-lived TURN credential vendor.
 *
 * Implements the time-limited credential format that Coturn supports out of
 * the box (the "REST API" auth method, see Coturn's `turn-rest` /
 * `use-auth-secret` mode):
 *
 *   username   = <unix-expiry-timestamp>:<session-id>
 *   credential = base64( HMAC-SHA1( shared_secret, username ) )
 *
 * The browser only ever sees credentials that expire in `TURN_TTL_SECONDS`
 * (default 1 hour). Coturn validates them statelessly using the same shared
 * secret, so we can rotate the secret on the server without coordinating
 * with currently connected clients — old creds simply stop minting.
 *
 * Env vars (set in Lovable Cloud → Secrets):
 *
 *   TURN_SHARED_SECRET   required — long random string, also in turnserver.conf
 *                                   under `static-auth-secret=...`
 *   TURN_URLS            required — comma-separated, e.g.
 *                                   "turn:turn.example.com:3478?transport=udp,
 *                                    turn:turn.example.com:3478?transport=tcp,
 *                                    turns:turn.example.com:5349?transport=tcp"
 *   TURN_TTL_SECONDS     optional — default 3600
 *
 * If `TURN_SHARED_SECRET` is missing, we fall back to STUN-only (so dev still
 * works without a Coturn instance).
 */

import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";
import { z } from "zod";

export interface TurnCredentialsResponse {
  iceServers: RTCIceServer[];
  // Wall-clock unix seconds when the username/credential pair expires.
  // Clients refresh shortly before this.
  expiresAt: number;
  ttl: number;
}

const InputSchema = z.object({
  // Anonymous session id from the browser. Used as the "user" portion of the
  // ephemeral username so reports can be correlated to a specific peer.
  sessionId: z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
});

export const getTurnCredentials = createServerFn({ method: "POST" })
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<TurnCredentialsResponse> => {
    const secret = process.env.TURN_SHARED_SECRET;
    const urlsRaw = process.env.TURN_URLS;
    const ttl = Math.max(60, Math.min(86_400, Number(process.env.TURN_TTL_SECONDS) || 3600));

    // Always include public STUN — costs us nothing and helps direct P2P.
    const stunServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ];

    if (!secret || !urlsRaw) {
      // No TURN configured yet — return STUN only. The matchmaker will still
      // work for ~70-80% of users on home Wi-Fi.
      return {
        iceServers: stunServers,
        expiresAt: Math.floor(Date.now() / 1000) + ttl,
        ttl,
      };
    }

    const urls = urlsRaw
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    const expiresAt = Math.floor(Date.now() / 1000) + ttl;
    const username = `${expiresAt}:${data.sessionId}`;
    const credential = createHmac("sha1", secret).update(username).digest("base64");

    return {
      iceServers: [
        ...stunServers,
        {
          urls,
          username,
          credential,
        },
      ],
      expiresAt,
      ttl,
    };
  });
