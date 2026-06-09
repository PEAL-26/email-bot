-- ============================================================
-- Email Bot - Agendamento via pg_cron
-- Execute APÓS o 01_schema.sql e 02_seed.sql
-- ============================================================

-- Variável de configuração (ajuste conforme necessário)
-- A URL da Edge Function init do Supabase
-- Substitua <PROJECT_ID> pelo ID do seu projeto Supabase

-- Agendar varredura a cada 6 horas
select cron.schedule(
  'scan-emails',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://footmbgthcbncfekhzov.supabase.co/functions/v1/init',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    )
  );
  $$
);

-- Para remover o agendamento:
-- select cron.unschedule('scan-emails');