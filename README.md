# Email Bot

Monitora contas de email via IMAP, aplica regras de filtro e envia notificações no **Telegram** e **WhatsApp** (Z-API).

---

## Quick Start

```bash
cp .env.example .env   # edite com suas credenciais
npm install
npm start              # http://localhost:3000
```

---

## Pré-requisitos

| Recurso | Obrigatório | Para quê |
|---------|:-----------:|----------|
| [Supabase](https://supabase.com) project | ✅ | Banco de dados + Edge Functions |
| Telegram Bot Token | ✅ | Notificações no Telegram |
| [Z-API](https://z-api.io) instance | ❌ | Notificações no WhatsApp |
| Node.js 20+ | ✅ | Execução local |

---

## Variáveis de Ambiente

Todas as configurações são feitas via `.env` (local), Secrets do GitHub Actions ou Secrets do Supabase.

### Supabase

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |

### Telegram

| Variável | Descrição |
|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | Token do bot (BotFather) |
| `TELEGRAM_CHAT_ID` | Chat ID para notificações |
| `TELEGRAM_SECRET_TOKEN` | Token secreto do webhook |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Chats permitidos (separados por vírgula) |

### WhatsApp (Z-API)

| Variável | Descrição |
|----------|-----------|
| `ZAPI_INSTANCE_ID` | ID da instância |
| `ZAPI_TOKEN` | Token da instância |
| `WHATSAPP_PHONE` | Telefone para notificações |

### GitHub

| Variável | Descrição |
|----------|-----------|
| `GITHUB_PAT` | Personal Access Token (permissão `actions:write`) |
| `GITHUB_OWNER` | Dono do repositório |
| `GITHUB_REPO` | Nome do repositório |

### Segurança

| Variável | Descrição |
|----------|-----------|
| `EMAIL_ENCRYPTION_KEY` | Chave AES-256-GCM para encriptar senhas IMAP |
| `CRON_SECRET` | Protege a Edge Function `scan-emails` |

---

## Como executar

| Comando | O que faz |
|---------|-----------|
| `npm start` | Servidor HTTP com dashboard, scan e health check |
| `npm run scan` | Escaneia emails uma vez e envia notificações |
| `npm run scheduler` | Scheduler local (lê a tabela `scan_schedules` a cada 60s) |

---

## Deploy

### GitHub Actions

O workflow `.github/workflows/scan-emails.yml` já está configurado. Basta adicionar os Secrets no repositório (lista completa na secção acima) e opcionalmente a Variable `SCAN_CRON` (padrão: `0 */6 * * *`).

### Supabase Edge Functions

```bash
# Instalar CLI (se não tiver)
npm install -g supabase

# Deploy das funções
supabase functions deploy scan-emails
supabase functions deploy scan-scheduler
supabase functions deploy encrypt-password
supabase functions deploy telegram-webhook

# Configurar secrets
supabase secrets set EMAIL_ENCRYPTION_KEY=...
supabase secrets set GITHUB_PAT=...
supabase secrets set GITHUB_OWNER=...
supabase secrets set GITHUB_REPO=...
supabase secrets set TELEGRAM_SECRET_TOKEN=...
```

### Banco de Dados

Execute os scripts SQL no SQL Editor do Supabase **na seguinte ordem**:

1. `01_schema.sql` — tabelas `email_accounts`, `filter_rules`, `notified_emails`
2. `02_seed.sql` — dados de exemplo (edite antes!)
3. `03_cron.sql` — agendamento pg_cron (scan a cada 6h)
4. `04_rls_policies.sql` — libera acesso anon (para o dashboard)
5. `05_scan_schedules.sql` — tabela de agendamentos dinâmicos
6. `06_scheduler_cron.sql` — pg_cron para o scheduler (a cada 1 min)

---

## Segurança

- Senhas IMAP são encriptadas com **AES-256-GCM** antes de salvar no banco
- A Edge Function `telegram-webhook` verifica `X-Telegram-Bot-Api-Secret-Token`
- A Edge Function `scan-emails` pode ser protegida com `CRON_SECRET`
- O webhook do Telegram pode restringir chats com `TELEGRAM_ALLOWED_CHAT_IDS`
