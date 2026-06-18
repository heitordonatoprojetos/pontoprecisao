-- Move pg_net out of public schema (security best practice)
-- pg_net does not support ALTER EXTENSION ... SET SCHEMA, so we must drop and recreate it.
-- We also re-create the cron job that depends on net.http_post.

-- 1) Remove existing cron job that depends on pg_net
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'send-reminders-every-minute';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- 2) Drop and recreate pg_net in the extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

-- 3) Recreate the cron job, calling extensions.http_post with the CRON_SECRET from vault
SELECT cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://syqjtvwornsosglvzexf.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY'),
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
