CREATE OR REPLACE FUNCTION public.room_message_set_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(p.display_name, p.username, 'Guest')
    INTO NEW.display_name
    FROM public.profiles p
   WHERE p.user_id = NEW.user_id;

  IF NEW.display_name IS NULL THEN
    NEW.display_name := 'Guest';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_room_message_set_display_name ON public.room_messages;

CREATE TRIGGER trg_room_message_set_display_name
BEFORE INSERT OR UPDATE OF display_name, user_id ON public.room_messages
FOR EACH ROW EXECUTE FUNCTION public.room_message_set_display_name();