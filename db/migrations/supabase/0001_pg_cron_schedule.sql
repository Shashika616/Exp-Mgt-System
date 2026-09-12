-- Supabase-only (not part of the portable set): schedule the app's jobs with pg_cron + pg_net.
-- Enable both extensions in the Supabase dashboard (Database → Extensions) first, then run this file
-- in the SQL editor after replacing <APP_URL> and <CRON_SECRET>. Vercel Hobby cron only runs daily,
-- so the minute-level SLA tick lives here. On your own cloud: run `pnpm cron` from a system cron instead.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('expendables-sla-tick', '* * * * *', $$
  select net.http_get(url := '<APP_URL>/api/cron/sla-tick', headers := '{"authorization": "Bearer <CRON_SECRET>"}'::jsonb);
$$);
select cron.schedule('expendables-notify-flush', '* * * * *', $$
  select net.http_get(url := '<APP_URL>/api/cron/notify-flush', headers := '{"authorization": "Bearer <CRON_SECRET>"}'::jsonb);
$$);
select cron.schedule('expendables-daily-stats', '5 0 * * *', $$
  select net.http_get(url := '<APP_URL>/api/cron/daily-stats', headers := '{"authorization": "Bearer <CRON_SECRET>"}'::jsonb);
$$);
