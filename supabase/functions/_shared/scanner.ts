import { getActiveAccounts, getActiveRules, isAlreadyNotified, registerNotification } from "./supabase.ts";
import { fetchNewEmails } from "./imap.ts";
import { matchesRule } from "./filter.ts";
import { formatMessage } from "./formatter.ts";
import { sendTelegram } from "./notifiers/telegram.ts";
import { sendWhatsApp } from "./notifiers/whatsapp.ts";

export interface ScanConfig {
  supabaseUrl: string;
  supabaseKey: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  zapiInstanceId?: string;
  zapiToken?: string;
  whatsappPhone?: string;
}

export interface ScanResult {
  totalNotified: number;
  errors: string[];
}

export async function scanEmails(config: ScanConfig): Promise<ScanResult> {
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
