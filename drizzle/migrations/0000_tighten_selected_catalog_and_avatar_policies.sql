DROP POLICY IF EXISTS "gifts public read" ON public.gifts;
CREATE POLICY "gifts authenticated read" ON public.gifts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "achievements public read" ON public.achievements;
CREATE POLICY "achievements authenticated read" ON public.achievements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars owner list" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);