import {
  getActiveAccounts,
  getActiveRules,
  isAlreadyNotified,
  registerNotification,
} from "../../../src/shared/supabase.ts";
import { fetchNewEmails } from "../../../src/shared/imap.ts";
import { matchesRule } from "../../../src/shared/filter.ts";
import { formatMessage } from "../../../src/shared/formatter.ts";
import { sendTelegram } from "../../../src/shared/notifiers/telegram.ts";
import { sendWhatsApp } from "../../../src/shared/notifiers/whatsapp.ts";

Deno.serve(async (_req) => {
  console.log("▶ Iniciando verificação de emails...");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const tgChat = Deno.env.get("TELEGRAM_CHAT_ID");
  const zapiId = Deno.env.get("ZAPI_INSTANCE_ID");
  const zapiToken = Deno.env.get("ZAPI_TOKEN");
  const waPhone = Deno.env.get("WHATSAPP_PHONE");

  try {
    const accounts = await getActiveAccounts(supabaseUrl, supabaseKey);
    if (!accounts?.length) {
      return new Response(JSON.stringify({ message: "Nenhuma conta ativa" }), { status: 200 });
    }

    const rules = await getActiveRules(supabaseUrl, supabaseKey);
    if (!rules?.length) {
      return new Response(JSON.stringify({ message: "Nenhuma regra ativa" }), { status: 200 });
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
            supabaseUrl,
            supabaseKey,
            account.id,
            email.messageId,
          );
          if (already) continue;

          let matched = false;
          for (const rule of rules) {
            if (!matchesRule(email, rule)) continue;

            const { plain, html } = formatMessage(email, account, rule);
            const sends: Promise<void>[] = [];

            if (rule.notify_whatsapp) sends.push(sendWhatsApp(plain, zapiId, zapiToken, waPhone));
            if (rule.notify_telegram) sends.push(sendTelegram(html, tgToken, tgChat));
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

    return new Response(
      JSON.stringify({ notificacoes_enviadas: totalNotified, erros: errors }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Erro geral:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
