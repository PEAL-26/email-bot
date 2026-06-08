import {
  getActiveAccounts,
  getActiveRules,
  isAlreadyNotified,
  registerNotification,
} from "../shared/supabase.ts";
import { fetchNewEmails } from "../shared/imap.ts";
import { matchesRule } from "../shared/filter.ts";
import { formatMessage } from "../shared/formatter.ts";
import { sendTelegram } from "../shared/notifiers/telegram.ts";
import { sendWhatsApp } from "../shared/notifiers/whatsapp.ts";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const ZAPI_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const WA_PHONE = process.env.WHATSAPP_PHONE;

async function main() {
  console.log("▶ Iniciando verificação de emails...");

  const accounts = await getActiveAccounts(SUPABASE_URL, SUPABASE_KEY);
  if (!accounts.length) {
    console.log("Nenhuma conta ativa encontrada.");
    return;
  }

  const rules = await getActiveRules(SUPABASE_URL, SUPABASE_KEY);
  if (!rules.length) {
    console.log("Nenhuma regra ativa encontrada.");
    return;
  }

  let totalNotified = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      console.log(`📬 Verificando: ${account.label}`);
      const emails = await fetchNewEmails(account);
      console.log(`  → ${emails.length} email(s) encontrado(s)`);

      for (const email of emails) {
        const already = await isAlreadyNotified(
          SUPABASE_URL,
          SUPABASE_KEY,
          account.id,
          email.messageId,
        );
        if (already) continue;

        let matched = false;
        for (const rule of rules) {
          if (!matchesRule(email, rule)) continue;

          const { plain, html } = formatMessage(email, account, rule);

          const sends: Promise<void>[] = [];
          if (rule.notify_whatsapp) sends.push(sendWhatsApp(plain, ZAPI_ID, ZAPI_TOKEN, WA_PHONE));
          if (rule.notify_telegram) sends.push(sendTelegram(html, TG_TOKEN, TG_CHAT));
          await Promise.all(sends);

          await registerNotification(SUPABASE_URL, SUPABASE_KEY, {
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
          await registerNotification(SUPABASE_URL, SUPABASE_KEY, {
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

  console.log(`\n✅ Concluído. ${totalNotified} notificação(ões) enviada(s).`);
  if (errors.length) {
    console.error(`❌ ${errors.length} erro(s):`, errors);
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
