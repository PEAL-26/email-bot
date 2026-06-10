import { getActiveAccounts, getActiveRules, isAlreadyNotified, registerNotification } from "./supabase.ts";
import { fetchNewEmails } from "./imap.ts";
import { matchesRule } from "./filter.ts";
import { formatMessage } from "./formatter.ts";
import { sendTelegram } from "./notifiers/telegram.ts";
import { sendWhatsApp } from "./notifiers/whatsapp.ts";
import type { ScanFilter } from "./types.ts";

export interface ScanConfig {
  supabaseUrl: string;
  supabaseKey: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  zapiInstanceId?: string;
  zapiToken?: string;
  whatsappPhone?: string;
  filters?: ScanFilter[];
}

export interface ScanResult {
  totalNotified: number;
  errors: string[];
}

async function scanWithFilters(
  config: ScanConfig,
  filters: ScanFilter[],
): Promise<ScanResult> {
  const { supabaseUrl, supabaseKey, telegramBotToken, telegramChatId, zapiInstanceId, zapiToken, whatsappPhone } = config;

  const accountIds = filters.map(f => f.account_id).filter(Boolean) as string[];
  const accounts = await getActiveAccounts(supabaseUrl, supabaseKey);
  const filteredAccounts = accountIds.length
    ? accounts.filter(a => accountIds.includes(a.id))
    : accounts;

  if (!filteredAccounts.length) {
    console.log("Nenhuma conta activa encontrada para os filtros.");
    return { totalNotified: 0, errors: [] };
  }

  let totalNotified = 0;
  const errors: string[] = [];

  for (const account of filteredAccounts) {
    try {
      const f = filters.find(f => !f.account_id || f.account_id === account.id);
      const sinceMinutes = f?.since_minutes ?? 360;

      console.log(`📬 Scan manual: ${account.label} (since=${sinceMinutes}min)`);
      const emails = await fetchNewEmails(account, sinceMinutes);
      console.log(`  → ${emails.length} email(s) encontrado(s)`);

      for (const email of emails) {
        const already = await isAlreadyNotified(supabaseUrl, supabaseKey, account.id, email.messageId);
        if (already) continue;

        let matched = false;
        for (const filter of filters) {
          if (filter.account_id && filter.account_id !== account.id) continue;

          const matchFrom = !filter.from || email.from.toLowerCase().includes(filter.from.toLowerCase());
          const matchSubject = !filter.subject || email.subject.toLowerCase().includes(filter.subject.toLowerCase());
          const matchKeyword = !filter.keyword || email.body.toLowerCase().includes(filter.keyword.toLowerCase());

          if (!matchFrom || !matchSubject || !matchKeyword) continue;

          const ruleLabel = `Scan manual: ${filter.from || '*'}/${filter.subject || '*'}/${filter.keyword || '*'}`;
          const { plain, html } = formatMessage(email, account, { name: ruleLabel, notify_whatsapp: true, notify_telegram: true } as any);

          const sends: Promise<void>[] = [];
          sends.push(sendWhatsApp(plain, zapiInstanceId, zapiToken, whatsappPhone));
          sends.push(sendTelegram(html, telegramBotToken, telegramChatId));
          await Promise.all(sends);

          await registerNotification(supabaseUrl, supabaseKey, {
            account_id: account.id,
            message_id: email.messageId,
            subject: email.subject,
            from_address: email.from,
            matched_rule: ruleLabel,
          });

          totalNotified++;
          matched = true;
          console.log(`  ✓ Notificado: "${email.subject}" (scan manual)`);
          break;
        }

        if (!matched) {
          await registerNotification(supabaseUrl, supabaseKey, {
            account_id: account.id,
            message_id: email.messageId,
            subject: email.subject,
            from_address: email.from,
            matched_rule: null,
          });
        }
      }
    } catch (err: any) {
      const msg = `Erro na conta ${account.label}: ${err.message}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return { totalNotified, errors };
}

async function scanWithRules(
  config: ScanConfig,
): Promise<ScanResult> {
  const { supabaseUrl, supabaseKey, telegramBotToken, telegramChatId, zapiInstanceId, zapiToken, whatsappPhone } = config;

  const accounts = await getActiveAccounts(supabaseUrl, supabaseKey);
  if (!accounts.length) {
    console.log("Nenhuma conta ativa encontrada.");
    return { totalNotified: 0, errors: [] };
  }

  const rules = await getActiveRules(supabaseUrl, supabaseKey);
  if (!rules.length) {
    console.log("Nenhuma regra ativa encontrada.");
    return { totalNotified: 0, errors: [] };
  }

  let totalNotified = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      console.log(`📬 Verificando: ${account.label}`);
      const emails = await fetchNewEmails(account);
      console.log(`  → ${emails.length} email(s) encontrado(s)`);

      for (const email of emails) {
        const already = await isAlreadyNotified(supabaseUrl, supabaseKey, account.id, email.messageId);
        if (already) continue;

        let matched = false;
        for (const rule of rules) {
          if (!matchesRule(email, rule)) continue;

          const { plain, html } = formatMessage(email, account, rule);
          const sends: Promise<void>[] = [];

          if (rule.notify_whatsapp) sends.push(sendWhatsApp(plain, zapiInstanceId, zapiToken, whatsappPhone));
          if (rule.notify_telegram) sends.push(sendTelegram(html, telegramBotToken, telegramChatId));
          await Promise.all(sends);

          await registerNotification(supabaseUrl, supabaseKey, {
            account_id: account.id,
            message_id: email.messageId,
            subject: email.subject,
            from_address: email.from,
            matched_rule: rule.name,
          });

          totalNotified++;
          matched = true;
          console.log(`  ✓ Notificado: "${email.subject}" (regra: ${rule.name})`);
          break;
        }

        if (!matched) {
          await registerNotification(supabaseUrl, supabaseKey, {
            account_id: account.id,
            message_id: email.messageId,
            subject: email.subject,
            from_address: email.from,
            matched_rule: null,
          });
        }
      }
    } catch (err: any) {
      const msg = `Erro na conta ${account.label}: ${err.message}`;
      console.error(msg);
      errors.push(msg);
    }
  }

  return { totalNotified, errors };
}

export async function scanEmails(config: ScanConfig): Promise<ScanResult> {
  if (config.filters && config.filters.length > 0) {
    return scanWithFilters(config, config.filters);
  }
  return scanWithRules(config);
}
