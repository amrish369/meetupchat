## Goal
Mutual followers (jo ek dusre ko follow karte hain) ek dusre ko private video/audio call kar saken — WhatsApp jaisa ringing flow ke saath.

## Scope

### 1. Database (single migration)
- `private_calls` table: `id`, `caller_id`, `callee_id`, `room_id` (deterministic), `mode` ('video'|'audio'), `status` ('ringing'|'accepted'|'declined'|'missed'|'ended'), `created_at`, `answered_at`, `ended_at`.
- RLS: caller/callee read & update only their own rows; insert via RPC only.
- Enable realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE private_calls`.
- RPCs:
  - `mutual_followers()` → list with `user_id, display_name, username, avatar_url`. Only returns users where BOTH follow rows exist.
  - `start_private_call(p_callee, p_mode)` → validates mutual follow, ends any prior active call, inserts ringing row, returns full row.
  - `respond_private_call(p_call_id, p_accept)` → only callee may respond; sets accepted/declined.
  - `end_private_call(p_call_id)` → either party may end.
  - Auto-mark `missed` via 35s server-side check (handled client-side fallback ok).

### 2. WebRTC engine
- New `src/lib/private-call.ts` — slimmed `Matchmaker`-style class:
  - Takes `roomId` + `isCaller` + `mode` (skips entire matchmaking queue).
  - Uses same Supabase Realtime broadcast channel `room:<roomId>` for SDP/ICE exchange.
  - Reuses `getTurnCredentials()` and STUN fallback.
  - `mode === 'audio'` → `getUserMedia({ audio: true, video: false })`.

### 3. UI

**New route `/calls`** — dedicated page:
- Header "Private Calls" + back button.
- List of mutual followers (avatar, name, username).
- Each row: 📹 video & 🎙 audio buttons.
- Empty state: "Mutual follow karein call ke liye."

**New route `/calls/$callId`** — active call screen:
- Full-screen video (or audio-only avatar UI for audio calls).
- Mute / camera toggle / end / flip-camera controls (reuse from chat.tsx).
- Connection status badge.

**Global incoming-call modal** (in `__root.tsx`):
- Subscribe to `private_calls` realtime inserts where `callee_id = me` & `status = 'ringing'`.
- Full-screen ringing UI with caller avatar + Accept/Decline.
- On accept → navigate to `/calls/$callId`.

**Entry points added:**
- Profile page `/u/$userId` → "Call" buttons (only if mutual follow).
- Messages thread `/messages/$peerId` header → phone & video icons (only if mutual follow).
- Existing nav (in site-header or menu) → link to `/calls`.

### 4. Out of scope
- Group calls, screen-share, call recording, push notifications when app closed (browser limitation).
- Presence (online/offline dot) — defer, just allow call attempt; if no answer in 35s → missed.

## Files

**New**
- `src/lib/private-call.ts` — WebRTC engine
- `src/routes/calls.tsx` — list page
- `src/routes/calls.$callId.tsx` — call screen
- `src/components/incoming-call-modal.tsx` — global listener + modal

**Edited**
- `src/routes/__root.tsx` — mount `<IncomingCallModal />`
- `src/routes/u.$userId.tsx` — add Call buttons
- `src/routes/messages.$peerId.tsx` — header call icons
- `src/components/site-header.tsx` — link to `/calls`

**Migration** — `private_calls` table + 4 RPCs + realtime publication + GRANTs.

## Notes
- Mode chosen at initiation; recipient inherits same mode.
- `room_id` = `'pc-' || call_id` so signaling channel is deterministic.
- Permission errors and TURN fallback already handled by reused helpers.