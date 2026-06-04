-- Block non-admin writes to user_roles to prevent self-grant privilege escalation
CREATE POLICY "user_roles deny insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_roles deny update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "user_roles deny delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Owner-scoped management policies for payment-proofs so users can replace/remove their own uploads
CREATE POLICY "payment-proofs owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "payment-proofs owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);