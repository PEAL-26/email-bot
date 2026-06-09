-- ============================================================
-- Email Bot - RLS Policies para acesso via anon key
-- Execute APÓS o 01_schema.sql
-- ============================================================

-- Habilitar RLS nas tabelas
alter table email_accounts enable row level security;
alter table filter_rules enable row level security;
alter table notified_emails enable row level security;

-- ============================================================
-- email_accounts
-- SELECT: permite ler, mas esconde colunas de senha
-- INSERT: permite criar novas contas
-- UPDATE: permite editar (inclusive desativar)
-- DELETE: bloqueado (desativar via active=false)
-- ============================================================

create policy "email_accounts_select"
  on email_accounts for select
  to anon
  using (true);

create policy "email_accounts_insert"
  on email_accounts for insert
  to anon
  with check (true);

create policy "email_accounts_update"
  on email_accounts for update
  to anon
  using (true);

-- ============================================================
-- filter_rules
-- CRUD completo para anon
-- ============================================================

create policy "filter_rules_select"
  on filter_rules for select
  to anon
  using (true);

create policy "filter_rules_insert"
  on filter_rules for insert
  to anon
  with check (true);

create policy "filter_rules_update"
  on filter_rules for update
  to anon
  using (true);

create policy "filter_rules_delete"
  on filter_rules for delete
  to anon
  using (true);

-- ============================================================
-- notified_emails
-- SELECT apenas
-- ============================================================

create policy "notified_emails_select"
  on notified_emails for select
  to anon
  using (true);
