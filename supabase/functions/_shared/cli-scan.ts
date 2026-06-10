import { getEnv } from "./runtime.ts";
import { scanEmails } from "./scanner.ts";

const { totalNotified, errors } = await scanEmails({
  supabaseUrl: getEnv("SUPABASE_URL")!,
  supabaseKey: getEnv("SUPABASE_SERVICE_ROLE_KEY")!,
  telegramBotToken: getEnv("TELEGRAM_BOT_TOKEN"),
  telegramChatId: getEnv("TELEGRAM_CHAT_ID"),
  zapiInstanceId: getEnv("ZAPI_INSTANCE_ID"),
  zapiToken: getEnv("ZAPI_TOKEN"),
  whatsappPhone: getEnv("WHATSAPP_PHONE"),
});

console.log(`\n✅ Concluído. ${totalNotified} notificação(ões) enviada(s).`);
if (errors.length) {
  console.error(`❌ ${errors.length} erro(s):`, errors);
}
