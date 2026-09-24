-- Keep extensions out of the exposed schema; the seeding trigger function must not be callable via RPC.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
revoke execute on function public.seed_user_defaults() from public, anon, authenticated;
