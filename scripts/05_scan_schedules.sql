-- ============================================================
-- Email Bot - Tabela de agendamentos de scan
-- Execute APÓS o 01_schema.sql e 04_rls_policies.sql
-- ============================================================

create table if not exists scan_schedules (
  id uuid primary key default gen_random_uuid(),
  cron_expression text not null,
  source text not null check (source in ('supabase', 'github', 'both')),
  description text,
  active boolean default true,
  created_at timestamptz default now()
);

-- RLS
alter table scan_schedules enable row level security;

create policy "scan_schedules_select"
  on scan_schedules for select
  to anon
  using (true);

create policy "scan_schedules_insert"
  on scan_schedules for insert
  to anon
  with check (true);

create policy "scan_schedules_update"
  on scan_schedules for update
  to anon
  using (true);

create policy "scan_schedules_delete"
  on scan_schedules for delete
  to anon
  using (true);
