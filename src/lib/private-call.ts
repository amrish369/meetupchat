/**
 * Private 1:1 call engine — caller/callee already known via private_calls row.
 * Uses Supabase Realtime broadcast on a deterministic room channel for SDP/ICE.
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
  } catch {
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
    ];
  }
}

export type CallStatus =
  | "idle"
  | "requesting-media"
  | "connecting"
  | "connected"
  | "ended"
  | "error";

export type CallMode = "video" | "audio";

interface Callbacks {
  onStatus: (s: CallStatus, info?: string) => void;
  onLocalStream: (s: MediaStream | null) => void;
  onRemoteStream: (s: MediaStream | null) => void;
  onPeerLeft?: () => void;
}

export class PrivateCall {
  private userId: string;
  private roomId: string;
  private isCaller: boolean;
  private mode: CallMode;
  private cb: Callbacks;

  private signal: RealtimeChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private offerSent = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private active = false;
  private forceRelay = false;
  private retried = false;
  private currentFacing: "user" | "environment" = "user";

  constructor(opts: {
    userId: string;
    roomId: string;
    isCaller: boolean;
    mode: CallMode;
    cb: Callbacks;
  }) {
    this.userId = opts.userId;
    this.roomId = opts.roomId;
    this.isCaller = opts.isCaller;
    this.mode = opts.mode;
    this.cb = opts.cb;
  }

  async start() {
    if (this.active) return;
    this.active = true;
    this.cb.onStatus("requesting-media");
    try {
      const constraints: MediaStreamConstraints =
        this.mode === "video"
          ? {
              video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
              audio: { echoCancellation: true, noiseSuppression: true },
            }
          : { video: false, audio: { echoCancellation: true, noiseSuppression: true } };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.cb.onLocalStream(this.localStream);
    } catch {
      this.cb.onStatus("error", "Camera/mic permission denied.");
      this.active = false;
      return;
    }
    this.cb.onStatus("connecting");
    await this.openSignaling();
  }

  private async openSignaling() {
    const ch = supabase.channel(`room:${this.roomId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this.userId },
      },
    });

    ch.on("presence", { event: "sync" }, () => {
      if (!this.isCaller || this.offerSent || !this.signal) return;
      const state = this.signal.presenceState();
      // wait for peer presence
      const keys = Object.keys(state);
      if (keys.some((k) => k !== this.userId)) {
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
        const c = payload.candidate as RTCIceCandidateInit;
        if (!this.pc.remoteDescription) {
          this.pendingCandidates.push(c);
          return;
        }
        try { await this.pc.addIceCandidate(c); } catch { /* */ }
      })
      .on("broadcast", { event: "bye" }, () => {
        this.cb.onPeerLeft?.();
        void this.stop();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await ch.track({ at: Date.now() });
      });
    this.signal = ch;
  }

  private async startCallerOffer() {
    await this.ensurePc();
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.signal?.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
  }

  private async ensurePc() {
    if (this.pc) return;
    const iceServers = await fetchIceServers(this.userId);
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
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") this.cb.onStatus("connected");
      if (s === "failed") void this.retryRelay();
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") void this.retryRelay();
    };
  }

  private async retryRelay() {
    if (this.retried) return;
    this.retried = true;
    this.forceRelay = true;
    turnCache = null;
    this.cb.onStatus("connecting", "Reconnecting via relay…");
    try { this.pc?.close(); } catch { /* */ }
    this.pc = null;
    this.pendingCandidates = [];
    this.remoteStream = null;
    this.cb.onRemoteStream(null);
    if (this.isCaller) {
      this.offerSent = true;
      await this.startCallerOffer();
    }
  }

  private async flushCandidates() {
    if (!this.pc) return;
    for (const c of this.pendingCandidates) {
      try { await this.pc.addIceCandidate(c); } catch { /* */ }
    }
    this.pendingCandidates = [];
  }

  toggleVideo(on: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = on));
  }
  toggleAudio(on: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = on));
  }

  async switchCamera(): Promise<"user" | "environment"> {
    if (!this.localStream || this.mode !== "video") throw new Error("No video");
    const next = this.currentFacing === "user" ? "environment" : "user";
    const old = this.localStream.getVideoTracks()[0];
    const oldId = old?.getSettings?.().deviceId;
    if (old) { this.localStream.removeTrack(old); try { old.stop(); } catch {} }
    const get = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c);
    let s: MediaStream | null = null;
    try { s = await get({ video: { facingMode: { exact: next } }, audio: false }); } catch {}
    if (!s) try { s = await get({ video: { facingMode: { ideal: next } }, audio: false }); } catch {}
    if (!s) try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const cams = devs.filter((d) => d.kind === "videoinput");
      if (cams.length > 1) {
        const other = cams.find((c) => c.deviceId && c.deviceId !== oldId) ?? cams[1];
        s = await get({ video: { deviceId: { exact: other.deviceId } }, audio: false });
      }
    } catch {}
    if (!s) {
      try {
        const r = await get({ video: { facingMode: { ideal: this.currentFacing } }, audio: false });
        const t = r.getVideoTracks()[0];
        if (t) {
          this.localStream.addTrack(t);
          const sender = this.pc?.getSenders().find((x) => x.track?.kind === "video");
          if (sender) await sender.replaceTrack(t);
          this.cb.onLocalStream(this.localStream);
        }
      } catch {}
      throw new Error("Only one camera available");
    }
    const t = s.getVideoTracks()[0];
    const sender = this.pc?.getSenders().find((x) => x.track?.kind === "video");
    if (sender) await sender.replaceTrack(t);
    this.localStream.addTrack(t);
    this.cb.onLocalStream(this.localStream);
    this.currentFacing = next;
    return next;
  }

  getFacing() { return this.currentFacing; }
  getMode() { return this.mode; }

  async stop() {
    if (!this.active) return;
    this.active = false;
    try { this.signal?.send({ type: "broadcast", event: "bye", payload: {} }); } catch {}
    if (this.signal) { await supabase.removeChannel(this.signal); this.signal = null; }
    try { this.pc?.close(); } catch {}
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStream = null;
    this.cb.onLocalStream(null);
    this.cb.onRemoteStream(null);
    this.cb.onStatus("ended");
  }
}
