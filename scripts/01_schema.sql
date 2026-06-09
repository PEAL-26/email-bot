-- ============================================================
-- Email Bot - Schema do banco de dados
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Extensões necessárias
create extension if not exists "pg_net";
create extension if not exists "pg_cron";

-- Contas de email
-- password         = texto plano (deprecated, manter para migração)
-- password_cipher  = senha encriptada com AES-256-GCM (ciphertext)
-- password_iv      = vetor de inicialização
create table if not exists email_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  imap_host text not null,
  imap_port int default 993,
  email text not null,
  password text,
  password_cipher text,
  password_iv text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Regras de filtro
create table if not exists filter_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  match_from text,
  match_subject text,
  match_keyword text,
  notify_whatsapp boolean default true,
  notify_telegram boolean default true,
  active boolean default true,
  created_at timestamptz default now()
);

-- Log de emails já notificados
create table if not exists notified_emails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references email_accounts(id) on delete cascade,
  message_id text not null,
  subject text,
  from_address text,
  matched_rule text,
  notified_at timestamptz default now(),
  unique(account_id, message_id)
);