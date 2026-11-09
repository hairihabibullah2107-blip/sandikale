-- =====================================================================
-- SANDIKALE POS - Skema database (Supabase / PostgreSQL)
-- Jalankan berurutan: 0001 -> 0002 -> 0003 di SQL Editor Supabase.
-- Kolom penting dibuat relasional (untuk filter & laporan), sisanya di
-- kolom `data` (jsonb) agar tetap sama dengan struktur data aplikasi.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Profil pengguna (1 baris per akun Supabase Auth) ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  name        text not null,
  role        text not null default 'kasir' check (role in ('admin', 'kasir', 'produksi')),
  phone       text,
  avatar      text,
  active      boolean not null default false,   -- akun baru nonaktif sampai admin mengaktifkan
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Pengaturan toko (satu baris) ----------
create table if not exists public.store_settings (
  id          integer primary key default 1 check (id = 1),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- ---------- Produk & stok ----------
create table if not exists public.products (
  id             text primary key,
  sku            text,
  barcode        text,
  name           text not null,
  category       text,
  cost_price     numeric not null default 0,
  selling_price  numeric not null default 0,
  stock          integer not null default 0,   -- diubah atomik lewat adjust_stock()
  min_stock      integer not null default 0,
  data           jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_sku_idx on public.products (sku);

-- ---------- Shift kasir (satu shift terbuka per kasir) ----------
create table if not exists public.shifts (
  id            text primary key,
  cashier_id    uuid default auth.uid() references public.profiles(id) on delete set null,
  shift_number  text,
  status        text not null check (status in ('open', 'closed')),
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists shifts_cashier_status_idx on public.shifts (cashier_id, status);
-- Satu kasir hanya boleh punya satu shift terbuka
create unique index if not exists shifts_one_open_per_cashier
  on public.shifts (cashier_id) where status = 'open';

-- ---------- Transaksi (termasuk DP / pelunasan di dalam data.payments) ----------
create table if not exists public.orders (
  id              text primary key,
  invoice_number  text,
  status          text not null,              -- completed | voided | dp
  shift_id        text,
  cashier_id      uuid default auth.uid() references public.profiles(id) on delete set null,
  customer_name   text,
  grand_total     numeric not null default 0,
  data            jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_shift_idx on public.orders (shift_id);
create index if not exists orders_status_idx on public.orders (status);

-- ---------- updated_at otomatis ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'store_settings', 'products', 'shifts', 'orders'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
