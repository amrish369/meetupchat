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
 *
 * No video/audio data ever touches our servers. Only signaling.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * ICE server configuration.
 *
 * STUN-only works for ~70-80% of users on home Wi-Fi, but fails for users
 * behind symmetric NATs / strict carrier-grade NATs (very common on Indian
 * mobile networks like Jio/Airtel). For those users a TURN relay server is
 * required so media can be relayed when direct P2P fails.
 *
 * To enable TURN, set these env vars in your project (.env):
 *
 *   VITE_TURN_URLS=turn:turn.example.com:3478,turns:turn.example.com:5349
 *   VITE_TURN_USERNAME=your-username
 *   VITE_TURN_CREDENTIAL=your-password
 *
 * You can self-host with Coturn (open source) or use a managed provider like
 * Metered.ca, Twilio, or Cloudflare Calls. Multiple URLs can be passed
 * comma-separated to support both UDP (turn:) and TLS (turns:) transports —
 * turns: on port 443 is critical to traverse restrictive corporate / public
 * Wi-Fi firewalls.
 *
 * If no TURN env vars are configured we fall back to STUN-only.
 */
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];

  const turnUrlsRaw = import.meta.env.VITE_TURN_URLS as string | undefined;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

  if (turnUrlsRaw && turnUsername && turnCredential) {
    const urls = turnUrlsRaw
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      servers.push({
        urls,
        username: turnUsername,
        credential: turnCredential,
      });
    }
  }

  return servers;
}

const ICE_SERVERS: RTCIceServer[] = buildIceServers();

/**
 * When TURN is configured, prefer "all" so the browser can try host/srflx
 * candidates first and only relay when needed. Set VITE_TURN_FORCE_RELAY=true
 * to force all media through TURN (useful for testing TURN server health, or
 * in privacy-strict deployments where you never want peers to learn each
 * other's public IP).
 */
const ICE_TRANSPORT_POLICY: RTCIceTransportPolicy =
  import.meta.env.VITE_TURN_FORCE_RELAY === "true" ? "relay" : "all";

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
}

function pairId(a: string, b: string) {
  return [a, b].sort().join("__");
}

export class Matchmaker {
  private sessionId: string;
  private cb: Callbacks;
  private lobby: RealtimeChannel | null = null;
  private signal: RealtimeChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dc: RTCDataChannel | null = null;
  private peerId: string | null = null;
  private isCaller = false;
  private active = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(sessionId: string, cb: Callbacks) {
    this.sessionId = sessionId;
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

    await this.joinLobby();
  }

  private async joinLobby() {
    this.cb.onStatus("searching");
    this.cb.onRemoteStream(null);
    this.cb.onPeerSession(null);
    this.peerId = null;

    // Tear down any previous lobby
    if (this.lobby) {
      await supabase.removeChannel(this.lobby);
      this.lobby = null;
    }

    this.lobby = supabase.channel("lobby", {
      config: { presence: { key: this.sessionId } },
    });

    this.lobby
      .on("presence", { event: "sync" }, () => this.tryMatch())
      .on("presence", { event: "join" }, () => this.tryMatch())
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.lobby?.track({ at: Date.now() });
        }
      });
  }

  private async tryMatch() {
    if (!this.lobby || this.peerId) return;
    const state = this.lobby.presenceState();
    const others = Object.keys(state).filter((k) => k !== this.sessionId);
    if (others.length === 0) return;

    // Pick the "oldest waiting" peer (lowest sessionId for determinism).
    others.sort();
    const candidate = others[0];

    this.peerId = candidate;
    this.isCaller = this.sessionId < candidate;
    this.cb.onPeerSession(candidate);
    this.cb.onStatus("connecting");

    // Stop accepting more matches by leaving the lobby
    if (this.lobby) {
      await this.lobby.untrack();
    }

    await this.openSignaling(candidate);
  }

  private async openSignaling(peer: string) {
    const id = pairId(this.sessionId, peer);
    this.signal = supabase.channel(`pair:${id}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    this.signal
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
          // ignore
        }
      })
      .on("broadcast", { event: "bye" }, () => {
        this.handlePeerLeft();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && this.isCaller) {
          await this.ensurePc();
          this.dc = this.pc!.createDataChannel("chat");
          this.wireDataChannel(this.dc);
          const offer = await this.pc!.createOffer();
          await this.pc!.setLocalDescription(offer);
          this.signal?.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
        }
      });
  }

  private async ensurePc() {
    if (this.pc) return;
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceTransportPolicy: ICE_TRANSPORT_POLICY,
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

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") this.cb.onStatus("connected");
      if (s === "failed" || s === "disconnected") this.handlePeerLeft();
    };

    pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this.wireDataChannel(e.channel);
    };
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
    this.pendingCandidates = [];
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
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.cb.onLocalStream(null as unknown as MediaStream);
    this.cb.onStatus("idle");
  }

  getPeerId() { return this.peerId; }
}
