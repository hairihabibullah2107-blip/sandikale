-- =====================================================================
-- Keamanan: Row Level Security (RLS), fungsi server, dan pembuatan profil.
-- Prinsip: hanya akun AKTIF yang bisa membaca data; hapus laporan
-- (transaksi/shift) hanya ADMIN; stok diubah atomik lewat fungsi.
-- =====================================================================

-- ---------- Fungsi bantu ----------
create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin')
$$;

-- ---------- Profil dibuat otomatis saat akun Auth dibuat ----------
-- Akun PERTAMA otomatis menjadi admin aktif. Akun berikutnya: kasir NONAKTIF
-- (admin yang mengaktifkan/mengatur peran dari menu Pengaturan).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uname text;
  is_first boolean;
begin
  uname := lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)));
  select not exists (select 1 from public.profiles where role = 'admin') into is_first;
  insert into public.profiles (id, username, name, role, phone, active)
  values (
    new.id,
    uname,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), uname),
    case when is_first then 'admin' else 'kasir' end,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    is_first
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Admin terakhir tidak boleh hilang ----------
create or replace function public.protect_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active) then
    if not exists (
      select 1 from public.profiles where role = 'admin' and active and id <> old.id
    ) then
      raise exception 'Admin terakhir tidak boleh dihapus atau dinonaktifkan.' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists protect_last_admin_upd on public.profiles;
create trigger protect_last_admin_upd before update on public.profiles
  for each row execute function public.protect_last_admin();
drop trigger if exists protect_last_admin_del on public.profiles;
create trigger protect_last_admin_del before delete on public.profiles
  for each row execute function public.protect_last_admin();

-- ---------- Aktifkan RLS ----------
alter table public.profiles       enable row level security;
alter table public.store_settings enable row level security;
alter table public.products       enable row level security;
alter table public.shifts         enable row level security;
alter table public.orders         enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_active() or id = auth.uid());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using (public.is_admin());

-- store_settings
drop policy if exists settings_select on public.store_settings;
create policy settings_select on public.store_settings for select to authenticated
  using (public.is_active());
drop policy if exists settings_write_admin on public.store_settings;
create policy settings_write_admin on public.store_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- products (kasir mengubah stok lewat adjust_stock(), bukan update langsung)
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
  using (public.is_active());
drop policy if exists products_write_admin on public.products;
create policy products_write_admin on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- shifts
drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts for select to authenticated
  using (public.is_active());
drop policy if exists shifts_insert on public.shifts;
create policy shifts_insert on public.shifts for insert to authenticated
  with check (public.is_active() and (cashier_id = auth.uid() or public.is_admin()));
drop policy if exists shifts_update on public.shifts;
create policy shifts_update on public.shifts for update to authenticated
  using (public.is_active() and (cashier_id = auth.uid() or public.is_admin()))
  with check (public.is_active() and (cashier_id = auth.uid() or public.is_admin()));
drop policy if exists shifts_delete_admin on public.shifts;
create policy shifts_delete_admin on public.shifts for delete to authenticated
  using (public.is_admin());

-- orders
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select to authenticated
  using (public.is_active());
drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders for insert to authenticated
  with check (public.is_active() and (cashier_id = auth.uid() or public.is_admin()));
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated
  using (public.is_active()) with check (public.is_active());
drop policy if exists orders_delete_admin on public.orders;
create policy orders_delete_admin on public.orders for delete to authenticated
  using (public.is_admin());

-- ---------- Fungsi server (RPC) ----------
-- Stok berubah secara atomik: dua kasir menjual produk yang sama tidak saling menimpa.
create or replace function public.adjust_stock(p_id text, p_delta integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not public.is_active() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;
  update public.products set stock = stock + p_delta where id = p_id returning stock into v;
  if v is null then
    raise exception 'Produk % tidak ditemukan', p_id using errcode = 'P0002';
  end if;
  return v;
end $$;

-- Verifikasi PIN admin (untuk void/reset) tanpa PIN tertanam di aplikasi.
create or replace function public.verify_admin_pin(p_pin text)
returns boolean language plpgsql stable security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_active() then return false; end if;
  return exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where p.role = 'admin' and p.active
      and u.encrypted_password = crypt(p_pin, u.encrypted_password)
  );
end $$;

-- Ganti PIN sendiri (butuh PIN lama).
create or replace function public.change_my_pin(p_old text, p_new text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_active() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  if length(coalesce(p_new, '')) < 6 then raise exception 'PIN minimal 6 karakter' using errcode = '22023'; end if;
  if not exists (select 1 from auth.users where id = auth.uid() and encrypted_password = crypt(p_old, encrypted_password)) then
    raise exception 'PIN lama tidak sesuai' using errcode = '28000';
  end if;
  update auth.users set encrypted_password = crypt(p_new, gen_salt('bf')), updated_at = now() where id = auth.uid();
end $$;

-- Admin mengatur PIN pengguna lain.
create or replace function public.admin_set_user_pin(p_user uuid, p_new text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin' using errcode = '42501'; end if;
  if length(coalesce(p_new, '')) < 6 then raise exception 'PIN minimal 6 karakter' using errcode = '22023'; end if;
  update auth.users set encrypted_password = crypt(p_new, gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

-- Admin menghapus pengguna (akun Auth + profil).
create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'Tidak bisa menghapus akun sendiri' using errcode = 'P0001'; end if;
  delete from auth.users where id = p_user;
end $$;

-- Ubah profil sendiri (nama, telepon, foto) tanpa bisa mengubah peran.
create or replace function public.update_my_profile(p_name text, p_phone text, p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active() then raise exception 'Akses ditolak' using errcode = '42501'; end if;
  update public.profiles
     set name = coalesce(nullif(trim(p_name), ''), name),
         phone = p_phone,
         avatar = p_avatar
   where id = auth.uid();
end $$;

-- Hanya pengguna login yang boleh memanggil fungsi di atas.
revoke all on function public.adjust_stock(text, integer)        from public, anon;
revoke all on function public.verify_admin_pin(text)             from public, anon;
revoke all on function public.change_my_pin(text, text)          from public, anon;
revoke all on function public.admin_set_user_pin(uuid, text)     from public, anon;
revoke all on function public.admin_delete_user(uuid)            from public, anon;
revoke all on function public.update_my_profile(text, text, text) from public, anon;
grant execute on function public.adjust_stock(text, integer)         to authenticated;
grant execute on function public.verify_admin_pin(text)              to authenticated;
grant execute on function public.change_my_pin(text, text)           to authenticated;
grant execute on function public.admin_set_user_pin(uuid, text)      to authenticated;
grant execute on function public.admin_delete_user(uuid)             to authenticated;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
