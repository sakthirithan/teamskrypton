-- Add grouping_notifications to supabase_realtime publication safely
DO $$
BEGIN
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.grouping_notifications;
