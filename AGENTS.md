# AGENTS.md — Email Bot

## Project Overview

Email monitoring bot that scans IMAP inboxes, filters by rules, and sends notifications (Telegram / WhatsApp).

- **Language:** TypeScript 100%
- **Runtimes:** Node.js (GitHub Actions, local CLI/server), Deno (Deno CLI, Supabase Edge Functions)
- **Database:** Supabase (PostgreSQL + pg_cron)
- **IMAP:** imapflow
- **Notifications:** Telegram Bot API + Z-API (WhatsApp)
- **Frameworks:** None (vanilla TypeScript throughout)

## Project Structure

```
email-bot/
├── main.ts                          # Deno HTTP server (thin adapter)
├── dashboard.html                   # Standalone admin dashboard
├── src/
│   ├── node/
│   │   ├── scan.ts                  # Node CLI entry (thin adapter)
│   │   ├── scheduler.ts             # Node scheduler loop (thin adapter)
│   │   └── server.ts                # Node HTTP server (thin adapter)
│   └── deno/
│       ├── scan.ts                  # Deno CLI entry (thin adapter)
│       └── scheduler.ts             # Deno scheduler loop (thin adapter)
├── supabase/
│   └── functions/
│       ├── _shared/                 # Shared modules (all runtimes)
│       │   ├── runtime.ts           # Runtime abstraction (getEnv, readTextFile, incomingToRequest)
│       │   ├── scheduler.ts         # Centralized scheduler logic (cronMatches, runSchedulerTick)
│       │   ├── cli-scan.ts          # Centralized scan CLI entry
│       │   ├── http-handlers.ts     # Centralized HTTP handlers (Web API Request/Response)
│       │   ├── scanner.ts           # Core scan orchestrator
│       │   ├── types.ts             # TypeScript interfaces
│       │   ├── cors.ts              # CORS headers
│       │   ├── crypto.ts            # AES-256-GCM encrypt/decrypt
│       │   ├── filter.ts            # Rule matching
│       │   ├── formatter.ts         # Message formatting
│       │   ├── imap.ts              # IMAP fetch
│       │   ├── supabase.ts          # Supabase DB client
│       │   └── notifiers/           # Notification senders
│       ├── scan-emails/             # Edge function: triggered scan
│       ├── scan-scheduler/          # Edge function: cron-based scheduler
│       ├── encrypt-password/        # Edge function: encrypt IMAP passwords
│       └── telegram-webhook/        # Edge function: Telegram bot webhook
│       └── import_map.json
```

## Runtime Abstraction

**NEVER use `process.env` or `Deno.env.get()` directly in shared code.**

Use `getEnv()` from `_shared/runtime.ts` instead — it works in both Node and Deno.

```ts
import { getEnv, readTextFile, incomingToRequest } from "../_shared/runtime.ts";

const url = getEnv("SUPABASE_URL")!;
```

Available functions:
- `getEnv(name: string): string | undefined` — read env vars in any runtime
- `readTextFile(path: string): Promise<string>` — read file (relative to CWD)
- `incomingToRequest(req): Promise<Request>` — convert Node `IncomingMessage` to Web API `Request`

## Shared Modules (`_shared/`)

All code in `_shared/` must:
1. Work in **both Node.js and Deno** runtimes
2. Use `runtime.ts` for any runtime-specific operations
3. Import via **relative paths** (`../_shared/...`)
4. Avoid runtime-specific APIs directly (`process.env`, `Deno.env.get`, `readFileSync`)

## Entry Points (Thin Adapters)

Each entry point file is a minimal adapter that:
1. Handles runtime initialization (e.g. `import "dotenv/config"` in Node)
2. Creates runtime-specific clients
3. Delegates all business logic to `_shared/` modules

Examples:
- `src/node/scan.ts` — imports dotenv, then re-exports `_shared/cli-scan.ts`
- `src/deno/scan.ts` — re-exports `_shared/cli-scan.ts`
- `src/node/scheduler.ts` — creates Supabase client, calls `runSchedulerTick()`, sets `setInterval`
- `supabase/functions/scan-scheduler/index.ts` — wraps `runSchedulerTick()` in `Deno.serve` with CORS

## Conventions

- **TypeScript:** strict mode, ES2022 target, noEmit, ESNext modules
- **Imports in `_shared/`:** always relative paths (`./scanner.ts`, `../_shared/runtime.ts`)
- **HTTP handlers:** always use Web API `Request`/`Response` types (not Node-specific req/res)
- **Logging:** use `console.log` / `console.error` — no external logging library
- **No frameworks:** keep the codebase dependency-free beyond imapflow and @supabase/supabase-js
