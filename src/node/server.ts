import "dotenv/config";
import { createServer } from "http";
import { readFileSync } from "fs";
import { scanEmails } from "../../supabase/functions/_shared/scanner.ts";

const dashboard = readFileSync(new URL("../../dashboard.html", import.meta.url), "utf-8");

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(dashboard);
    return;
  }

  if (req.method === "POST" && req.url === "/scan") {
    try {
      const result = await scanEmails({
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        telegramChatId: process.env.TELEGRAM_CHAT_ID,
        zapiInstanceId: process.env.ZAPI_INSTANCE_ID,
        zapiToken: process.env.ZAPI_TOKEN,
        whatsappPhone: process.env.WHATSAPP_PHONE,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
      return;
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

const PORT = parseInt(process.env.PORT || "3000", 10);
server.listen(PORT, () => console.log(`🚀 Servidor em http://localhost:${PORT}`));
