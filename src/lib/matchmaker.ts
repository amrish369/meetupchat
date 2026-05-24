/**
 * WebRTC matchmaker built on Lovable Cloud (Supabase) Realtime channels.
 *
 * How it works (the "OmeTV"-style matching):
 *
 *   1. Each peer joins a global "lobby" presence channel and announces itself.
 *   2. When two peers see each other in the lobby, the one with the
 *      lexicographically smaller session id becomes the "caller" — this avoids
 *      both sides creating an offer.
 *   3. They open a private signaling channel keyed by a deterministic pair id
 *      and exchange SDP offer/answer + ICE candidates over Realtime broadcast.
 *   4. WebRTC connection establishes peer-to-peer (audio + video + data channel
 *      for in-call text). The data channel means text never goes through our
 *      server either — fully P2P.
 *   5. "Skip" tears the connection down and rejoins the lobby.
 *   6. If the first ICE attempt fails (typical on strict mobile NATs), we
 *      automatically retry with `iceTransportPolicy: "relay"` so all media
 *      goes through TURN. This recovers carrier-grade NAT users who would
 *      otherwise see a black screen.
 *
 * No video/audio data ever touches our servers. Only signaling.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getTurnCredentials, type TurnCredentialsResponse } from "@/lib/turn.functions";

/**
 * ICE credentials are fetched from a server function that mints short-lived
 * (default 1h) Coturn REST-style credentials. The browser never sees the
 * shared secret, and credentials rotate automatically — even if a malicious
 * peer scraped them, they'd expire within the hour and can't be reused on
 * other Coturn realms.
 *
 * We cache the response in-memory and refresh ~5 minutes before expiry.
 */
let turnCache: { value: TurnCredentialsResponse; fetchedAt: number } | null = null;
const REFRESH_BUFFER_SEC = 5 * 60;

async function fetchIceServers(sessionId: string): Promise<RTCIceServer[]> {
  const now = Math.floor(Date.now() / 1000);
  if (turnCache && turnCache.value.expiresAt - REFRESH_BUFFER_SEC > now) {
    return turnCache.value.iceServers;
  }
  try {
    const value = await getTurnCredentials({ data: { sessionId } });
    turnCache = { value, fetchedAt: now };
    return value.iceServers;
  } catch (err) {
    console.warn("[turn] credential fetch failed, using STUN-only fallback", err);
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ];
  }
}

export type MatchStatus =
  | "idle"
  | "requesting-media"
  | "searching"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface ChatMessage {
  id: string;
  from: "me" | "stranger" | "system";
  text: string;
  at: number;
}

interface Callbacks {
  onStatus: (s: MatchStatus, info?: string) => void;
  onLocalStream: (s: MediaStream) => void;
  onRemoteStream: (s: MediaStream | null) => void;
  onMessage: (m: ChatMessage) => void;
  onPeerSession: (id: string | null) => void;
  onOnlineCount?: (n: number) => void;
}

function pairId(a: string, b: string) {
  return [a, b].sort().join("__");
}

function createConnectionId(sessionId: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${sessionId}-${suffix}`;
}

function freshPresenceKeys(state: ReturnType<RealtimeChannel["presenceState"]>, selfId: string) {
  const now = Date.now();
  return Object.entries(state)
    .filter(([id, metas]) => {
      if (id === selfId || !Array.isArray(metas)) return false;
      return metas.some((meta) => {
        const at = Number((meta as { at?: number }).at ?? 0);
        return !at || now - at < 45_000;
      });
    })
    .map(([id]) => id)
    .sort();
}

export class Matchmaker {
  private sessionId: string;
  private connectionId: string;
  private cb: Callbacks;
  private lobby: RealtimeChannel | null = null;
  private online: RealtimeChannel | null = null;
  private signal: RealtimeChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dc: RTCDataChannel | null = null;
  private peerId: string | null = null;
  private isCaller = false;
  private active = false;
  private offerSent = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private matchTimer: ReturnType<typeof setTimeout> | null = null;
  private retryingIce = false;
  // Once we observe an ICE failure with the default policy, every subsequent
  // connection in this session is forced through TURN relay.
  private forceRelay = false;
  // Per-pair retry state — we only auto-retry once with relay policy before
  // giving up and skipping to the next stranger.
  private pairRetried = false;

  constructor(sessionId: string, cb: Callbacks) {
    this.sessionId = sessionId;
    this.connectionId = createConnectionId(sessionId);
    this.cb = cb;
  }

  async start() {
    if (this.active) return;
    this.active = true;
    this.cb.onStatus("requesting-media");

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.cb.onLocalStream(this.localStream);
    } catch (err) {
      this.cb.onStatus("error", "Camera/mic permission denied. Please allow access.");
      this.active = false;
      return;
    }

    this.joinOnline();
    await this.joinLobby();
  }

  /**
   * Separate presence channel that counts EVERY active user (whether searching
   * or already in a chat). Used to render the "X people online" banner. We
   * don't untrack here when matched — only the lobby gets untracked.
   */
  private joinOnline() {
    if (this.online) return;
    const ch = supabase.channel("online", {
      config: { presence: { key: this.connectionId } },
    });
    const emit = () => {
      const state = ch.presenceState();
      this.cb.onOnlineCount?.(Object.keys(state).length);
    };
    ch.on("presence", { event: "sync" }, emit)
      .on("presence", { event: "join" }, emit)
      .on("presence", { event: "leave" }, emit)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ at: Date.now(), sessionId: this.sessionId });
        }
      });
    this.online = ch;
  }

  private async joinLobby() {
    this.cb.onStatus("searching");
    this.cb.onRemoteStream(null);
    this.cb.onPeerSession(null);
    this.clearMatchTimer();
    this.peerId = null;
    this.pairRetried = false;

    if (this.lobby) {
      await supabase.removeChannel(this.lobby);
      this.lobby = null;
    }

    this.lobby = supabase.channel("lobby", {
      config: { presence: { key: this.connectionId } },
    });

    this.lobby
      .on("presence", { event: "sync" }, () => this.tryMatch())
      .on("presence", { event: "join" }, () => this.tryMatch())
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.lobby?.track({ at: Date.now(), sessionId: this.sessionId });
        }
      });
  }

  private async tryMatch() {
    if (!this.lobby || this.peerId) return;
    const state = this.lobby.presenceState();
    const others = freshPresenceKeys(state, this.connectionId);
    if (others.length === 0) return;

    const candidate = others[0];

    this.peerId = candidate;
    this.isCaller = this.connectionId < candidate;
    this.cb.onPeerSession(candidate);
    this.cb.onStatus("connecting");
    this.scheduleMatchTimeout();

    if (this.lobby) await this.lobby.untrack();

    await this.openSignaling(candidate);
  }

  private async openSignaling(peer: string) {
    const id = pairId(this.connectionId, peer);
    this.offerSent = false;
    this.signal = supabase.channel(`pair:${id}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this.connectionId },
      },
    });

    this.signal
      .on("presence", { event: "sync" }, () => {
        // Caller waits until it can SEE the callee on the pair channel before
        // firing the SDP offer. Without this, the offer is sent before the
        // callee has subscribed and is silently dropped (broadcast.self:false,
        // no ack, no replay).
        if (!this.isCaller || this.offerSent || !this.signal) return;
        const state = this.signal.presenceState();
        if (Object.keys(state).includes(peer)) {
          this.offerSent = true;
          void this.startCallerOffer();
        }
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (this.isCaller) return;
        await this.ensurePc();
        await this.pc!.setRemoteDescription(payload.sdp);
        await this.flushCandidates();
        const answer = await this.pc!.createAnswer();
        await this.pc!.setLocalDescription(answer);
        this.signal?.send({ type: "broadcast", event: "answer", payload: { sdp: answer } });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (!this.isCaller || !this.pc) return;
        await this.pc.setRemoteDescription(payload.sdp);
        await this.flushCandidates();
      })
      .on("broadcast", { event: "ice" }, async ({ payload }) => {
        if (!this.pc) return;
        const candidate = payload.candidate as RTCIceCandidateInit;
        if (!this.pc.remoteDescription) {
          this.pendingCandidates.push(candidate);
          return;
        }
        try {
          await this.pc.addIceCandidate(candidate);
        } catch {
          /* ignore */
        }
      })
      .on("broadcast", { event: "bye" }, () => {
        this.handlePeerLeft();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.signal?.track({ at: Date.now(), sessionId: this.sessionId });
        }
      });
  }

  private scheduleMatchTimeout() {
    this.clearMatchTimer();
    this.matchTimer = setTimeout(() => {
      if (!this.active || this.pc?.connectionState === "connected") return;
      this.cb.onMessage({
        id: crypto.randomUUID(),
        from: "system",
        text: "Match did not respond. Searching again…",
        at: Date.now(),
      });
      this.handlePeerLeft();
    }, 15_000);
  }

  private clearMatchTimer() {
    if (!this.matchTimer) return;
    clearTimeout(this.matchTimer);
    this.matchTimer = null;
  }

  private async startCallerOffer() {
    await this.ensurePc();
    this.dc = this.pc!.createDataChannel("chat");
    this.wireDataChannel(this.dc);
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.signal?.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
  }

  private async ensurePc() {
    if (this.pc) return;
    const iceServers = await fetchIceServers(this.sessionId);
    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: this.forceRelay ? "relay" : "all",
    });
    this.pc = pc;
    this.remoteStream = new MediaStream();
    this.cb.onRemoteStream(this.remoteStream);

    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));

    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach((t) => this.remoteStream!.addTrack(t));
      this.cb.onRemoteStream(this.remoteStream);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signal?.send({
          type: "broadcast",
          event: "ice",
          payload: { candidate: e.candidate.toJSON() },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      // "failed" means the browser has exhausted all candidate pairs. If we
      // haven't yet tried forcing TURN relay, do so now — this is the canonical
      // recovery path on strict carrier-grade NATs (Jio/Airtel).
      if (s === "failed") this.handleIceFailure();
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        this.clearMatchTimer();
        this.cb.onStatus("connected");
        this.pairRetried = false;
        this.retryingIce = false;
      }
      if (s === "failed") this.handleIceFailure();
      if (s === "disconnected") {
        // give the browser a few seconds to recover before tearing down
        setTimeout(() => {
          if (this.pc === pc && pc.connectionState === "disconnected") {
            this.handlePeerLeft();
          }
        }, 4000);
      }
    };

    pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this.wireDataChannel(e.channel);
    };
  }

  /**
   * ICE-failure recovery: first failure on this pair → tear down PC and
   * retry with `iceTransportPolicy: "relay"` (forces TURN). Persist the
   * forceRelay flag so subsequent matches in this session also use TURN
   * directly without re-failing first.
   */
  private async handleIceFailure() {
    if (this.retryingIce) return;
    this.retryingIce = true;
    if (this.pairRetried) {
      // Already tried relay; give up and find a new stranger.
      this.cb.onMessage({
        id: crypto.randomUUID(),
        from: "system",
        text: "Connection failed. Searching for a new stranger…",
        at: Date.now(),
      });
      this.handlePeerLeft();
      this.retryingIce = false;
      return;
    }
    this.pairRetried = true;
    this.forceRelay = true;
    // Invalidate cached creds so we get a fresh TURN credential pair.
    turnCache = null;

    this.cb.onStatus("connecting", "Reconnecting via relay…");
    this.cb.onMessage({
      id: crypto.randomUUID(),
      from: "system",
      text: "Network is strict — switching to relay (TURN)…",
      at: Date.now(),
    });

    // Tear down only the peer connection / data channel — keep the signaling
    // channel open so the existing pair can re-negotiate.
    if (this.dc) { try { this.dc.close(); } catch { /* */ } this.dc = null; }
    if (this.pc) { try { this.pc.close(); } catch { /* */ } this.pc = null; }
    this.pendingCandidates = [];
    this.remoteStream = null;
    this.cb.onRemoteStream(null);

    if (this.isCaller) {
      // Caller redrives the offer with the new (relay-only) PC.
      this.offerSent = true;
      await this.startCallerOffer();
    }
    this.retryingIce = false;
    // Callee waits for the new offer over the existing signaling channel.
  }

  private async flushCandidates() {
    if (!this.pc) return;
    for (const c of this.pendingCandidates) {
      try { await this.pc.addIceCandidate(c); } catch { /* ignore */ }
    }
    this.pendingCandidates = [];
  }

  private wireDataChannel(dc: RTCDataChannel) {
    dc.onmessage = (e) => {
      this.cb.onMessage({
        id: crypto.randomUUID(),
        from: "stranger",
        text: String(e.data).slice(0, 500),
        at: Date.now(),
      });
    };
  }

  sendMessage(text: string): boolean {
    if (!this.dc || this.dc.readyState !== "open") return false;
    this.dc.send(text);
    this.cb.onMessage({
      id: crypto.randomUUID(),
      from: "me",
      text,
      at: Date.now(),
    });
    return true;
  }

  toggleVideo(on: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on));
  }
  toggleAudio(on: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on));
  }

  private handlePeerLeft() {
    this.tearDownPeer();
    if (this.active) {
      this.cb.onMessage({
        id: crypto.randomUUID(),
        from: "system",
        text: "Stranger left. Searching for a new one…",
        at: Date.now(),
      });
      this.joinLobby();
    } else {
      this.cb.onStatus("disconnected");
    }
  }

  private async tearDownPeer() {
    this.clearMatchTimer();
    try { this.signal?.send({ type: "broadcast", event: "bye", payload: {} }); } catch { /* */ }
    if (this.signal) {
      await supabase.removeChannel(this.signal);
      this.signal = null;
    }
    if (this.dc) { try { this.dc.close(); } catch { /* */ } this.dc = null; }
    if (this.pc) { try { this.pc.close(); } catch { /* */ } this.pc = null; }
    this.remoteStream = null;
    this.cb.onRemoteStream(null);
    this.cb.onPeerSession(null);
    this.peerId = null;
    this.offerSent = false;
    this.pendingCandidates = [];
    this.pairRetried = false;
    this.retryingIce = false;
  }

  async skip() {
    await this.tearDownPeer();
    if (this.active) await this.joinLobby();
  }

  async stop() {
    this.active = false;
    await this.tearDownPeer();
    if (this.lobby) {
      await supabase.removeChannel(this.lobby);
      this.lobby = null;
    }
    if (this.online) {
      await supabase.removeChannel(this.online);
      this.online = null;
      this.cb.onOnlineCount?.(0);
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.cb.onLocalStream(null as unknown as MediaStream);
    this.cb.onStatus("idle");
  }

  getPeerId() { return this.peerId; }
}
