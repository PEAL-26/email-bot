import { scanEmails } from "./supabase/functions/_shared/scanner.ts";

const dashboard = await Deno.readTextFile("./dashboard.html");

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/") {
    return new Response(dashboard, {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (req.method === "POST" && url.pathname === "/scan") {
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
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Not found", { status: 404 });
});
