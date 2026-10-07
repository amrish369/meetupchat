DROP POLICY IF EXISTS "rooms public read" ON public.rooms;
CREATE POLICY "rooms signed-in read" ON public.rooms FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "room msgs read authed" ON public.room_messages;
CREATE POLICY "room msgs read own" ON public.room_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);