# Private Chat & Private Call — WhatsApp-style, End to End

Goal: jab do users ek dusre ko follow kar lein (mutual follow = "friends"), unke beech WhatsApp jaisa private chat aur private voice/video call turant kaam kare — aur ye feature app me clearly dikhe.

## Aaj ki asli haalat (verify kiya)

- Private call backend pura maujood hai aur pehle chal chuka hai: `private_calls` table me 23 rows, kuch calls accepted + ended hui thi.
- Private DM ka backend bhi maujood hai (thread trigger active hai), lekin `friend_messages` me **0 messages** hain — matlab ye flow aaj tak kisi ne successfully use nahi kiya.
- Buttons code me hain (profile page, message thread header, `/calls` page), par **discoverability zero** hai: mobile pe sab kuch hamburger menu ke andar chhupa hai, home page pe Chat/Safety ke alawa koi link nahi, aur "ye log aapke friends hain, inse baat karo" jaisa koi screen nahi.

Isi wajah se aapko feature "show nahi ho raha".

## Kya banega

### 1. Friends hub (naya "Private" section)
- Ek hi jagah: mutual followers ki list (WhatsApp contacts jaisi) — avatar, naam, last message preview, unread badge.
- Har row par 3 actions: **Chat**, **Voice call**, **Video call**.
- Row tap = seedha chat box khulega (khali thread bhi), pehla message bhejte hi conversation start.
- Non-mutual followers alag "Requests / Following" tab me, saaf label ke saath: "mutual follow hone par call unlock hoga".

### 2. Mobile bottom navigation
- Fixed bottom bar: Home · Chat · Friends · Inbox · Profile — mobile pe sab kuch ek tap door, hamburger ke bharose nahi.
- Inbox aur Friends par unread/incoming badge.

### 3. Home page entry point
- Home pe ek "Your friends" card: mutual friends count + "Private chat & call" CTA. Signed-out users ko sign-in prompt.

### 4. Chat box polish (WhatsApp feel)
- Thread header me peer ka naam/avatar + Voice/Video call buttons (already hai, mutual-follow state ke hisaab se enable/disable + tooltip).
- Empty thread pe quick-reply chips (already), plus mutual-follow na hone par 3-message limit ka clear counter.
- Realtime message delivery + read receipts verify karke fix.

### 5. Call flow end-to-end
- Caller ko "Ringing…" screen, callee ko full-screen incoming modal (already) — timeout ke baad auto "missed".
- Accept ke baad dono ek hi room me: local/remote video, mute, camera on/off, camera flip, fullscreen, hang up.
- Missed/declined/ended states dono taraf sync (realtime + fallback poll), stale "ringing" rows auto-close.

### 6. End-to-end testing (main karunga)
Do test users se browser me actual flow chala kar verify karunga:
1. A follows B, B follows A → dono ki Friends list me ek dusre dikhein.
2. A → B message bheje, B ko realtime mile, read receipt update ho.
3. Non-mutual case: 3 message limit + accept/decline banner.
4. A → B video call: B pe ring, accept, dono connected, camera flip, hang up, dono screen band.
5. Voice call, decline, aur missed-call case.
Jo bhi toote, usi turn me fix karunga.

## Technical notes

- Naya route `/friends` ko private hub banaya jayega, `mutual_followers()` + `friend_conversations()` RPCs ko join karke ek list (koi manual UUID nahi).
- Naya component `MobileTabBar` `__root.tsx` me mount hoga (auth hone par), safe-area padding ke saath.
- Call gating already server-side hai (`start_private_call` me `is_mutual_follow` check) — UI usi truth ko mirror karega, client-side trust nahi.
- Ringing timeout ke liye `end_private_call` ko client timer se call karenge; koi naya table nahi. Sirf zarurat pade to ek chhoti migration (stale ringing cleanup helper) — bataunga pehle.
- Sab kuch existing design tokens/shadcn components me, dark theme, mobile-first. Existing matchmaking, premium, admin code untouched.
