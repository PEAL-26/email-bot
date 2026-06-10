import { scanEmails } from "../_shared/scanner.ts";

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret) {
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  console.log("▶ Iniciando verificação de emails...");

  try {
    const result = await scanEmails({
      supabaseUrl: Deno.env.get("SUPABASE_URL")!,
      supabaseKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      telegramBotToken: Deno.env.get("TELEGRAM_BOT_TOKEN"),
      telegramChatId: Deno.env.get("TELEGRAM_CHAT_ID"),
      zapiInstanceId: Deno.env.get("ZAPI_INSTANCE_ID"),
      zapiToken: Deno.env.get("ZAPI_TOKEN"),
      whatsappPhone: Deno.env.get("WHATSAPP_PHONE"),
    });

    return new Response(
      JSON.stringify({
        notificacoes_enviadas: result.totalNotified,
        erros: result.errors,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Erro geral:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
    });
  }
});
