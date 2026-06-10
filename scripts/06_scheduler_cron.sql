-- ============================================================
-- Email Bot - Agendamento do scan-scheduler via pg_cron
-- Execute APÓS o 05_scan_schedules.sql
-- ============================================================

-- Remove agendamento anterior se existir
select cron.unschedule('scan-scheduler');

-- Agenda o scheduler a cada 1 minuto
-- Ele lê a tabela scan_schedules e dispara scans nos horários configurados
select cron.schedule(
  'scan-scheduler',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://footmbgthcbncfekhzov.supabase.co/functions/v1/scan-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    )
  );
  $$
);
