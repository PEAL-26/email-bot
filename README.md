# Email Bot

Bot que varre contas de email via IMAP, aplica regras de filtro e envia notificações no **WhatsApp** (Z-API) e **Telegram**.

## Arquitetura

```
src/
  shared/          # Código reutilizável (roda em Node.js e Deno)
    types.ts        # Tipos compartilhados
    filter.ts       # Match de regras de filtro
    formatter.ts    # Formatação de mensagens
    imap.ts         # Leitura de emails via IMAP
    supabase.ts     # Acesso ao banco Supabase
    notifiers/
      telegram.ts   # Envio de notificações Telegram
      whatsapp.ts   # Envio de notificações WhatsApp
  node/
    index.ts        # Entry point Node.js (GitHub Actions)
supabase/
  functions/
    scan-emails/    # Edge Function para Supabase Cron
    telegram-webhook/  # Edge Function para trigger manual via Telegram
```

### Ambientes suportados

| Ambiente | Runtime | Quando executa |
|----------|---------|----------------|
| **GitHub Actions** | Node.js | Agendado (cron) + manual via Telegram |
| **Supabase** | Deno (Edge Functions) | Agendado (pg_cron) |

O código em `src/shared/` é **compartilhado** entre ambos os ambientes.

---

## Configuração

### 1. Banco de Dados (Supabase)

Execute os scripts SQL no **SQL Editor** do Supabase:

```bash
scripts/01_schema.sql   # Cria as tabelas
scripts/02_seed.sql     # Dados de exemplo (edite antes!)
```

### 2. Variáveis de Ambiente

#### GitHub Actions Secrets

| Secret | Descrição |
|--------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key do Supabase |
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram |
| `TELEGRAM_CHAT_ID` | Chat ID para notificações |
| `ZAPI_INSTANCE_ID` | ID da instância Z-API |
| `ZAPI_TOKEN` | Token da instância Z-API |
| `WHATSAPP_PHONE` | Telefone para notificações WhatsApp |
| `GITHUB_PAT` | Personal Access Token (para trigger via Telegram) |
| `EMAIL_ENCRYPTION_KEY` | Chave secreta para encriptação AES-256-GCM das senhas IMAP |

#### GitHub Actions Variables

| Variable | Descrição | Default |
|----------|-----------|---------|
| `SCAN_CRON` | Expressão cron para agendamento | `0 */6 * * *` |

#### Secrets para deploy Supabase

| Secret | Descrição |
|--------|-----------|
| `GITHUB_PAT` | Personal Access Token do GitHub |
| `GITHUB_OWNER` | Dono do repositório (usuário ou organização) |
| `GITHUB_REPO` | Nome do repositório |

---

## Execução Local (Node.js)

```bash
# Instalar dependências
npm install

# Executar varredura
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
  npm run scan
```

---

## GitHub Actions

### Agendamento Automático

O workflow executa automaticamente no horário definido pela variável `SCAN_CRON`.
Para alterar:

1. Vá em **Settings > Variables and Secrets > Actions**
2. Crie a variável `SCAN_CRON` com o valor desejado (ex: `0 */3 * * *`)
3. Se não definir, o padrão é a cada 6 horas

### Execução Manual

Você pode disparar manualmente:

1. Pelo GitHub: **Actions > Scan Emails > Run workflow**
2. Pelo Telegram: envie `/scan` para o bot (veja seção abaixo)

---

## Trigger Manual via Telegram

### Como configurar

1. Crie um **Personal Access Token** no GitHub com permissão `actions:write`
2. Adicione o token como `GITHUB_PAT` nos secrets do Supabase
3. Adicione `GITHUB_OWNER` e `GITHUB_REPO` nos secrets do Supabase
4. Adicione `TELEGRAM_SECRET_TOKEN` nos secrets do Supabase (use o valor retornado pelo BotFather)
5. Faça deploy da Edge Function `telegram-webhook`:

```bash
cd supabase
supabase functions deploy telegram-webhook
supabase secrets set GITHUB_PAT=ghp_xxx
supabase secrets set GITHUB_OWNER=seu-usuario
supabase secrets set GITHUB_REPO=email-bot
supabase secrets set TELEGRAM_SECRET_TOKEN=token_do_botfather
```

5. Configure o webhook no BotFather do Telegram:

```bash
# URL da sua função Supabase
https://<project>.supabase.co/functions/v1/telegram-webhook
```

6. Registre o comando no BotFather:
```
/scan - Inicia varredura manual de emails
```

### Uso

Envie `/scan` para o bot Telegram. Opcionalmente, adicione um motivo:

```
/scan
/scan Verificando email do chefe
```

O bot responderá com confirmação e o GitHub Actions iniciará a varredura.

---

## Supabase (via pg_cron)

O agendamento original via Supabase continua funcionando normalmente:

```sql
select cron.schedule(
  'scan-emails',
  '0 */6 * * *',
  $$ select net.http_post(
    url:='<SUPABASE_FUNCTION_URL>',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    )
  ) $$
);
```

---

## Estrutura do Projeto

```
email-bot/
├── .github/workflows/
│   └── scan-emails.yml        # Workflow GitHub Actions
├── src/
│   ├── shared/                # Código compartilhado (Node + Deno)
│   │   ├── types.ts
│   │   ├── crypto.ts           # Encriptação AES-256-GCM
│   │   ├── filter.ts
│   │   ├── formatter.ts
│   │   ├── imap.ts
│   │   ├── supabase.ts
│   │   └── notifiers/
│   │       ├── telegram.ts
│   │       └── whatsapp.ts
│   └── node/
│       └── index.ts           # Entry point Node.js
├── supabase/
│   ├── config.toml
│   └── functions/
│       ├── scan-emails/        # Edge Function original
│       ├── encrypt-password/   # Encripta senhas (usado pelo dashboard)
│       └── telegram-webhook/   # Webhook para trigger manual
├── scripts/
│   ├── 01_schema.sql
│   ├── 02_seed.sql
│   ├── 03_cron.sql
│   └── 04_rls_policies.sql      # RLS policies para dashboard anon
├── package.json
├── deno.json
└── tsconfig.json
```

---

## Dashboard HTML

O arquivo `dashboard.html` é uma interface estática para gerenciar contas, regras e visualizar notificações.

### Como usar

1. Execute `scripts/04_rls_policies.sql` no SQL Editor do Supabase (libera acesso anon)
2. Faça deploy das Edge Functions:
   ```bash
   supabase functions deploy scan-emails
   supabase functions deploy encrypt-password
   ```
3. Configure o `EMAIL_ENCRYPTION_KEY` no `encrypt-password`:
   ```bash
   supabase secrets set EMAIL_ENCRYPTION_KEY=sua-chave
   ```
4. Abra o `dashboard.html` no navegador
5. Preencha a **SUPABASE_URL** e a **Anon Key** (encontradas em Settings > API no Supabase) e clique em **Conectar**

### Funcionalidades

| Tab | Operações |
|-----|-----------|
| **Email Accounts** | Visualizar, criar, editar, ativar/desativar |
| **Notified Emails** | Visualizar (modal com detalhes), filtrar por data |
| **Filter Rules** | Visualizar, criar, editar, excluir |

---

## Segurança

### Senhas encriptadas

As senhas IMAP são encriptadas com **AES-256-GCM** antes de serem salvas no banco. Configure a chave de encriptação:

```bash
# GitHub Actions: adicione EMAIL_ENCRYPTION_KEY nos secrets
# Supabase Edge Functions: supabase secrets set EMAIL_ENCRYPTION_KEY=sua-chave
# Local: inclua no .env
# Gerar EMAIL_ENCRYPTION_KEY Ex: openssl rand -base64 32 
EMAIL_ENCRYPTION_KEY=sua-chave-secreta-forte
```

> **IMPORTANTE:** Gere uma chave forte (mínimo 32 caracteres). Nunca commite a chave no repositório.

Migração de senhas existentes (plaintext → encriptado):

```typescript
import { encrypt } from "./src/shared/crypto.ts";

// Para cada conta com password em plaintext:
const { ciphertext, iv } = await encrypt(plainPassword, process.env.EMAIL_ENCRYPTION_KEY);
// Atualize no banco: password_cipher = ciphertext, password_iv = iv, password = null
```

### Webhook do Telegram

Para evitar que qualquer pessoa dispare workflows, configure o `TELEGRAM_SECRET_TOKEN`:

1. No BotFather, use `/setprivacy` ou `/mybots > Bot Settings > Secret Token`
2. Adicione o token como `TELEGRAM_SECRET_TOKEN` no Supabase
3. Opcionalmente, configure `TELEGRAM_ALLOWED_CHAT_IDS` (separado por vírgula) para restringir a execução a chats específicos

### Edge Function `scan-emails`

A Edge Function `scan-emails` pode ser protegida com um `CRON_SECRET`:

```bash
supabase secrets set CRON_SECRET=sua-chave-secreta
```

Se configurado, o `pg_cron` deve enviar o header `Authorization: Bearer <CRON_SECRET>`.
