# Fix: chat box never opens, and accepted calls never connect

## What is actually broken (verified)

The router is treating `/messages`, `/calls` and `/rooms` as **parent layouts** of their detail pages:

```text
messages.tsx      -> parent of messages.$peerId.tsx
calls.tsx         -> parent of calls.$callId.tsx
rooms.tsx         -> parent of rooms.$slug.tsx
```

Confirmed in the generated route tree (`getParentRoute: () => MessagesRoute / CallsRoute / RoomsRoute`). None of those parent pages render an `<Outlet />`, so the child page **never renders**.

Verified live in a signed-in browser: opening `/messages/<userId>` shows the Messages inbox list, not the chat box.

Consequences that match the report exactly:
- Tapping a user opens `/messages/<id>` but the chat box never appears (inbox list renders instead).
- Callee accepts a call, gets navigated to `/calls/<callId>` — but the call screen never mounts, so no offer/answer happens and the caller keeps ringing forever until timeout.
- Community room detail pages have the same hidden breakage.

Database side is healthy: realtime is enabled on `private_calls` and `friend_messages`, RLS/grants allow the flows, and the `respond_private_call` accept path works (a call row reached `accepted`). `friend_messages` is empty simply because the chat box was never reachable.

## Fix

1. Convert the three list pages into index routes so the detail pages are siblings, not blocked children:
   - `src/routes/messages.tsx` -> `src/routes/messages.index.tsx`
   - `src/routes/calls.tsx` -> `src/routes/calls.index.tsx`
   - `src/routes/rooms.tsx` -> `src/routes/rooms.index.tsx`
   (route ids/paths become `/messages/`, `/calls/`, `/rooms/`, which still resolve `/messages` etc. — existing `<Link to="/messages">` calls keep working.)
2. Re-verify the generated tree shows `/messages/$peerId`, `/calls/$callId`, `/rooms/$slug` as root-level children.

## Call reliability follow-ups (same turn)

3. Callee side: keep a light poll (every ~5s) alongside the realtime subscription in `IncomingCallModal`, so a dropped websocket can't swallow an incoming ring.
4. Caller side on `/calls/$callId`: also poll the call row while status is `ringing`, so a missed realtime UPDATE doesn't leave the caller stuck on "Ringing…" after the other side accepts.
5. Show a clear failure state instead of an endless spinner: if ICE does not reach `connected` within ~20s, surface "Connection failed — network is blocking the call" with a Retry button (the app currently has no TURN relay server configured, so some mobile-data networks cannot connect peer-to-peer at all; the message makes that visible rather than silent).

## Verification

- Signed-in browser run: `/messages/<peerId>` renders the chat header + input; send a message and confirm the row lands in `friend_messages` and the thread appears in the inbox.
- `/calls/<callId>` renders the call screen (not the calls list).
- `/rooms/<slug>` renders the room chat.

## Note on calls that still fail after this

Point 5 makes the real remaining limitation visible: without a TURN relay (`TURN_SHARED_SECRET` + `TURN_URLS`), calls between two mobile-data users can fail even with correct signaling. If you want those to work everywhere, the next step is adding TURN credentials — tell me and I'll wire that in.
