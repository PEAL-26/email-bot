-- ============================================================
-- Email Bot - Dados de exemplo
-- Execute APÓS o 01_schema.sql
-- ============================================================

-- Exemplos de contas de email
-- ATENÇÃO: Substitua pelos seus dados reais
insert into email_accounts (label, imap_host, imap_port, email, password) values
  ('Gmail pessoal',  'imap.gmail.com',   993, 'seuemail@gmail.com',   'sua-app-password-aqui'),
  ('Gmail trabalho', 'imap.gmail.com',   993, 'trabalho@gmail.com',   'sua-app-password-aqui'),
  ('Outlook',        'outlook.office365.com', 993, 'seuemail@outlook.com', 'sua-senha-aqui');

-- Exemplos de regras de filtro
insert into filter_rules (name, match_from, match_subject, match_keyword, notify_whatsapp, notify_telegram) values
  ('Pix recebido',      null,                   'pix recebido',    null,          true,  true),
  ('Fatura cartão',     null,                   'fatura',          null,          true,  false),
  ('Boleto vencendo',   null,                   'vencimento',      null,          true,  true),
  ('Email do chefe',    'chefe@empresa.com',     null,              null,          true,  true),
  ('Banco do Brasil',   '@bb.com.br',            null,              null,          true,  true),
  ('Nubank',            '@nubank.com.br',         null,              null,          false, true),
  ('Palavra urgente',   null,                    null,              'urgente',     true,  true);