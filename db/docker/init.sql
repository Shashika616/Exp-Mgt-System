-- Runs once when the local container is first created.
-- Creates the least-privilege application role the app connects as (docs/architecture.md §4.3).
create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_rw') then
    create role app_rw login password 'app_rw_dev_password' nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
end $$;
grant connect on database expendables to app_rw;
