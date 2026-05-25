/**
 * Distributed WebRTC matchmaker.
 *
 * Architecture
 * ────────────
 *  1. A Postgres-backed global queue (`public.match_queue`) acts as the
 *     coordination layer. Each browser tab calls the `request_match` RPC,
 *     which atomically pops the oldest waiting peer using
 *     `FOR UPDATE SKIP LOCKED` — guaranteeing O(1), race-free pairing
 *     even with thousands of concurrent callers across any number of
 *     server replicas. If no peer is waiting, the caller is enqueued.
 *  2. When two callers match, a row is inserted into `public.matches`.
 *     The OTHER peer (who was waiting) gets notified via Supabase
 *     Realtime postgres_changes on the `matches` table → sub-second match
 *     notification without any client-side polling.
 *  3. Both peers then open a private Realtime broadcast channel keyed by
 *     the deterministic `room_id` from the match row and exchange SDP
 *     offer/answer + ICE candidates.
 *  4. WebRTC connection establishes peer-to-peer (audio + video + data
 *     channel for in-call text). No media ever touches our servers.
 *  5. ICE failure → automatic relay (TURN) retry; persists for the
 *     remainder of the session.
 *  6. A 15s heartbeat keeps the queue entry alive; a 30s sweep evicts
 *     stale rows so dropped tabs don't pollute the queue.
 *
 * Horizontal scalability: all state lives in Postgres + Realtime. Any
 * number of clients can hit the RPC concurrently — `SKIP LOCKED` means
 * each call grabs a distinct row in O(1).
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getTurnCredentials, type TurnCredentialsResponse } from "@/lib/turn.functions";

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

function createConnectionId(sessionId: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${sessionId}-${suffix}`;
}

export class Matchmaker {
  private sessionId: string;
  private connectionId: string;
  private cb: Callbacks;

  private matchesChannel: RealtimeChannel | null = null;
  private onlineChannel: RealtimeChannel | null = null;
  private signal: RealtimeChannel | null = null;

  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dc: RTCDataChannel | null = null;

  private peerId: string | null = null;
  private roomId: string | null = null;
  private isCaller = false;
  private active = false;
  private offerSent = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private matchTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private queuedMatchPollTimer: ReturnType<typeof setInterval> | null = null;

  private retryingIce = false;
  private forceRelay = false;
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
    } catch {
      this.cb.onStatus("error", "Camera/mic permission denied. Please allow access.");
      this.active = false;
      return;
    }

    this.subscribeOnlineCount();
    await this.enterQueue();
  }

  /**
   * Subscribes to `matches` table inserts where this connection is involved,
   * and periodically polls the online count from the `online_count()` RPC.
   * The realtime subscription is what makes match notification sub-second.
   */
  private subscribeOnlineCount() {
    void this.refreshOnlineCount();
    if (this.onlineRefreshTimer) clearInterval(this.onlineRefreshTimer);
    this.onlineRefreshTimer = setInterval(() => void this.refreshOnlineCount(), 5000);
  }

  private async refreshOnlineCount() {
    const { data } = await supabase.rpc("online_count");
    if (typeof data === "number") this.cb.onOnlineCount?.(data);
  }

  /**
   * The main matchmaking entry point. Calls the atomic `request_match` RPC:
   *   • If a peer is waiting → returns 'matched' with room_id + peer
   *   • If no peer is waiting → enqueues us, returns 'queued'.
   *
   * When queued, we listen on the `matches` table for an INSERT that
   * mentions our connectionId — that's our pairing notification.
   */
  private async enterQueue() {
    this.cb.onStatus("searching");
    this.cb.onRemoteStream(null);
    this.cb.onPeerSession(null);
    this.clearMatchTimer();
    this.peerId = null;
    this.roomId = null;
    this.pairRetried = false;
    this.offerSent = false;

    // Subscribe to matches table BEFORE calling request_match to avoid race
    await this.subscribeMatches();

    const { data, error } = await supabase.rpc("request_match", {
      p_session_id: this.connectionId,
    });

    if (error) {
      console.error("[matchmaker] request_match failed", error);
      this.cb.onStatus("error", "Could not reach matchmaking server.");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (row?.status === "matched") {
      this.handleMatched({
        match_id: row.match_id,
        room_id: row.room_id,
        peer_session: row.peer_session,
        is_caller: row.is_caller,
      });
    } else {
      // Queued — start heartbeat so our entry stays fresh
      this.startHeartbeat();
      this.startQueuedMatchPolling();
    }
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      void supabase.rpc("heartbeat_queue", { p_session_id: this.connectionId });
    }, 15_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Realtime is the fast path, but mobile networks/proxies can drop websocket
   * notifications. Polling the already-indexed active match row is the safety
   * net that guarantees a waiting user still starts signaling automatically.
   */
  private startQueuedMatchPolling() {
    this.stopQueuedMatchPolling();
    this.queuedMatchPollTimer = setInterval(() => {
      void this.findExistingMatch();
    }, 1_000);
    void this.findExistingMatch();
  }

  private stopQueuedMatchPolling() {
    if (this.queuedMatchPollTimer) {
      clearInterval(this.queuedMatchPollTimer);
      this.queuedMatchPollTimer = null;
    }
  }

  private async findExistingMatch() {
    if (!this.active || this.roomId) return;
    const { data, error } = await supabase
      .from("matches")
      .select("id, room_id, session_a, session_b, caller")
      .is("ended_at", null)
      .or(`session_a.eq.${this.connectionId},session_b.eq.${this.connectionId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;
    const peer = data.session_a === this.connectionId ? data.session_b : data.session_a;
    this.handleMatched({
      match_id: data.id,
      room_id: data.room_id,
      peer_session: peer,
      is_caller: data.caller === this.connectionId,
    });
  }

  /**
   * Subscribes to public.matches INSERTs. When the OTHER peer matches us,
   * they create the row → we get notified instantly via postgres_changes.
   */
  private async subscribeMatches() {
    if (this.matchesChannel) {
      await supabase.removeChannel(this.matchesChannel);
      this.matchesChannel = null;
    }
    const ch = supabase.channel(`match-listener:${this.connectionId}`);
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "matches" },
      (payload) => {
        const row = payload.new as {
          id: string;
          room_id: string;
          session_a: string;
          session_b: string;
          caller: string;
        };
        if (row.session_a !== this.connectionId && row.session_b !== this.connectionId) return;
        if (this.roomId) return; // already matched
        const peer = row.session_a === this.connectionId ? row.session_b : row.session_a;
        this.handleMatched({
          match_id: row.id,
          room_id: row.room_id,
          peer_session: peer,
          is_caller: row.caller === this.connectionId,
        });
      }
    );
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 2_500);
      ch.subscribe((status) => {
        if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    this.matchesChannel = ch;
  }

  private handleMatched(m: {
    match_id: string;
    room_id: string;
    peer_session: string;
    is_caller: boolean;
  }) {
    this.stopHeartbeat();
    this.stopQueuedMatchPolling();
    this.peerId = m.peer_session;
    this.roomId = m.room_id;
    this.isCaller = m.is_caller;
    this.cb.onPeerSession(m.peer_session);
    this.cb.onStatus("connecting");
    this.scheduleMatchTimeout();
    void this.openSignaling(m.room_id);
  }

  private async openSignaling(roomId: string) {
    if (this.signal) {
      await supabase.removeChannel(this.signal);
      this.signal = null;
    }
    this.offerSent = false;
    const ch = supabase.channel(`room:${roomId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this.connectionId },
      },
    });

    ch.on("presence", { event: "sync" }, () => {
      if (!this.isCaller || this.offerSent || !this.signal) return;
      const state = this.signal.presenceState();
      // Wait for the callee to be present before firing the offer
      if (this.peerId && Object.keys(state).includes(this.peerId)) {
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
        try { await this.pc.addIceCandidate(candidate); } catch { /* */ }
      })
      .on("broadcast", { event: "bye" }, () => {
        void this.handlePeerLeft();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ at: Date.now() });
        }
      });
    this.signal = ch;
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
      void this.handlePeerLeft();
    }, 15_000);
  }

  private clearMatchTimer() {
    if (this.matchTimer) {
      clearTimeout(this.matchTimer);
      this.matchTimer = null;
    }
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
      if (pc.iceConnectionState === "failed") void this.handleIceFailure();
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        this.clearMatchTimer();
        this.cb.onStatus("connected");
        this.pairRetried = false;
        this.retryingIce = false;
      }
      if (s === "failed") void this.handleIceFailure();
      if (s === "disconnected") {
        setTimeout(() => {
          if (this.pc === pc && pc.connectionState === "disconnected") {
            void this.handlePeerLeft();
          }
        }, 4000);
      }
    };

    pc.ondatachannel = (e) => {
      this.dc = e.channel;
      this.wireDataChannel(e.channel);
    };
  }

  private async handleIceFailure() {
    if (this.retryingIce) return;
    this.retryingIce = true;
    if (this.pairRetried) {
      this.cb.onMessage({
        id: crypto.randomUUID(),
        from: "system",
        text: "Connection failed. Searching for a new stranger…",
        at: Date.now(),
      });
      await this.handlePeerLeft();
      this.retryingIce = false;
      return;
    }
    this.pairRetried = true;
    this.forceRelay = true;
    turnCache = null;

    this.cb.onStatus("connecting", "Reconnecting via relay…");
    this.cb.onMessage({
      id: crypto.randomUUID(),
      from: "system",
      text: "Network is strict — switching to relay (TURN)…",
      at: Date.now(),
    });

    if (this.dc) { try { this.dc.close(); } catch { /* */ } this.dc = null; }
    if (this.pc) { try { this.pc.close(); } catch { /* */ } this.pc = null; }
    this.pendingCandidates = [];
    this.remoteStream = null;
    this.cb.onRemoteStream(null);

    if (this.isCaller) {
      this.offerSent = true;
      await this.startCallerOffer();
    }
    this.retryingIce = false;
  }

  private async flushCandidates() {
    if (!this.pc) return;
    for (const c of this.pendingCandidates) {
      try { await this.pc.addIceCandidate(c); } catch { /* */ }
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

  private async handlePeerLeft() {
    await this.tearDownPeer();
    if (this.active) {
      this.cb.onMessage({
        id: crypto.randomUUID(),
        from: "system",
        text: "Stranger left. Searching for a new one…",
        at: Date.now(),
      });
      await this.enterQueue();
    } else {
      this.cb.onStatus("disconnected");
    }
  }

  private async tearDownPeer() {
    this.clearMatchTimer();
    this.stopQueuedMatchPolling();
    const endedRoomId = this.roomId;
    try { this.signal?.send({ type: "broadcast", event: "bye", payload: {} }); } catch { /* */ }
    if (this.signal) {
      await supabase.removeChannel(this.signal);
      this.signal = null;
    }
    if (endedRoomId) {
      void (supabase.rpc as any)("end_match", {
        p_room_id: endedRoomId,
        p_session_id: this.connectionId,
      });
    }
    if (this.dc) { try { this.dc.close(); } catch { /* */ } this.dc = null; }
    if (this.pc) { try { this.pc.close(); } catch { /* */ } this.pc = null; }
    this.remoteStream = null;
    this.cb.onRemoteStream(null);
    this.cb.onPeerSession(null);
    this.peerId = null;
    this.roomId = null;
    this.offerSent = false;
    this.pendingCandidates = [];
    this.pairRetried = false;
    this.retryingIce = false;
  }

  async skip() {
    await this.tearDownPeer();
    // Make sure we leave the queue before re-entering (in case we were waiting)
    await supabase.rpc("leave_queue", { p_session_id: this.connectionId });
    if (this.active) await this.enterQueue();
  }

  async stop() {
    this.active = false;
    this.stopHeartbeat();
    this.stopQueuedMatchPolling();
    if (this.onlineRefreshTimer) {
      clearInterval(this.onlineRefreshTimer);
      this.onlineRefreshTimer = null;
    }
    await this.tearDownPeer();
    await supabase.rpc("leave_queue", { p_session_id: this.connectionId });
    if (this.matchesChannel) {
      await supabase.removeChannel(this.matchesChannel);
      this.matchesChannel = null;
    }
    if (this.onlineChannel) {
      await supabase.removeChannel(this.onlineChannel);
      this.onlineChannel = null;
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.cb.onLocalStream(null as unknown as MediaStream);
    this.cb.onOnlineCount?.(0);
    this.cb.onStatus("idle");
  }

  getPeerId() { return this.peerId; }
}
