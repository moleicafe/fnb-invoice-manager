-- 002_security_hardening.sql
-- Closes Supabase security-advisor warnings left by 001_core.sql.
-- All changes are safe for the running app: RLS policies and the signup
-- trigger keep working exactly as before.

-- 1. Pin search_path on the updated-at trigger function.
--    is_admin() and handle_new_user() already set it in 001; this one was
--    missed. Prevents search_path hijacking of the function body.
alter function public.set_updated_at() set search_path = public;

-- 2. Remove the internal SECURITY DEFINER helpers from the public REST/RPC
--    surface. They are only meant to be used internally (is_admin by RLS
--    policies; handle_new_user by the auth.users trigger), never called
--    directly over /rest/v1/rpc.
--
--    RLS policies evaluate is_admin() in the *authenticated* role's context,
--    so authenticated must keep EXECUTE — we drop only the PUBLIC/anon grant.
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

--    handle_new_user() only ever runs as the auth.users INSERT trigger, which
--    fires regardless of EXECUTE grants — so it needs no public grant at all.
revoke execute on function public.handle_new_user() from public;
