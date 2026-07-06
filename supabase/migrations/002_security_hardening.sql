-- 002_security_hardening.sql
-- Closes Supabase security-advisor warnings left by 001_core.sql.
-- All changes are safe for the running app: RLS policies and the signup
-- trigger keep working exactly as before.

-- 1. Pin search_path on the updated-at trigger function.
--    is_admin() and handle_new_user() already set it in 001; this one was
--    missed. Prevents search_path hijacking of the function body.
alter function public.set_updated_at() set search_path = public;

-- 2. Remove the internal SECURITY DEFINER helpers from the public REST/RPC
--    surface. Supabase grants EXECUTE to anon/authenticated explicitly (not
--    only via PUBLIC), so revoke from those roles by name.
--
--    handle_new_user() only ever runs as the auth.users INSERT trigger, which
--    fires as its definer regardless of these grants — remove it entirely.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

--    is_admin() is invoked inside RLS policies in the *authenticated* role's
--    context, so authenticated must keep EXECUTE; strip only public + anon.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
