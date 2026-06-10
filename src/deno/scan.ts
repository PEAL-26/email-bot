import { scanEmails } from "../../supabase/functions/_shared/scanner.ts";

console.log("▶ Iniciando verificação de emails...");

const { totalNotified, errors } = await scanEmails({
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  telegramBotToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
  telegramChatId: Deno.env.get("TELEGRAM_CHAT_ID"),
  zapiInstanceId: Deno.env.get("ZAPI_INSTANCE_ID"),
  zapiToken: Deno.env.get("ZAPI_TOKEN"),
  whatsappPhone: Deno.env.get("WHATSAPP_PHONE"),
});

console.log(`\n✅ Concluído. ${totalNotified} notificação(ões) enviada(s).`);
if (errors.length) {
  console.error(`❌ ${errors.length} erro(s):`, errors);
}
