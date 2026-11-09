-- =====================================================================
-- Realtime: perubahan tabel dikirim langsung ke semua pengguna yang login.
-- =====================================================================
alter table public.profiles       replica identity full;
alter table public.store_settings replica identity full;
alter table public.products       replica identity full;
alter table public.shifts         replica identity full;
alter table public.orders         replica identity full;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'store_settings', 'products', 'shifts', 'orders'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
