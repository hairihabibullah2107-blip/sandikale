-- Tighten default API grants and trigger/helper function execution.
-- Existing RLS policies remain the row-level authorization boundary.
revoke all privileges on table public.profiles, public.store_settings, public.products, public.shifts, public.orders from anon;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_last_admin() from public, anon, authenticated;

revoke all on function public.is_active() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_active() to authenticated;
grant execute on function public.is_admin() to authenticated;
